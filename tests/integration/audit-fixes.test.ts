/**
 * Corrections de l'audit : double authentification exigée aussi par la base, re-modération des
 * besoins publiés, comptes d'opportunités publics, et contrôles de la file d'envoi Outreach
 * (envoi réel suspendu, même adresse via deux entreprises, entreprise devenue utilisatrice).
 */
import { randomInt } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, company, RUN, user } from "./helpers";
import { processSendQueue } from "@/lib/outreach/pipeline";
import { loadSettings, type OutreachSettings } from "@/lib/outreach/data";

const T = `IT ${RUN} AUDIT`;
const DATE = `2091-${String(randomInt(1, 13)).padStart(2, "0")}-${String(randomInt(1, 29)).padStart(2, "0")}`;
const siren = () => String(randomInt(100_000_000, 999_999_999));
let original: OutreachSettings;
let originalSecurity: unknown;
const campaigns: string[] = [];

beforeAll(async () => {
  original = await loadSettings(admin);
  originalSecurity = (await admin.from("platform_settings").select("value").eq("key", "security").single()).data?.value;
});

afterAll(async () => {
  await admin.from("platform_settings").update({ value: originalSecurity as never }).eq("key", "security");
  for (const id of campaigns) await admin.from("outreach_campaigns").delete().eq("id", id);
  await admin.from("outreach_prospects").delete().like("name", `${T}%`);
  await admin.from("companies").delete().like("name", `${T}%`);
  const restore: Partial<OutreachSettings> = { ...original };
  delete restore.id;
  delete restore.updated_at;
  delete restore.updated_by;
  await admin.from("outreach_settings").update(restore).eq("id", true);
  await cleanup();
});

describe("Double authentification des administrateurs, aussi dans la base", () => {
  it("exigée : une session sans double authentification n'a plus les droits d'administration", async () => {
    const a = await user("audit-admin", "ADMIN");
    await admin.from("platform_settings").update({ value: { admin_mfa_required: false } }).eq("key", "security");
    expect((await a.client.rpc("admin_audience_stats", { p_days: 1 })).error).toBeNull();
    await admin.from("platform_settings").update({ value: { admin_mfa_required: true } }).eq("key", "security");
    const denied = await a.client.rpc("admin_audience_stats", { p_days: 1 });
    expect(denied.error?.code).toBe("42501");
    // Changer le réglage directement par l'API est refusé aussi
    const { error } = await a.client.rpc("admin_update_setting", { p_key: "security", p_value: { admin_mfa_required: false } });
    expect(error).not.toBeNull();
    expect((await admin.from("platform_settings").select("value").eq("key", "security").single()).data?.value).toMatchObject({ admin_mfa_required: true });
  });
});

describe("Besoin publié modifié : retour en validation", () => {
  it("prestations, critères ou mots-clés modifiés → validation à nouveau", async () => {
    const u = await user("audit-owner");
    const companyId = await company(u.client, `${T} Acheteur`);
    const { data: opp, error } = await admin
      .from("opportunities")
      .insert({ type: "NEED", origin: "INTERNAL", status: "PUBLISHED", visibility: "PUBLIC", company_id: companyId, created_by: u.id, title: `${T} Besoin publié`, description: "Description du besoin suffisamment longue pour le test." })
      .select("id")
      .single();
    if (error) throw error;
    const { error: e2 } = await u.client.from("opportunities").update({ services: "Nouvelle prestation non vérifiée" }).eq("id", opp.id);
    expect(e2).toBeNull();
    expect((await admin.from("opportunities").select("status").eq("id", opp.id).single()).data?.status).toBe("PENDING_REVIEW");
  });
});

describe("Comptes d'opportunités ouvertes (plan du site, pages régions)", () => {
  it("seules les opportunités visibles par un visiteur sont comptées", async () => {
    const count = async () => ((await admin.rpc("open_opportunity_counts")).data ?? []).find((c) => c.dimension === "department" && c.key === "976")?.n ?? 0;
    const before = await count();
    const base = { type: "PUBLIC_TENDER" as const, origin: "EXTERNAL" as const, status: "PUBLISHED" as const, description: "Avis de test suffisamment long.", department_code: "976", region: "Mayotte", response_deadline: new Date(Date.now() + 20 * 86_400_000).toISOString(), published_at: new Date().toISOString() };
    const { error } = await admin.from("opportunities").insert([
      { ...base, title: `${T} Publique`, visibility: "PUBLIC" },
      { ...base, title: `${T} Réservée aux membres`, visibility: "MEMBERS_ONLY" },
    ]);
    if (error) throw error;
    expect(await count()).toBe(before + 1);
  });
});

describe("File d'envoi Outreach : contrôles avant chaque envoi", () => {
  async function prospect(key: string, email: string, sirenValue = siren()) {
    const { data, error } = await admin.from("outreach_prospects").insert({ name: `${T} ${key}`, siren: sirenValue, source: "Test d'intégration", email, email_source: "Test", naf_code: "43.21A", department_code: "29", region: "Bretagne" }).select("id").single();
    if (error) throw error;
    return data.id;
  }
  async function campaign(dryRun: boolean) {
    const { data, error } = await admin.from("outreach_campaigns").insert({ campaign_date: DATE, kind: "MANUAL", status: "VALIDATED", dry_run: dryRun, min_score: 70, subject_template: "s", intro_template: "Introduction de test assez longue." }).select("id").single();
    if (error) throw error;
    campaigns.push(data.id);
    return data.id;
  }
  async function recipient(campaignId: string, prospectId: string, email: string, oppId: string, extra: Record<string, unknown> = {}) {
    const { data, error } = await admin.from("outreach_recipients").insert({ campaign_id: campaignId, prospect_id: prospectId, email, score: 80, reasons: [], status: "PENDING", ...extra }).select("id").single();
    if (error) throw error;
    await admin.from("outreach_recipient_opportunities").insert({ recipient_id: data.id, opportunity_id: oppId, score: 80, reasons: [], position: 0 });
    return data.id;
  }
  const status = async (id: string) => (await admin.from("outreach_recipients").select("status").eq("id", id).single()).data?.status;
  let oppId = "";

  beforeAll(async () => {
    await admin.from("outreach_settings").update({ dry_run: true, total_daily_send_cap: 1000, hourly_send_cap: 1000, daily_send_cap: 1000, send_interval_seconds: 0, min_days_between_contacts: 7 }).eq("id", true);
    const { data, error } = await admin
      .from("opportunities")
      .insert({ type: "PUBLIC_TENDER", origin: "EXTERNAL", status: "PUBLISHED", visibility: "PUBLIC", title: `${T} Travaux électriques`, description: "Remplacement des tableaux électriques.", department_code: "29", region: "Bretagne", response_deadline: new Date(Date.now() + 20 * 86_400_000).toISOString(), published_at: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    oppId = data.id;
  });

  it("campagne réelle alors que l'envoi réel est suspendu : rien n'est « simulé », tout reste en file", async () => {
    const c = await campaign(false);
    const r = await recipient(c, await prospect("reel", `reel-${RUN}@example.test`), `reel-${RUN}@example.test`, oppId);
    const res = await processSendQueue(admin, { deadline: Date.now() + 10_000, sleep: async () => {} });
    expect(res.stopped).toMatch(/suspendu/);
    expect(await status(r)).toBe("PENDING");
    expect((await admin.from("outreach_campaigns").select("status").eq("id", c).single()).data?.status).not.toBe("SIMULATED");
    await admin.from("outreach_campaigns").update({ status: "CANCELLED" }).eq("id", c);
  });

  it("même adresse e-mail déjà contactée via une autre entreprise : pas de second e-mail", async () => {
    const shared = `groupe-${RUN}@example.test`;
    const older = await campaign(true);
    await recipient(older, await prospect("filiale-a", shared), shared, oppId, { status: "SENT", sent_at: new Date(Date.now() - 2 * 86_400_000).toISOString() });
    const c = await campaign(true);
    const r = await recipient(c, await prospect("filiale-b", shared), shared, oppId);
    await processSendQueue(admin, { deadline: Date.now() + 10_000, sleep: async () => {} });
    expect(await status(r)).toBe("FREQUENCY");
  });

  it("entreprise devenue utilisatrice entre la préparation et l'envoi : jamais contactée", async () => {
    const s = siren();
    const u = await user("audit-client");
    const companyId = await company(u.client, `${T} Client`);
    await admin.from("companies").update({ siren: s }).eq("id", companyId);
    const c = await campaign(true);
    const r = await recipient(c, await prospect("client", `client-${RUN}@example.test`, s), `client-${RUN}@example.test`, oppId);
    await processSendQueue(admin, { deadline: Date.now() + 10_000, sleep: async () => {} });
    expect(await status(r)).toBe("SUPPRESSED");
  });
});
