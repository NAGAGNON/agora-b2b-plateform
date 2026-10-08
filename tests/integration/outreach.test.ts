/**
 * LinkProB2B Outreach, de bout en bout sur la base locale :
 * nouvelles opportunités → états (nouvelle / expirée / modifiée) → correspondances
 * et scores → regroupement par entreprise → garde-fous (liste d'exclusion,
 * fréquence, absence d'e-mail) → simulation d'envoi → suivi (ouverture, clic,
 * landing, inscription) → désinscription ; et cloisonnement des données (RLS).
 */
import { randomInt } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, RUN, user } from "./helpers";
import { buildDailyCampaign, enrichCampaignAndSend, enrichmentReport, processSendQueue, syncOpportunityStates } from "@/lib/outreach/pipeline";
import { loadSettings, type OutreachSettings } from "@/lib/outreach/data";
import { recipientToken } from "@/lib/outreach/token";
import { trackSignupReferral } from "@/lib/outreach/tracking";
import { GET as click } from "@/app/api/outreach/c/[token]/route";
import { GET as access } from "@/app/api/outreach/acces/[token]/route";
import { GET as pixel } from "@/app/api/outreach/o/[token]/route";
import { POST as oneClick } from "@/app/api/outreach/unsubscribe/[token]/route";

const T = `IT ${RUN}`;
const DATE = `2090-${String(randomInt(1, 13)).padStart(2, "0")}-${String(randomInt(1, 29)).padStart(2, "0")}`;
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
const siren = () => String(randomInt(100_000_000, 999_999_999));
let original: OutreachSettings;
let campaignId: string;
const O: Record<string, string> = {};
const P: Record<string, string> = {};

async function opportunity(key: string, title: string, description: string, sector: string, dept: string, region: string, deadlineDays: number) {
  const { data, error } = await admin
    .from("opportunities")
    .insert({ type: "PUBLIC_TENDER", origin: "EXTERNAL", status: "PUBLISHED", visibility: "PUBLIC", title: `${T} ${title}`, description, sector_slug: sector, department_code: dept, region, response_deadline: inDays(deadlineDays), published_at: new Date().toISOString(), external_buyer_name: `Commune ${T}` })
    .select("id")
    .single();
  if (error) throw error;
  O[key] = data.id;
}

async function prospect(key: string, row: { naf_code: string; department_code: string; region: string; email?: string | null; last_contacted_at?: string }) {
  const { data, error } = await admin
    .from("outreach_prospects")
    .insert({ name: `${T} ${key}`, siren: siren(), source: "Test d'intégration", email: row.email ?? null, email_source: row.email ? "Test" : null, naf_code: row.naf_code, department_code: row.department_code, region: row.region, last_contacted_at: row.last_contacted_at ?? null })
    .select("id")
    .single();
  if (error) throw error;
  P[key] = data.id;
}

const recipient = async (key: string) => (await admin.from("outreach_recipients").select("*, items:outreach_recipient_opportunities(opportunity_id)").eq("campaign_id", campaignId).eq("prospect_id", P[key]).maybeSingle()).data;
const ctx = (token: string) => ({ params: Promise.resolve({ token }) });

beforeAll(async () => {
  original = await loadSettings(admin);
  await admin.from("outreach_settings").update({ discovery_enabled: false, dry_run: true, require_validation: true, min_score: 70, max_opportunities_per_email: 6, min_days_before_deadline: 3, lookback_days: 2, min_days_between_contacts: 7, daily_send_cap: 1000 }).eq("id", true);
  await opportunity("elec1", "Travaux d'installation électrique de l'école", "Remplacement des tableaux électriques et de l'éclairage de l'école communale.", "electricite-automatisme", "29", "Bretagne", 20);
  await opportunity("elec2", "Rénovation de l'éclairage du gymnase", "Fourniture et pose de luminaires LED, travaux d'électricité associés.", "electricite-automatisme", "29", "Bretagne", 25);
  await opportunity("clean", "Nettoyage des locaux de la mairie", "Entretien des locaux, vitrerie et nettoyage courant des bâtiments communaux.", "nettoyage-proprete", "35", "Bretagne", 30);
  await opportunity("soon", "Travaux d'électricité urgents", "Remise en conformité électrique d'un local technique municipal.", "electricite-automatisme", "29", "Bretagne", 1);
  await prospect("elecA", { naf_code: "43.21A", department_code: "29", region: "Bretagne", email: `eleca-${RUN}@example.test` });
  await prospect("elecNoMail", { naf_code: "43.21A", department_code: "29", region: "Bretagne" });
  await prospect("cleanB", { naf_code: "81.21Z", department_code: "35", region: "Bretagne", email: `cleanb-${RUN}@example.test` });
  await prospect("elecFar", { naf_code: "43.21A", department_code: "13", region: "Provence-Alpes-Côte d'Azur", email: `far-${RUN}@example.test` });
  await prospect("elecBlocked", { naf_code: "43.21A", department_code: "29", region: "Bretagne", email: `blocked-${RUN}@example.test` });
  await prospect("elecRecent", { naf_code: "43.21A", department_code: "29", region: "Bretagne", email: `recent-${RUN}@example.test`, last_contacted_at: inDays(-1) });
  await admin.from("outreach_suppressions").insert({ kind: "EMAIL", value: `blocked-${RUN}@example.test`, reason: "MANUAL" });
});

afterAll(async () => {
  if (campaignId) await admin.from("outreach_campaigns").delete().eq("id", campaignId);
  await admin.from("outreach_prospects").delete().like("name", `${T}%`);
  await admin.from("outreach_suppressions").delete().like("value", `%-${RUN}@example.test`);
  const restore: Partial<OutreachSettings> = { ...original };
  delete restore.id;
  delete restore.updated_at;
  delete restore.updated_by;
  await admin.from("outreach_settings").update(restore).eq("id", true);
  await cleanup();
});

describe("Outreach — détection et campagne", () => {
  it("synchronise : nouvelles opportunités, et échéance trop proche = expirée (jamais proposée)", async () => {
    await syncOpportunityStates(admin, await loadSettings(admin));
    const { data } = await admin.from("outreach_opportunity_states").select("opportunity_id, status").in("opportunity_id", Object.values(O));
    const st = Object.fromEntries((data ?? []).map((s) => [s.opportunity_id, s.status]));
    expect(st[O.elec1]).toBe("NEW");
    expect(st[O.clean]).toBe("NEW");
    expect(st[O.soon]).toBe("EXPIRED");
  });

  it("prépare la campagne : correspondances pertinentes, un e-mail par entreprise", async () => {
    const r = await buildDailyCampaign(admin, { date: DATE, force: true });
    campaignId = r.campaignId!;
    const { data: c } = await admin.from("outreach_campaigns").select("status, stats").eq("id", campaignId).single();
    expect(c?.status).toBe("READY");
    const a = await recipient("elecA");
    expect(a?.status).toBe("PENDING");
    expect(a?.score).toBeGreaterThanOrEqual(70);
    expect((a?.items ?? []).map((i: { opportunity_id: string }) => i.opportunity_id).sort()).toEqual([O.elec1, O.elec2].sort());
    expect((await recipient("cleanB"))?.items.map((i: { opportunity_id: string }) => i.opportunity_id)).toEqual([O.clean]);
    const { data: soonLinks } = await admin.from("outreach_recipient_opportunities").select("recipient_id").eq("opportunity_id", O.soon);
    expect(soonLinks).toEqual([]);
  });

  it("garde-fous : sans e-mail, liste d'exclusion, fréquence, hors zone", async () => {
    expect((await recipient("elecNoMail"))?.status).toBe("NO_EMAIL");
    expect((await recipient("elecBlocked"))?.status).toBe("SUPPRESSED");
    expect((await recipient("elecRecent"))?.status).toBe("FREQUENCY");
    expect(await recipient("elecFar")).toBeNull();
  });

  it("les données de prospection sont invisibles hors administrateurs (RLS)", async () => {
    const { data: a } = await anon().from("outreach_prospects").select("id").in("id", Object.values(P));
    expect(a ?? []).toEqual([]);
    const u = await user("outreach-user");
    const { data: b } = await u.client.from("outreach_recipients").select("id").eq("campaign_id", campaignId);
    expect(b ?? []).toEqual([]);
    const { error } = await u.client.from("outreach_settings").update({ dry_run: false }).eq("id", true);
    expect((await loadSettings(admin)).dry_run).toBe(true);
    void error;
    const adm = await user("outreach-admin", "ADMIN");
    const { data: c } = await adm.client.from("outreach_recipients").select("id").eq("campaign_id", campaignId);
    expect((c ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe("Outreach — recherche des adresses", () => {
  it("sans clé de recherche : non lancée, raison écrite dans le rapport de la campagne", async () => {
    const saved = { brave: process.env.BRAVE_SEARCH_API_KEY, drop: process.env.DROPCONTACT_API_KEY };
    delete process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.DROPCONTACT_API_KEY;
    try {
      const r = await enrichCampaignAndSend(admin, { campaignId, deadline: Date.now() + 20_000 });
      expect(r.enrichment.searched).toBe(0);
      const { data: c } = await admin.from("outreach_campaigns").select("report").eq("id", campaignId).single();
      expect(c?.report).toContain("Recherche d'adresses e-mail : non lancée");
      expect((await recipient("elecNoMail"))?.status).toBe("NO_EMAIL");
    } finally {
      if (saved.brave) process.env.BRAVE_SEARCH_API_KEY = saved.brave;
      if (saved.drop) process.env.DROPCONTACT_API_KEY = saved.drop;
    }
  });

  it("rapport lisible des résultats", () => {
    expect(enrichmentReport({ searched: 10, found: 4, no_website: 3, no_email: 2, blocked: 1, errors: 0, skipped: null })).toBe(
      "Recherche d'adresses e-mail : 10 entreprise(s) recherchée(s), 4 adresse(s) trouvée(s) ; 3 sans site identifié, 2 sans adresse générique publiée, 1 site(s) refusant l'exploration, 0 erreur(s).",
    );
  });
});

describe("Outreach — campagnes lancées à la main", () => {
  const manualIds: string[] = [];
  afterAll(async () => {
    if (manualIds.length) await admin.from("outreach_campaigns").delete().in("id", manualIds);
  });

  it("plusieurs fois dans la journée, sans toucher à la campagne automatique ni à ses opportunités", async () => {
    const before = (await admin.from("outreach_opportunity_states").select("status, last_campaign_id").eq("opportunity_id", O.elec1).single()).data;
    expect(before?.status).toBe("PROCESSED");
    for (let i = 0; i < 2; i++) {
      const r = await buildDailyCampaign(admin, { manual: { userId: null } });
      manualIds.push(r.campaignId!);
      const { data: c } = await admin.from("outreach_campaigns").select("kind, status, report").eq("id", r.campaignId!).single();
      expect(c?.kind).toBe("MANUAL");
      expect(c?.status).toBe("READY");
      expect(c?.report).toContain("Campagne manuelle");
      // Les opportunités récentes déjà traitées par la campagne automatique sont reprises…
      const { data: rec } = await admin.from("outreach_recipients").select("status").eq("campaign_id", r.campaignId!).eq("prospect_id", P.elecA).single();
      expect(rec?.status).toBe("PENDING");
      // …avec les mêmes garde-fous (liste d'exclusion, fréquence)
      expect((await admin.from("outreach_recipients").select("status").eq("campaign_id", r.campaignId!).eq("prospect_id", P.elecBlocked).single()).data?.status).toBe("SUPPRESSED");
      expect((await admin.from("outreach_recipients").select("status").eq("campaign_id", r.campaignId!).eq("prospect_id", P.elecRecent).single()).data?.status).toBe("FREQUENCY");
    }
    expect(new Set(manualIds).size).toBe(2);
    const after = (await admin.from("outreach_opportunity_states").select("status, last_campaign_id").eq("opportunity_id", O.elec1).single()).data;
    expect(after).toEqual(before);
    const { data: auto } = await admin.from("outreach_campaigns").select("kind, status").eq("id", campaignId).single();
    expect(auto).toEqual({ kind: "AUTO", status: "READY" });
    // La campagne automatique du jour reste unique
    const again = await buildDailyCampaign(admin, { date: DATE });
    expect(again.campaignId).toBe(campaignId);
  });

  it("les envois manuels ne consomment pas la limite quotidienne de la campagne automatique", async () => {
    await admin.from("outreach_settings").update({ daily_send_cap: 0 }).eq("id", true);
    try {
      await admin.from("outreach_campaigns").update({ status: "VALIDATED", dry_run: true }).eq("id", manualIds[0]);
      const r = await processSendQueue(admin, { deadline: Date.now() + 30_000 });
      expect(r.simulated).toBeGreaterThanOrEqual(1);
      expect((await admin.from("outreach_recipients").select("status").eq("campaign_id", manualIds[0]).eq("prospect_id", P.elecA).single()).data?.status).toBe("SIMULATED");
      expect((await recipient("elecA"))?.status).toBe("PENDING");
    } finally {
      await admin.from("outreach_settings").update({ daily_send_cap: 1000 }).eq("id", true);
    }
  });
});

describe("Outreach — envoi simulé et suivi", () => {
  it("automatique : la campagne préparée part sans validation (ici en simulation, statut « simulé »)", async () => {
    await admin.from("outreach_campaigns").update({ dry_run: true }).eq("id", campaignId);
    await admin.from("outreach_settings").update({ require_validation: false }).eq("id", true);
    const saved = { brave: process.env.BRAVE_SEARCH_API_KEY, drop: process.env.DROPCONTACT_API_KEY };
    delete process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.DROPCONTACT_API_KEY;
    let r: Awaited<ReturnType<typeof processSendQueue>>;
    try {
      r = (await enrichCampaignAndSend(admin, { campaignId, deadline: Date.now() + 20_000 })).send;
    } finally {
      if (saved.brave) process.env.BRAVE_SEARCH_API_KEY = saved.brave;
      if (saved.drop) process.env.DROPCONTACT_API_KEY = saved.drop;
    }
    expect(r.sent).toBe(0);
    expect(r.simulated).toBeGreaterThanOrEqual(2);
    const { data: c } = await admin.from("outreach_campaigns").select("status, validated_at").eq("id", campaignId).single();
    expect(c?.status).toBe("SIMULATED");
    expect(c?.validated_at).not.toBeNull();
    expect((await recipient("elecA"))?.status).toBe("SIMULATED");
    expect((await recipient("elecNoMail"))?.status).toBe("NO_EMAIL");
  });

  it("ouverture, clic sur une opportunité de la sélection, pas de redirection ouverte", async () => {
    const a = (await recipient("elecA"))!;
    const t = recipientToken(a.id);
    await pixel(new Request("http://x"), ctx(t));
    const ok = await click(new Request(`http://x?o=${O.elec1}`), ctx(t));
    expect(ok.headers.get("location")).toContain(`/opportunites/${O.elec1}`);
    // Cookie du parcours (jeton signé, httpOnly) : la fiche sera servie derrière la page d'accès
    expect(ok.headers.get("set-cookie")).toMatch(new RegExp(`lp_prospection=${t.replace(/[.]/g, "\\.")};.*HttpOnly`, "i"));
    const foreign = await click(new Request(`http://x?o=${O.clean}`), ctx(t));
    expect(foreign.headers.get("location")).toContain(`/opportunites/selection/${t}`);
    const forged = await click(new Request("http://x"), ctx(`${t.slice(0, -2)}xx`));
    expect(forged.headers.get("location")).not.toContain("selection");
    const after = (await recipient("elecA"))!;
    expect(after.opened_at).not.toBeNull();
    expect(after.clicked_at).not.toBeNull();
    // Le clic seul n'est plus une consultation de l'offre (accès après inscription ou connexion)
    const { data: clicks } = await admin.from("outreach_events").select("opportunity_id").eq("recipient_id", a.id).eq("type", "CLICK");
    expect((clicks ?? []).map((c) => c.opportunity_id)).toContain(O.elec1);
  });

  it("page d'accès : « Créer mon compte » / « Se connecter » comptés, retour prévu vers l'offre", async () => {
    const a = (await recipient("elecA"))!;
    const t = recipientToken(a.id);
    const signup = new URL((await access(new Request(`http://x/api/outreach/acces/${t}?o=${O.elec1}&a=inscription`), ctx(t))).headers.get("location")!);
    expect(signup.pathname).toBe("/inscription");
    expect(signup.searchParams.get("suite")).toBe(`/opportunites/${O.elec1}`);
    expect(signup.searchParams.get("ref")).toBe(`o.${t}`);
    const login = new URL((await access(new Request(`http://x/api/outreach/acces/${t}?o=${O.elec1}&a=connexion`), ctx(t))).headers.get("location")!);
    expect(login.pathname).toBe("/connexion");
    // Paramètre détourné : jamais de redirection hors du site, retour sur la sélection
    const odd = new URL((await access(new Request(`http://x/api/outreach/acces/${t}?o=https://evil.test`), ctx(t))).headers.get("location")!);
    expect(odd.host).toBe("x");
    expect(odd.searchParams.get("suite")).toBe(`/opportunites/selection/${t}`);
    const after = (await recipient("elecA"))!;
    expect(after.signup_clicked_at).not.toBeNull();
    expect(after.login_clicked_at).not.toBeNull();
  });

  it("inscription attribuée à la sélection (jeton signé)", async () => {
    const a = (await recipient("elecA"))!;
    await trackSignupReferral(`o.${recipientToken(a.id)}`, null);
    await trackSignupReferral("o.faux", null);
    expect((await recipient("elecA"))?.signed_up_at).not.toBeNull();
  });

  it("désinscription en un clic : liste globale d'exclusion et « Ne plus contacter »", async () => {
    const b = (await recipient("cleanB"))!;
    const res = await oneClick(new Request("http://x", { method: "POST" }), ctx(recipientToken(b.id)));
    expect(res.status).toBe(200);
    const { data: s } = await admin.from("outreach_suppressions").select("reason").eq("kind", "EMAIL").eq("value", `cleanb-${RUN}@example.test`).single();
    expect(s?.reason).toBe("UNSUBSCRIBE");
    const { data: p } = await admin.from("outreach_prospects").select("status").eq("id", P.cleanB).single();
    expect(p?.status).toBe("DO_NOT_CONTACT");
    expect((await recipient("cleanB"))?.unsubscribed_at).not.toBeNull();
  });

  it("opportunité modifiée après traitement, puis expirée une fois clôturée", async () => {
    await admin.from("opportunities").update({ title: `${T} Travaux d'installation électrique de l'école (lot 2)` }).eq("id", O.elec1);
    await syncOpportunityStates(admin, await loadSettings(admin));
    expect((await admin.from("outreach_opportunity_states").select("status").eq("opportunity_id", O.elec1).single()).data?.status).toBe("MODIFIED");
    await admin.from("opportunities").update({ status: "CLOSED" }).eq("id", O.elec2);
    await syncOpportunityStates(admin, await loadSettings(admin));
    expect((await admin.from("outreach_opportunity_states").select("status").eq("opportunity_id", O.elec2).single()).data?.status).toBe("EXPIRED");
  });
});
