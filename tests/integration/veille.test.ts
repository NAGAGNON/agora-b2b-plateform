/**
 * Veille par e-mail sur la base réelle : destinataires éligibles (accord, adresse confirmée,
 * exclusions), préparation des éditions (critères, doublons, une veille par jour), contrôles
 * avant envoi, rebonds, désinscription et statistiques issues des événements enregistrés.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, days, RUN, user } from "./helpers";
import { buildEdition, loadAudience, previewFor, processVeilleQueue, veilleStats } from "@/lib/veille/engine";
import { unsubscribeVeille } from "@/lib/veille/tracking";
import type { VeilleMessage } from "@/lib/veille/send";

const WORD = `zq${RUN.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
const WORD2 = `zr${RUN.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
const D1 = `2092-0${(Number.parseInt(RUN.slice(0, 2), 16) % 9) + 1}-1${(Number.parseInt(RUN.slice(2, 3), 16) % 9) + 0}`;
const D2 = D1.replace(/-(\d)(\d)$/, (_, a, b) => `-2${b}`);
const settings = { enabled: true, launch_date: "2026-10-15", daily_cap: 1000 };
const opps: string[] = [];
const ids: Record<string, string> = {};
const emails: Record<string, string> = {};
let unconfirmed = "";

async function opportunity(title: string, deadlineDays = 20) {
  const { data, error } = await admin
    .from("opportunities")
    .insert({ title, description: "Avis de test suffisamment long pour la veille.", type: "PUBLIC_TENDER", origin: "EXTERNAL", status: "PUBLISHED", visibility: "PUBLIC", external_buyer_name: `Acheteur ${RUN}`, region: "Bretagne", sector_slug: "informatique", response_deadline: days(deadlineDays), published_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  const { data: boamp } = await admin.from("external_sources").select("id").eq("code", "boamp").single();
  await admin.from("opportunity_sources").insert({ opportunity_id: data.id, source_id: boamp!.id, external_id: `veille-${data.id}`, original_url: "https://www.boamp.fr/avis/detail/test", is_primary: true });
  opps.push(data.id);
  return data.id;
}

async function member(label: string, opts: { consent?: boolean; prefs?: Record<string, unknown> }) {
  const u = await user(label);
  ids[label] = u.id;
  emails[label] = u.email.toLowerCase();
  if (opts.consent) await admin.from("users").update({ marketing_consent: true }).eq("id", u.id);
  if (opts.prefs) await admin.from("veille_preferences").insert({ user_id: u.id, ...opts.prefs });
  return u;
}

beforeAll(async () => {
  for (let i = 0; i < 4; i++) await opportunity(`Infogérance ${WORD} lot ${i}`);
  await opportunity(`Infogérance ${WORD} qui expire demain`, 1);
  for (let i = 0; i < 3; i++) await opportunity(`Supervision ${WORD2} lot ${i}`);
  await member("veille-hebdo", { consent: true, prefs: { frequency: "TWICE_WEEKLY", keywords: [WORD] } });
  await member("veille-quotidien", { prefs: { frequency: "DAILY", keywords: [WORD], consent_at: new Date().toISOString(), consent_source: "test" } });
  await member("veille-sans-accord", { prefs: { frequency: "TWICE_WEEKLY", keywords: [WORD] } });
  await member("veille-exclu", { consent: true, prefs: { frequency: "TWICE_WEEKLY", keywords: [WORD] } });
  await admin.from("veille_suppressions").insert({ email: emails["veille-exclu"], reason: "UNSUBSCRIBE" });
  await member("veille-refus", { consent: true, prefs: { frequency: "NONE", keywords: [WORD] } });
  await member("veille-expire", { consent: true, prefs: { frequency: "TWICE_WEEKLY", keywords: [WORD2] } });
  const { data } = await admin.auth.admin.createUser({ email: `it-${RUN}-nonconfirme@test.linkprob2b.test`, password: `Test-${randomUUID()}-Aa1`, email_confirm: false, user_metadata: { full_name: "IT non confirmé" } });
  unconfirmed = data.user!.id;
  await admin.from("users").update({ marketing_consent: true }).eq("id", unconfirmed);
});

afterAll(async () => {
  await admin.from("veille_campaigns").delete().in("edition_date", [D1, D2]);
  await admin.from("veille_suppressions").delete().in("email", Object.values(emails));
  await admin.from("opportunities").delete().in("id", opps);
  await admin.auth.admin.deleteUser(unconfirmed);
  await cleanup();
});

describe("Destinataires éligibles", () => {
  it("accord explicite ou case « actualités », adresse confirmée, ni refus ni exclusion", async () => {
    const audience = await loadAudience(admin);
    const mine = audience.filter((m) => Object.values(ids).includes(m.user_id) || m.user_id === unconfirmed);
    expect(mine.map((m) => m.user_id).sort()).toEqual([ids["veille-hebdo"], ids["veille-quotidien"], ids["veille-expire"]].sort());
    expect(mine.find((m) => m.user_id === ids["veille-quotidien"])).toMatchObject({ frequency: "DAILY", consent: "veille" });
    expect(mine.find((m) => m.user_id === ids["veille-hebdo"])).toMatchObject({ frequency: "TWICE_WEEKLY", consent: "actualites" });
  });

  it("la base refuse la lecture des destinataires et des préférences d'autrui", async () => {
    const intruder = await user("veille-intrus");
    expect((await intruder.client.rpc("veille_audience")).error).not.toBeNull();
    expect((await intruder.client.from("veille_preferences").select("user_id").eq("user_id", ids["veille-hebdo"])).data).toEqual([]);
    expect((await intruder.client.from("veille_sends").select("id")).data).toEqual([]);
    expect((await intruder.client.from("veille_preferences").insert({ user_id: ids["veille-hebdo"], frequency: "DAILY" })).error).not.toBeNull();
  });
});

describe("Éditions, envois et désinscription", () => {
  const sent: VeilleMessage[] = [];
  const fakeSend = async (m: VeilleMessage) => {
    sent.push(m);
    return m.to === emails["veille-quotidien"] ? { status: "FAILED" as const, error: "550 5.1.1 user unknown", permanent: true } : { status: "SENT" as const };
  };

  it("lundi : sélection selon les critères, annonces qui expirent exclues, chacun sa fréquence", async () => {
    const r = await buildEdition(admin, "MONDAY", D1);
    expect(r.created).toBe(true);
    const { data } = await admin.from("veille_sends").select("user_id, opportunity_ids, personalized").eq("campaign_id", r.campaignId!);
    const hebdo = data!.find((s) => s.user_id === ids["veille-hebdo"])!;
    expect(hebdo.opportunity_ids.sort()).toEqual(opps.slice(0, 4).sort());
    expect(hebdo.personalized).toBe(true);
    expect(data!.some((s) => s.user_id === ids["veille-quotidien"])).toBe(false);
    // Même édition relancée : rien n'est créé deux fois
    expect((await buildEdition(admin, "MONDAY", D1)).created).toBe(false);
  });

  it("alerte quotidienne : seulement pour ceux qui l'ont choisie ; jamais deux fois les mêmes annonces", async () => {
    const r = await buildEdition(admin, "DAILY", D1);
    const { data } = await admin.from("veille_sends").select("user_id").eq("campaign_id", r.campaignId!);
    expect(data!.map((s) => s.user_id)).toContain(ids["veille-quotidien"]);
    expect(data!.map((s) => s.user_id)).not.toContain(ids["veille-hebdo"]);
    const again = await buildEdition(admin, "DAILY", D2);
    const { data: d2 } = await admin.from("veille_sends").select("user_id").eq("campaign_id", again.campaignId!);
    expect((d2 ?? []).map((s) => s.user_id)).not.toContain(ids["veille-quotidien"]);
  });

  it("envoi : contrôles juste avant, rebond définitif → liste d'exclusion, annonce retirée → pas d'envoi", async () => {
    // Une des 3 annonces de « veille-expire » est retirée entre la préparation et l'envoi
    await admin.from("opportunities").update({ status: "EXPIRED" }).eq("id", opps[5]);
    await processVeilleQueue(admin, settings, { deadline: Date.now() + 25_000, send: fakeSend, sleep: async () => {} });
    const status = async (u: string) => (await admin.from("veille_sends").select("status, subject, error").eq("user_id", ids[u]).order("created_at").limit(1).single()).data;
    expect(await status("veille-hebdo")).toMatchObject({ status: "SENT", subject: "Votre veille B2B — les nouvelles opportunités de la semaine" });
    expect((await status("veille-quotidien"))?.status).toBe("BOUNCED");
    expect((await admin.from("veille_suppressions").select("reason").eq("email", emails["veille-quotidien"]).single()).data?.reason).toBe("BOUNCE");
    const exp = (await admin.from("veille_sends").select("status, error").eq("user_id", ids["veille-expire"]).single()).data;
    expect(exp).toMatchObject({ status: "SKIPPED" });
    const msg = sent.find((m) => m.to === emails["veille-hebdo"])!;
    expect(msg.html).toContain(`/api/veille/c?t=${msg.token}`);
    expect(msg.text).toContain(`/veille/desabonnement?jeton=${msg.token}`);
    const { data: c } = await admin.from("veille_campaigns").select("status, sent").eq("kind", "MONDAY").eq("edition_date", D1).single();
    expect(c).toMatchObject({ status: "SENT" });
    expect(c!.sent).toBeGreaterThanOrEqual(1);
  });

  it("édition suspendue : rien ne part ; désinscription immédiate et définitive", async () => {
    const { data: s } = await admin.from("veille_sends").select("token").eq("user_id", ids["veille-hebdo"]).eq("status", "SENT").limit(1).single();
    expect(await unsubscribeVeille(s!.token)).toBe(true);
    expect((await admin.from("veille_preferences").select("frequency").eq("user_id", ids["veille-hebdo"]).single()).data?.frequency).toBe("NONE");
    expect((await loadAudience(admin)).some((m) => m.user_id === ids["veille-hebdo"])).toBe(false);
    expect(await unsubscribeVeille(randomUUID())).toBe(false);
  });

  it("statistiques et aperçu : uniquement ce qui est enregistré et réel", async () => {
    const stats = await veilleStats(admin);
    const { count } = await admin.from("veille_sends").select("id", { count: "exact", head: true }).eq("status", "SENT");
    expect(stats.sent).toBe(count);
    expect(stats.unsubscribed).toBeGreaterThanOrEqual(1);
    const p = await previewFor(admin, "LAUNCH", ids["veille-expire"]);
    expect(p.items.every((o) => o.title.includes(WORD2))).toBe(true);
    expect(p.email.html).toContain("Supervision");
  });
});
