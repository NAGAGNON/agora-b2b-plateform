/**
 * Sélection inversée : les entreprises déjà joignables (adresse connue) sont rapprochées des
 * opportunités ouvertes des 14 derniers jours, sans attendre de nouvelles annonces ni de recherche.
 */
import { randomInt } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, RUN } from "./helpers";
import { buildDailyCampaign, syncOpportunityStates } from "@/lib/outreach/pipeline";
import { loadSettings, type OutreachSettings } from "@/lib/outreach/data";

const T = `IT ${RUN} JOIGNABLE`;
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
let original: OutreachSettings;
let oppId = "";
const P: Record<string, string> = {};
const campaigns: string[] = [];

async function prospect(key: string, email: string | null) {
  const { data, error } = await admin
    .from("outreach_prospects")
    .insert({ name: `${T} ${key}`, siren: String(randomInt(100_000_000, 999_999_999)), source: "Test", email, email_source: email ? "Test" : null, naf_code: "43.21A", department_code: "29", region: "Bretagne" })
    .select("id")
    .single();
  if (error) throw error;
  P[key] = data.id;
}

beforeAll(async () => {
  original = await loadSettings(admin);
  await admin.from("outreach_settings").update({ discovery_enabled: false, require_validation: true, dry_run: true, min_score: 70, lookback_days: 2, min_days_before_deadline: 3, min_days_between_contacts: 7 }).eq("id", true);
  const { data, error } = await admin
    .from("opportunities")
    .insert({ type: "PUBLIC_TENDER", origin: "EXTERNAL", status: "PUBLISHED", visibility: "PUBLIC", title: `${T} Travaux d'installation électrique du collège`, description: "Remplacement des tableaux électriques et de l'éclairage du collège.", sector_slug: "electricite-automatisme", department_code: "29", region: "Bretagne", response_deadline: inDays(20), published_at: new Date().toISOString(), external_buyer_name: `Commune ${T}` })
    .select("id")
    .single();
  if (error) throw error;
  oppId = data.id;
  await prospect("joignable", `joignable-${RUN}@example.test`);
  await prospect("sansAdresse", null);
  await syncOpportunityStates(admin, await loadSettings(admin));
  // Annonce repérée il y a 10 jours : hors de la fenêtre habituelle (2 jours)
  await admin.from("outreach_opportunity_states").update({ first_seen_at: inDays(-10), status: "PROCESSED" }).eq("opportunity_id", oppId);
});

afterAll(async () => {
  if (campaigns.length) await admin.from("outreach_campaigns").delete().in("id", campaigns);
  await admin.from("outreach_prospects").delete().like("name", `${T}%`);
  await admin.from("opportunities").delete().eq("id", oppId);
  const restore: Partial<OutreachSettings> = { ...original };
  delete restore.id;
  delete restore.updated_at;
  delete restore.updated_by;
  await admin.from("outreach_settings").update(restore).eq("id", true);
});

const recipientOf = async (campaignId: string, key: string) =>
  (await admin.from("outreach_recipients").select("status, items:outreach_recipient_opportunities(opportunity_id)").eq("campaign_id", campaignId).eq("prospect_id", P[key]).maybeSingle()).data;

describe("Sélection inversée des entreprises joignables", () => {
  it("fenêtre habituelle : l'annonce de 10 jours n'est pas reprise", async () => {
    const r = await buildDailyCampaign(admin, { manual: { userId: null } });
    campaigns.push(r.campaignId!);
    expect(await recipientOf(r.campaignId!, "joignable")).toBeNull();
  });

  it("joignables sur 14 jours : e-mail prêt pour l'entreprise avec adresse, rien pour celle sans adresse", async () => {
    const r = await buildDailyCampaign(admin, { manual: { userId: null, reachableOnly: true, lookbackDays: 14 } });
    campaigns.push(r.campaignId!);
    const rec = await recipientOf(r.campaignId!, "joignable");
    expect(rec?.status).toBe("PENDING");
    expect((rec?.items ?? []).map((i: { opportunity_id: string }) => i.opportunity_id)).toContain(oppId);
    expect(await recipientOf(r.campaignId!, "sansAdresse")).toBeNull();
  });
});
