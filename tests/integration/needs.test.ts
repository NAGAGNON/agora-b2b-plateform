/**
 * Mise en relation automatique d'un besoin publié, de bout en bout sur la base locale :
 * analyse → entreprises inscrites correspondantes (score, exclusions, fréquence) → notification →
 * campagne de prospection dédiée (exclusions, e-mail « ENVOYER UN MESSAGE ») → envoi simulé →
 * clic → suivi (vues, réponses) → relance unique → second besoin repris automatiquement.
 */
import { randomInt } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, company, RUN, user } from "./helpers";
import { needMetrics, processNeedCampaigns, remindMembers, runNeedCampaign, type NeedAnalysis } from "@/lib/needs";
import { buildEmail, loadRecipientBundles, loadReferentials, loadSettings, type OutreachSettings } from "@/lib/outreach/data";
import { processSendQueue } from "@/lib/outreach/pipeline";
import { recipientToken } from "@/lib/outreach/token";
import { GET as click } from "@/app/api/outreach/c/[token]/route";

const T = `IT ${RUN}`;
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
const siren = () => String(randomInt(100_000_000, 999_999_999));
let original: OutreachSettings;
const C: Record<string, string> = {};
const U: Record<string, Awaited<ReturnType<typeof user>>> = {};
const P: Record<string, string> = {};
let needId = "";
let secondId = "";
let otherCampaign = "";

async function need(title: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await admin
    .from("opportunities")
    .insert({
      type: "PRIVATE_TENDER",
      origin: "INTERNAL",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      company_id: C.buyer,
      title: `${T} ${title}`,
      summary: "Maintenance préventive et dépannage de compresseurs d'air sur notre site de Brest.",
      description: "Nous recherchons une entreprise de maintenance industrielle pour l'entretien préventif et le dépannage de trois compresseurs d'air et du réseau hydraulique associé.",
      sector_slug: "maintenance-industrielle",
      skills: ["hydraulique", "compresseurs"],
      city: "Brest",
      department_code: "29",
      region: "Bretagne",
      budget_min: 8000,
      budget_max: 12000,
      criteria: "Délai d'intervention sous 24 h",
      response_deadline: inDays(20),
      published_at: new Date().toISOString(),
      ...extra,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function member(key: string, kind: "SUPPLIER" | "BUYER" | "BOTH" = "BOTH", profile?: { sectors: string[]; skills: string[] }) {
  U[key] = await user(`need-${key}`);
  C[key] = await company(U[key].client, `need ${key}`, kind);
  if (profile) await admin.from("company_profiles").update(profile).eq("company_id", C[key]);
}

async function prospect(key: string, email: string | null) {
  const { data, error } = await admin
    .from("outreach_prospects")
    .insert({ name: `${T} ${key}`, siren: siren(), source: "Test d'intégration", email, email_source: email ? "Test" : null, naf_code: "33.12Z", naf_label: "Réparation de machines et équipements mécaniques", department_code: "29", region: "Bretagne" })
    .select("id")
    .single();
  if (error) throw error;
  P[key] = data.id;
}

beforeAll(async () => {
  original = await loadSettings(admin);
  await admin.from("outreach_settings").update({ discovery_enabled: false, dry_run: true, require_validation: false, min_score: 40, min_days_between_contacts: 7, daily_send_cap: 1000, total_daily_send_cap: 1000, hourly_send_cap: 1000, send_interval_seconds: 0 }).eq("id", true);
  await member("buyer");
  await member("match");
  await member("match2");
  await member("busy");
  await member("other", "BOTH", { sectors: ["informatique"], skills: ["java"] });
  await member("buyerOnly", "BUYER");
  // « busy » a reçu un autre besoin hier : pas de nouvelle proposition avant 2 jours
  const other = await need("Autre besoin déjà proposé");
  const { data: nc } = await admin.from("need_campaigns").insert({ opportunity_id: other, status: "RUNNING" }).select("id").single();
  otherCampaign = nc!.id;
  await admin.from("need_matches").insert({ need_campaign_id: nc!.id, opportunity_id: other, company_id: C.busy, score: 80, status: "NOTIFIED", notified_at: inDays(-1) });
  await prospect("pA", `pa-${RUN}@example.test`);
  await prospect("pBlocked", `pblocked-${RUN}@example.test`);
  await admin.from("outreach_suppressions").insert({ kind: "EMAIL", value: `pblocked-${RUN}@example.test`, reason: "MANUAL" });
  needId = await need("Maintenance de compresseurs d'air");
});

afterAll(async () => {
  await admin.from("outreach_campaigns").delete().eq("kind", "NEED").in("opportunity_id", [needId, secondId].filter(Boolean));
  await admin.from("need_campaigns").delete().eq("id", otherCampaign);
  await admin.from("outreach_prospects").delete().like("name", `${T}%`);
  await admin.from("outreach_suppressions").delete().like("value", `%-${RUN}@example.test`);
  const restore: Partial<OutreachSettings> = { ...original };
  delete restore.id;
  delete restore.updated_at;
  delete restore.updated_by;
  await admin.from("outreach_settings").update(restore).eq("id", true);
  await cleanup();
});

describe("Mise en relation d'un besoin publié", () => {
  it("analyse : secteur, compétences, zone, budget, critères, métiers ciblés", async () => {
    const r = await runNeedCampaign(admin, needId, { deadline: Date.now() + 60_000 });
    expect(r.status).toBe("RUNNING");
    const { data: nc } = await admin.from("need_campaigns").select("analysis, status, members_notified").eq("opportunity_id", needId).single();
    const a = nc!.analysis as unknown as NeedAnalysis;
    expect(a.sector).toBe("maintenance-industrielle");
    expect(a.skills).toContain("hydraulique");
    expect(a.zone.department).toBe("29");
    expect(a.budget).toMatch(/^8\s000 € à 12\s000 €$/);
    expect(a.criteria).toBe("Délai d'intervention sous 24 h");
    expect(a.naf).toContain("33.12Z");
  });

  it("entreprises inscrites : correspondantes prévenues avec les raisons ; autre métier, acheteur seul, publieur et fréquence exclus", async () => {
    const { data: matches } = await admin.from("need_matches").select("company_id, status, score, reasons, skip_reason").eq("opportunity_id", needId);
    const by = new Map((matches ?? []).map((m) => [m.company_id, m]));
    expect(by.get(C.match)?.status).toBe("NOTIFIED");
    expect(by.get(C.match)?.reasons).toContain("Même secteur d'activité");
    expect(by.get(C.match2)?.status).toBe("NOTIFIED");
    expect(by.get(C.busy)?.status).toBe("SKIPPED");
    expect(by.has(C.other)).toBe(false);
    expect(by.has(C.buyerOnly)).toBe(false);
    expect(by.has(C.buyer)).toBe(false);
    const { data: notes } = await admin.from("notifications").select("type, link, title").eq("user_id", U.match.id).eq("type", "need_match");
    expect(notes).toHaveLength(1);
    expect(notes![0].link).toBe(`/opportunites/${needId}?message=1`);
    const { count: mails } = await admin.from("email_outbox").select("id", { count: "exact", head: true }).eq("user_id", U.match.id).eq("template", "notification");
    expect(mails).toBeGreaterThanOrEqual(1);
  });

  it("idempotent : relancé, aucune notification en double ni seconde campagne de prospection", async () => {
    await runNeedCampaign(admin, needId, { deadline: Date.now() + 60_000 });
    const { count } = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", U.match.id).eq("type", "need_match");
    expect(count).toBe(1);
    const { count: camps } = await admin.from("outreach_campaigns").select("id", { count: "exact", head: true }).eq("kind", "NEED").eq("opportunity_id", needId);
    expect(camps).toBe(1);
  });

  it("prospection dédiée : entreprise pertinente retenue, liste d'opposition respectée, e-mail « ENVOYER UN MESSAGE » vers le besoin", async () => {
    const { data: camp } = await admin.from("outreach_campaigns").select("id, status, kind").eq("kind", "NEED").eq("opportunity_id", needId).single();
    const { data: recs } = await admin.from("outreach_recipients").select("id, prospect_id, status").eq("campaign_id", camp!.id);
    const a = recs!.find((r) => r.prospect_id === P.pA)!;
    expect(["PENDING", "QUEUED", "SIMULATED"]).toContain(a.status);
    expect(recs!.find((r) => r.prospect_id === P.pBlocked)?.status).toBe("SUPPRESSED");
    const [bundle] = await loadRecipientBundles(admin, [a.id]);
    const mail = buildEmail(bundle, await loadReferentials(admin), { withPixel: false });
    expect(mail.subject).toContain("Maintenance de compresseurs");
    expect(mail.html).toContain("ENVOYER UN MESSAGE");
    expect(mail.html).toMatch(/Budget indiqué : <strong[^>]*>8\s000 € à 12\s000 €/);
    expect(mail.html).toContain(`?o=${needId}&amp;m=1`);
    expect(mail.text).toContain("Ne plus recevoir");
    expect(mail.html).not.toMatch(/\bIA\b|intelligence artificielle/);
  });

  it("envoi (simulation) puis clic « ENVOYER UN MESSAGE » : la fiche s'ouvre sur le formulaire de message", async () => {
    await processSendQueue(admin, { deadline: Date.now() + 20_000, sleep: async () => {} });
    const { data: camp } = await admin.from("outreach_campaigns").select("id").eq("kind", "NEED").eq("opportunity_id", needId).single();
    const { data: r } = await admin.from("outreach_recipients").select("id, status").eq("campaign_id", camp!.id).eq("prospect_id", P.pA).single();
    expect(r!.status).toBe("SIMULATED");
    const res = await click(new Request(`http://localhost/api/outreach/c/${recipientToken(r!.id)}?o=${needId}&m=1`), { params: Promise.resolve({ token: recipientToken(r!.id) }) });
    expect(res.headers.get("location")).toContain(`/opportunites/${needId}?message=1&`);
  });

  it("complément quotidien : de nouvelles entreprises chaque jour, dans la limite du quota par besoin", async () => {
    await prospect("pC", `pc-${RUN}@example.test`);
    await prospect("pD", `pd-${RUN}@example.test`);
    await admin.from("outreach_settings").update({ need_daily_send_cap: 1 }).eq("id", true);
    const { data: camp } = await admin.from("outreach_campaigns").select("id").eq("kind", "NEED").eq("opportunity_id", needId).single();
    const count = async () => ((await admin.from("outreach_recipients").select("prospect_id").eq("campaign_id", camp!.id)).data ?? []).map((r) => r.prospect_id);
    const before = await count();
    // Même jour : entreprises du jour déjà ajoutées
    const same = await runNeedCampaign(admin, needId, { deadline: Date.now() + 60_000 });
    expect(same.prospects?.skipped).toBe("Entreprises du jour déjà ajoutées");
    expect(await count()).toHaveLength(before.length);
    // Lendemain : une seule nouvelle entreprise (quota de 1), jamais une entreprise déjà contactée pour ce besoin
    await runNeedCampaign(admin, needId, { now: new Date(Date.now() + 86_400_000), deadline: Date.now() + 60_000 });
    const after = await count();
    expect(after).toHaveLength(before.length + 1);
    expect(after.filter((id) => id === P.pA)).toHaveLength(1);
    expect([P.pC, P.pD]).toContain(after.find((id) => !before.includes(id)));
    const { data: c } = await admin.from("outreach_campaigns").select("status, report").eq("id", camp!.id).single();
    // Campagne relancée puis envoyée dans la foulée (simulation dans ce test)
    expect(["VALIDATED", "SENDING", "SIMULATED"]).toContain(c!.status);
    const { data: added } = await admin.from("outreach_recipients").select("status").eq("campaign_id", camp!.id).eq("prospect_id", after.find((id) => !before.includes(id))!).single();
    expect(added!.status).toBe("SIMULATED");
    expect(c!.report).toContain("jusqu'à 1 entreprises par jour");
    await admin.from("outreach_settings").update({ need_daily_send_cap: 150 }).eq("id", true);
  });

  it("suivi : chiffres réels (vues, prévenues, e-mails simulés distingués des envois réels, réponses)", async () => {
    await admin.from("analytics_events").insert({ event_name: "view_opportunity", properties: { opportunity_id: needId } });
    await admin.from("analytics_events").insert({ event_name: "need_message_click", properties: { opportunity_id: needId } });
    const { error } = await U.match.client.rpc("express_interest", { p_opportunity_id: needId, p_company_id: C.match, p_message: "Nous pouvons intervenir sous 24 h sur Brest." });
    expect(error).toBeNull();
    const m = await needMetrics(admin, needId);
    expect(m.views).toBe(1);
    expect(m.messageClicks).toBe(1);
    expect(m.membersNotified).toBe(2);
    expect(m.emailsSent).toBe(0);
    expect(m.emailsSimulated).toBe(2);
    expect(m.interests).toBe(1);
  });

  it("relance unique après 5 jours : seulement les entreprises sans réponse", async () => {
    const r = await remindMembers(admin, new Date(Date.now() + 6 * 86_400_000));
    expect(r.reminded).toBeGreaterThanOrEqual(1);
    const { data } = await admin.from("need_matches").select("company_id, status").eq("opportunity_id", needId).in("company_id", [C.match, C.match2]);
    const by = new Map((data ?? []).map((d) => [d.company_id, d.status]));
    expect(by.get(C.match)).toBe("RESPONDED");
    expect(by.get(C.match2)).toBe("REMINDED");
    // Jamais deux relances
    await remindMembers(admin, new Date(Date.now() + 12 * 86_400_000));
    const { count } = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", U.match2.id).eq("type", "need_match");
    expect(count).toBe(2);
  });

  it("second besoin publié : repris automatiquement par le passage quotidien", async () => {
    secondId = await need("Dépannage d'un pont roulant", { skills: ["levage"], summary: "Dépannage et contrôle d'un pont roulant de 5 tonnes." });
    const r = await processNeedCampaigns(admin, { deadline: Date.now() + 90_000 });
    expect(r.results.some((x) => x.opportunityId === secondId && x.status === "RUNNING")).toBe(true);
    const { data: nc } = await admin.from("need_campaigns").select("status, members_identified").eq("opportunity_id", secondId).single();
    expect(nc!.status).toBe("RUNNING");
    expect(nc!.members_identified).toBeGreaterThanOrEqual(1);
  });

  it("données réservées : un utilisateur ne lit ni les campagnes ni les correspondances", async () => {
    const { data: a } = await U.match.client.from("need_matches").select("id").eq("opportunity_id", needId);
    const { data: b } = await U.match.client.from("need_campaigns").select("id").eq("opportunity_id", needId);
    expect(a ?? []).toHaveLength(0);
    expect(b ?? []).toHaveLength(0);
    expect((await U.match.client.rpc("need_member_candidates", { p_opportunity_id: needId })).error).not.toBeNull();
  });
});
