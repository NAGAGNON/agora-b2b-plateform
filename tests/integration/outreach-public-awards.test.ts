/**
 * Outreach — ciblage des entreprises qui remportent des marchés publics :
 * mise à jour depuis la DECP (réponse simulée, aucune requête réseau), métiers visés
 * vérifiés en premier, arrêt sans écriture en cas d'erreur, et priorité dans la campagne.
 */
import { randomInt } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, RUN } from "./helpers";
import { refreshPublicAwards } from "@/lib/outreach/public-awards";
import { buildDailyCampaign, syncOpportunityStates } from "@/lib/outreach/pipeline";
import { loadSettings, type OutreachSettings } from "@/lib/outreach/data";

const T = `IT ${RUN} DECP`;
const siren = () => String(randomInt(100_000_000, 999_999_999));
const S: Record<string, string> = {};
const P: Record<string, string> = {};
let original: OutreachSettings;
const campaigns: string[] = [];

/** Réponse DECP simulée : nombre de marchés selon le SIREN demandé. */
function decp(counts: Record<string, number>, calls: string[] = []) {
  return (async (url: string) => {
    const where = new URL(url).searchParams.get("where") ?? "";
    const s = where.match(/"(\d{9})"/)?.[1] ?? "";
    calls.push(s);
    return new Response(JSON.stringify({ total_count: counts[s] ?? 0, results: [] }), { status: 200 });
  }) as unknown as typeof fetch;
}

async function prospect(key: string, row: { naf_code: string; department_code?: string; region?: string; email?: string; checked?: string; awards?: number }) {
  S[key] = siren();
  const { data, error } = await admin
    .from("outreach_prospects")
    .insert({
      name: `${T} ${key}`,
      siren: S[key],
      source: "Test d'intégration",
      naf_code: row.naf_code,
      department_code: row.department_code ?? "75",
      region: row.region ?? "Île-de-France",
      email: row.email ?? null,
      email_source: row.email ? "Test" : null,
      public_awards_checked_at: row.checked ?? null,
      public_awards_count: row.awards ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  P[key] = data.id;
}
const row = async (key: string) => (await admin.from("outreach_prospects").select("public_awards_count, public_awards_checked_at").eq("id", P[key]).single()).data!;

beforeAll(async () => {
  original = await loadSettings(admin);
  await prospect("btp", { naf_code: "43.99C" });
  await prospect("esn", { naf_code: "62.01Z" });
  await prospect("recent", { naf_code: "42.11Z", checked: new Date().toISOString(), awards: 3 });
});

afterAll(async () => {
  for (const id of campaigns) await admin.from("outreach_campaigns").delete().eq("id", id);
  await admin.from("outreach_prospects").delete().like("name", `${T}%`);
  const restore: Partial<OutreachSettings> = { ...original };
  delete restore.id;
  delete restore.updated_at;
  delete restore.updated_by;
  await admin.from("outreach_settings").update(restore).eq("id", true);
  await cleanup();
});

describe("Outreach — marchés publics remportés (DECP)", () => {
  it("erreur de la source (limite de débit) : arrêt immédiat, rien n'est écrit", async () => {
    const r = await refreshPublicAwards(admin, { nafCodes: ["43.99C", "62.01Z"], fetchImpl: (async () => new Response("{}", { status: 429 })) as unknown as typeof fetch, pause: 0 });
    expect(r).toMatchObject({ checked: 0, errors: 1 });
    expect(r.stopped).toMatch(/429/);
    expect((await row("btp")).public_awards_checked_at).toBeNull();
  });

  it("métiers habitués des marchés publics vérifiés en premier", async () => {
    const calls: string[] = [];
    const r = await refreshPublicAwards(admin, { nafCodes: ["43.99C", "62.01Z"], max: 1, fetchImpl: decp({ [S.btp]: 9 }, calls), pause: 0 });
    expect(r).toMatchObject({ checked: 1, winners: 1 });
    expect(calls).toEqual([S.btp]);
    expect(await row("btp")).toMatchObject({ public_awards_count: 9 });
    expect((await row("esn")).public_awards_checked_at).toBeNull();
  });

  it("vérification récente conservée (90 jours) ; les autres sont mises à jour", async () => {
    const calls: string[] = [];
    await refreshPublicAwards(admin, { nafCodes: ["43.99C", "62.01Z", "42.11Z"], fetchImpl: decp({ [S.recent]: 50 }, calls), pause: 0 });
    expect(calls).toEqual([S.esn]);
    expect(await row("esn")).toMatchObject({ public_awards_count: 0 });
    expect(await row("recent")).toMatchObject({ public_awards_count: 3 });
  });
});

describe("Outreach — priorité dans la campagne", () => {
  it("à activité et zone égales, l'entreprise qui remporte des marchés publics est retenue en premier", async () => {
    await admin.from("outreach_settings").update({ discovery_enabled: false, dry_run: true, require_validation: true, min_score: 50, max_prospects_per_opportunity: 1, min_days_before_deadline: 3, lookback_days: 2 }).eq("id", true);
    // Créée en premier : sans la priorité, elle serait retenue
    await prospect("other", { naf_code: "43.21A", department_code: "2A", region: "Corse", email: `other-${RUN}@example.test`, awards: 0, checked: new Date().toISOString() });
    await prospect("winner", { naf_code: "43.21A", department_code: "2A", region: "Corse", email: `winner-${RUN}@example.test`, awards: 8, checked: new Date().toISOString() });
    const { data: opp, error } = await admin
      .from("opportunities")
      .insert({ type: "PUBLIC_TENDER", origin: "EXTERNAL", status: "PUBLISHED", visibility: "PUBLIC", title: `IT ${RUN} Travaux d'installation électrique en Corse`, description: "Remplacement des tableaux électriques et de l'éclairage.", sector_slug: "electricite-automatisme", department_code: "2A", region: "Corse", response_deadline: new Date(Date.now() + 20 * 86_400_000).toISOString(), published_at: new Date().toISOString(), external_buyer_name: `Commune IT ${RUN}` })
      .select("id")
      .single();
    if (error) throw error;
    await syncOpportunityStates(admin, await loadSettings(admin));
    const r = await buildDailyCampaign(admin, { manual: { userId: null } });
    campaigns.push(r.campaignId!);
    const { data: links } = await admin.from("outreach_recipient_opportunities").select("recipient:outreach_recipients!inner(prospect_id, campaign_id, reasons)").eq("opportunity_id", opp.id).eq("recipient.campaign_id", r.campaignId!);
    const recipients = (links ?? []).map((l) => l.recipient as unknown as { prospect_id: string; reasons: string[] });
    expect(recipients.map((x) => x.prospect_id)).toEqual([P.winner]);
    expect(recipients[0].reasons.join(" ")).toContain("A remporté 8 marchés publics");
  });
});
