/**
 * Suivi des inscrits sur la base réelle : destinataires (sans accord marketing, mais désinscription,
 * refus et rebonds respectés), accueil, relance des absents, un e-mail par jour, rendu et envoi.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, days, RUN, user } from "./helpers";
import { alreadySent, loadPool, processVeilleQueue } from "@/lib/veille/engine";
import { buildSuivi, loadSuiviAudience } from "@/lib/veille/suivi";
import type { VeilleMessage } from "@/lib/veille/send";

const WORD = `zs${RUN.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
const settings = { enabled: true, launch_date: "2026-10-15", daily_cap: 1000 };
const ids: Record<string, string> = {};
const emails: Record<string, string> = {};
const campaigns: string[] = [];
const outbox: VeilleMessage[] = [];
const fakeSend = async (m: VeilleMessage) => (outbox.push(m), { status: "SENT" as const });
const ago = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const build = (now = new Date()) =>
  buildSuivi(admin, { now, max: 1000, loadPool: (d) => loadPool(admin, d, now), alreadySent: (u) => alreadySent(admin, u) }).then((r) => (r.campaignId && campaigns.push(r.campaignId), r));

async function member(label: string, o: { created: number; seen: number | null; prefs?: Record<string, unknown> }) {
  const u = await user(label);
  ids[label] = u.id;
  emails[label] = u.email.toLowerCase();
  await admin.from("users").update({ created_at: ago(o.created), last_seen_at: o.seen === null ? null : ago(o.seen), marketing_consent: false }).eq("id", u.id);
  if (o.prefs) await admin.from("veille_preferences").insert({ user_id: u.id, ...o.prefs });
}

const mySends = async () => (await admin.from("veille_sends").select("user_id, step, status, news_key, opportunity_ids, subject").in("user_id", Object.values(ids)).not("step", "is", null)).data ?? [];

beforeAll(async () => {
  const { data: boamp } = await admin.from("external_sources").select("id").eq("code", "boamp").single();
  for (let i = 0; i < 3; i++) {
    const { data, error } = await admin.from("opportunities").insert({
      title: `IT ${RUN} Câblage ${WORD} lot ${i}`,
      description: "Avis de test suffisamment long pour le suivi des inscrits.",
      type: "PUBLIC_TENDER",
      origin: "EXTERNAL",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      external_buyer_name: `Acheteur ${RUN}`,
      region: "Bretagne",
      sector_slug: "informatique",
      response_deadline: days(20),
      published_at: ago(0.1),
    }).select("id").single();
    if (error) throw error;
    await admin.from("opportunity_sources").insert({ opportunity_id: data.id, source_id: boamp!.id, external_id: `suivi-${data.id}`, original_url: "https://www.boamp.fr/avis/detail/test", is_primary: true });
  }
  await member("suivi-nouveau", { created: 1.3, seen: null });
  await member("suivi-absent", { created: 40, seen: 5, prefs: { frequency: "TWICE_WEEKLY", keywords: [WORD] } });
  await member("suivi-actif", { created: 40, seen: 0.3 });
  await member("suivi-revenu", { created: 40, seen: 6, prefs: { frequency: "TWICE_WEEKLY", keywords: [WORD] } });
  await member("suivi-refus", { created: 40, seen: 9, prefs: { frequency: "NONE" } });
  await member("suivi-desinscrit", { created: 40, seen: 9 });
  await admin.from("veille_suppressions").insert({ email: emails["suivi-desinscrit"], reason: "UNSUBSCRIBE" });
});

afterAll(async () => {
  if (campaigns.length) await admin.from("veille_campaigns").delete().in("id", campaigns);
  await admin.from("veille_suppressions").delete().in("email", Object.values(emails));
  await cleanup();
});

describe("Suivi des inscrits", () => {
  it("destinataires : tous les comptes confirmés, sans accord marketing, sauf refus et désinscription", async () => {
    const mine = (await loadSuiviAudience(admin)).filter((m) => Object.values(ids).includes(m.user_id)).map((m) => m.user_id);
    expect(mine.sort()).toEqual([ids["suivi-nouveau"], ids["suivi-absent"], ids["suivi-actif"], ids["suivi-revenu"]].sort());
  });

  it("préparation : accueil du nouveau, relance des absents avec les nouveaux marchés, rien pour l'actif", async () => {
    const r = await build();
    expect(r.created).toBe(true);
    const sends = await mySends();
    const by = Object.fromEntries(sends.map((s) => [s.user_id, s]));
    expect(by[ids["suivi-nouveau"]]?.step).toBe("PROFIL");
    expect(by[ids["suivi-absent"]]?.step).toBe("RETOUR");
    expect(by[ids["suivi-absent"]]?.opportunity_ids.length).toBe(3);
    expect(by[ids["suivi-absent"]]?.news_key).toBeTruthy();
    expect(by[ids["suivi-actif"]]).toBeUndefined();
    // Idempotent : une seule préparation par jour
    expect((await build()).created).toBe(false);
  });

  it("envoi : contenu réel, lien de désinscription ; revenu entre-temps : pas d'envoi", async () => {
    await admin.from("users").update({ last_seen_at: new Date().toISOString() }).eq("id", ids["suivi-revenu"]);
    await processVeilleQueue(admin, settings, { deadline: Date.now() + 25_000, send: fakeSend, sleep: async () => {} });
    const sends = Object.fromEntries((await mySends()).map((s) => [s.user_id, s]));
    expect(sends[ids["suivi-absent"]]?.status).toBe("SENT");
    expect(sends[ids["suivi-nouveau"]]?.status).toBe("SENT");
    expect(sends[ids["suivi-revenu"]]?.status).toBe("SKIPPED");
    const mail = outbox.find((m) => m.to === emails["suivi-absent"])!;
    expect(mail.html).toContain(`Câblage ${WORD}`);
    expect(mail.html).toContain("3 nouvelles opportunités pour vous");
    expect(mail.html).toContain("/veille/desabonnement?jeton=");
    expect(outbox.find((m) => m.to === emails["suivi-nouveau"])!.subject).toContain("créez la fiche de votre entreprise");
  });

  it("le lendemain : pas de nouvelle relance (2 jours d'écart), l'accueil passe à l'étape suivante seulement le moment venu", async () => {
    await build(new Date(Date.now() + 86_400_000));
    const sends = await mySends();
    expect(sends.filter((s) => s.user_id === ids["suivi-absent"])).toHaveLength(1);
    expect(sends.filter((s) => s.user_id === ids["suivi-nouveau"])).toHaveLength(1);
  });

  it("la base refuse la lecture des destinataires aux utilisateurs", async () => {
    const intruder = await user("suivi-intrus");
    expect((await intruder.client.rpc("suivi_audience")).error).not.toBeNull();
  });
});
