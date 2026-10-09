/**
 * Envoi par SMTP (sans API payante) : vrai serveur SMTP local, file progressive, contrôles avant
 * chaque envoi, suivi en base (tentatives, réponse SMTP), rebond définitif → liste d'opposition.
 */
import { randomInt } from "node:crypto";
import { SMTPServer } from "smtp-server";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, RUN } from "./helpers";
import { applySendRamp, processSendQueue } from "@/lib/outreach/pipeline";
import { loadSettings, type OutreachSettings } from "@/lib/outreach/data";

const T = `SMTP ${RUN}`;
const DATE = `2093-${String(randomInt(1, 13)).padStart(2, "0")}-${String(randomInt(1, 29)).padStart(2, "0")}`;
const received: { to: string[]; data: string }[] = [];
let server: SMTPServer;
let original: OutreachSettings;
let campaignId = "";
let oppId = "";
const savedEnv = { ...process.env };
const addr = (k: string) => `${k}-${RUN}@example.test`;
const R: Record<string, string> = {};

async function recipient(key: string, email: string, extra: { siren?: string; prospectEmail?: string } = {}) {
  const { data: p, error } = await admin
    .from("outreach_prospects")
    .insert({ name: `${T} ${key}`, siren: extra.siren ?? null, source: "Test SMTP", email: extra.prospectEmail ?? email, email_source: "Test", naf_code: "43.21A", department_code: "29", region: "Bretagne" })
    .select("id")
    .single();
  if (error) throw error;
  const { data: r, error: e2 } = await admin.from("outreach_recipients").insert({ campaign_id: campaignId, prospect_id: p.id, email, score: 90, reasons: ["Test"], status: "PENDING" }).select("id").single();
  if (e2) throw e2;
  await admin.from("outreach_recipient_opportunities").insert({ recipient_id: r.id, opportunity_id: oppId, score: 90, reasons: [] });
  R[key] = r.id;
}
const status = async (key: string) => (await admin.from("outreach_recipients").select("status, attempts, smtp_response, transport, error, sent_at").eq("id", R[key]).single()).data!;

beforeAll(async () => {
  server = new SMTPServer({
    authOptional: true,
    allowInsecureAuth: true,
    disabledCommands: ["STARTTLS"],
    onAuth: (_a, _s, cb) => cb(null, { user: "test" }),
    onRcptTo: (address, _s, cb) => (address.address.startsWith("bounce-") ? cb(Object.assign(new Error("5.1.1 User unknown"), { responseCode: 550 })) : cb()),
    onData: (stream, session, cb) => {
      let data = "";
      stream.on("data", (c: Buffer) => (data += c.toString()));
      stream.on("end", () => {
        received.push({ to: session.envelope.rcptTo.map((r) => r.address), data });
        cb();
      });
    },
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.server.address() as AddressInfo).port;
  Object.assign(process.env, { SMTP_HOST: "127.0.0.1", SMTP_PORT: String(port), SMTP_USER: "test", SMTP_PASSWORD: "test", SMTP_SECURE: "false", SMTP_REQUIRE_TLS: "false", OUTREACH_SEND_ENABLED: "true" });

  original = await loadSettings(admin);
  await admin.from("outreach_settings").update({ dry_run: false, total_daily_send_cap: 1000, hourly_send_cap: 1000, daily_send_cap: 1000, send_interval_seconds: 0, max_send_attempts: 3 }).eq("id", true);
  const { data: o, error } = await admin
    .from("opportunities")
    .insert({ type: "PUBLIC_TENDER", origin: "EXTERNAL", status: "PUBLISHED", visibility: "PUBLIC", title: `${T} Travaux électriques`, description: "Remplacement des tableaux électriques.", sector_slug: "electricite-automatisme", department_code: "29", region: "Bretagne", response_deadline: new Date(Date.now() + 20 * 86_400_000).toISOString(), published_at: new Date().toISOString(), external_buyer_name: `Commune ${T}` })
    .select("id")
    .single();
  if (error) throw error;
  oppId = o.id;
  const { data: c } = await admin.from("outreach_campaigns").insert({ campaign_date: DATE, kind: "MANUAL", status: "VALIDATED", dry_run: false, min_score: 70, subject_template: "{nombre_opportunites} pour {entreprise}", intro_template: "Nous avons identifié {nombre_opportunites} pour vous." }).select("id").single();
  campaignId = c!.id;
  await recipient("ok", addr("ok"));
  await recipient("optout", addr("optout"));
  await recipient("dup1", addr("dup"));
  // Deux entreprises dont la fiche mène à la même adresse dans la campagne
  await recipient("dup2", addr("dup"), { prospectEmail: addr("dup-bis") });
  await recipient("bounce", `bounce-${RUN}@example.test`);
  await recipient("siren", addr("siren"), { siren: "9" + String(randomInt(10_000_000, 99_999_999)) });
  await admin.from("outreach_suppressions").insert([
    { kind: "EMAIL", value: addr("optout"), reason: "UNSUBSCRIBE" },
    { kind: "SIREN", value: (await admin.from("outreach_prospects").select("siren").eq("name", `${T} siren`).single()).data!.siren!, reason: "MANUAL" },
  ]);
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  for (const k of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_SECURE", "SMTP_REQUIRE_TLS", "OUTREACH_SEND_ENABLED"]) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  await admin.from("outreach_campaigns").delete().eq("id", campaignId);
  const { data: ps } = await admin.from("outreach_prospects").select("siren").like("name", `${T}%`);
  await admin.from("outreach_suppressions").delete().in("value", [addr("optout"), `bounce-${RUN}@example.test`, ...(ps ?? []).map((p) => p.siren).filter((s): s is string => Boolean(s))]);
  await admin.from("outreach_prospects").delete().like("name", `${T}%`);
  await admin.from("opportunities").delete().eq("id", oppId);
  const restore: Partial<OutreachSettings> = { ...original };
  delete restore.id;
  delete restore.updated_at;
  delete restore.updated_by;
  await admin.from("outreach_settings").update(restore).eq("id", true);
});

describe("Envoi SMTP (sans API payante)", () => {
  it("limite horaire : un seul e-mail part, le reste attend dans la file", async () => {
    await admin.from("outreach_settings").update({ hourly_send_cap: 1 }).eq("id", true);
    // Tient compte des envois déjà présents dans la dernière heure (autres tests)
    const { count } = await admin.from("outreach_recipients").select("id", { count: "exact", head: true }).eq("status", "SENT").gte("sent_at", new Date(Date.now() - 3_600_000).toISOString());
    await admin.from("outreach_settings").update({ hourly_send_cap: (count ?? 0) + 1 }).eq("id", true);
    const r = await processSendQueue(admin, { deadline: Date.now() + 20_000, sleep: async () => {} });
    expect(r.sent).toBe(1);
    expect(r.stopped).toBe("limite horaire");
    expect(received).toHaveLength(1);
    await admin.from("outreach_settings").update({ hourly_send_cap: 1000 }).eq("id", true);
  });

  it("contrôles avant chaque envoi, suivi en base, rebond définitif ajouté à la liste d'opposition", async () => {
    const r = await processSendQueue(admin, { deadline: Date.now() + 20_000, sleep: async () => {} });
    expect(r.stopped).toBeNull();
    const ok = await status("ok");
    expect(ok.status).toBe("SENT");
    expect(ok.transport).toBe("smtp");
    expect(ok.attempts).toBe(1);
    expect(ok.smtp_response).toMatch(/^250/);
    // Opposition (adresse) et entreprise opposée (SIREN) : rien n'est envoyé
    expect((await status("optout")).status).toBe("SUPPRESSED");
    expect((await status("siren")).status).toBe("SUPPRESSED");
    // Même adresse deux fois dans la campagne : un seul envoi
    const dups = [await status("dup1"), await status("dup2")].map((d) => d.status).sort();
    expect(dups).toEqual(["EXCLUDED", "SENT"]);
    // Rebond définitif : échec enregistré et adresse ajoutée à la liste d'opposition
    const b = await status("bounce");
    expect(b.status).toBe("FAILED");
    expect(b.error).toMatch(/User unknown|refusée/);
    const { data: s } = await admin.from("outreach_suppressions").select("reason").eq("kind", "EMAIL").eq("value", `bounce-${RUN}@example.test`).single();
    expect(s?.reason).toBe("BOUNCE");
    // Seuls les destinataires autorisés ont reçu un e-mail, avec désinscription en un clic
    const tos = received.flatMap((m) => m.to);
    expect(tos.sort()).toEqual([addr("dup"), addr("ok")].sort());
    expect(received[0].data).toMatch(/List-Unsubscribe-Post: List-Unsubscribe=One-Click/);
    expect(received[0].data).toMatch(/Message-ID: <[0-9a-f-]+@/i);
    const { data: c } = await admin.from("outreach_campaigns").select("status").eq("id", campaignId).single();
    expect(c?.status).toBe("SENT");
  });

  it("aucun double envoi : un nouveau passage n'envoie plus rien", async () => {
    const before = received.length;
    await admin.from("outreach_campaigns").update({ status: "SENDING" }).eq("id", campaignId);
    const r = await processSendQueue(admin, { deadline: Date.now() + 10_000, sleep: async () => {} });
    expect(r.sent).toBe(0);
    expect(received.length).toBe(before);
  });

  it("montée en charge : le palier change en base selon la semaine écoulée, jamais pendant la semaine d'observation", async () => {
    const settings = { total_daily_send_cap: 75, hourly_send_cap: 40, send_ramp_enabled: true, send_ramp_target: 200 };
    // Palier posé il y a 2 jours : rien ne change
    await admin.from("outreach_settings").update({ ...settings, send_ramp_last_at: new Date(Date.now() - 2 * 86_400_000).toISOString() }).eq("id", true);
    expect((await applySendRamp(admin)).action).toBe("hold");
    expect((await loadSettings(admin)).total_daily_send_cap).toBe(75);
    // Semaine écoulée : décision appliquée en base (selon les envois, rebonds et désinscriptions réels)
    await admin.from("outreach_settings").update({ ...settings, send_ramp_last_at: new Date(Date.now() - 8 * 86_400_000).toISOString() }).eq("id", true);
    const r = await applySendRamp(admin);
    const after = await loadSettings(admin);
    expect(after.total_daily_send_cap).toBe(r.cap);
    expect(after.hourly_send_cap).toBe(r.hourlyCap);
    if (r.action === "up") expect(r.cap).toBe(100);
    if (r.action !== "hold") expect(new Date(after.send_ramp_last_at!).getTime()).toBeGreaterThan(Date.now() - 60_000);
    // Désactivée : jamais de changement
    await admin.from("outreach_settings").update({ ...settings, send_ramp_enabled: false, send_ramp_last_at: null }).eq("id", true);
    expect((await applySendRamp(admin)).action).toBe("hold");
    expect((await loadSettings(admin)).total_daily_send_cap).toBe(75);
  });

  it("délai entre deux e-mails à une même entreprise, toutes campagnes confondues", async () => {
    // L'entreprise « ok » vient de recevoir un e-mail : une autre campagne du jour ne la recontacte pas
    const { data: ok } = await admin.from("outreach_recipients").select("prospect_id").eq("id", R.ok).single();
    const { data: c2 } = await admin.from("outreach_campaigns").insert({ campaign_date: DATE, kind: "MANUAL", status: "VALIDATED", dry_run: false, min_score: 70, subject_template: "s", intro_template: "Introduction de test assez longue." }).select("id").single();
    const { data: r2 } = await admin.from("outreach_recipients").insert({ campaign_id: c2!.id, prospect_id: ok!.prospect_id, email: addr("ok"), score: 90, reasons: [], status: "PENDING" }).select("id").single();
    await admin.from("outreach_recipient_opportunities").insert({ recipient_id: r2!.id, opportunity_id: oppId, score: 90, reasons: [] });
    const before = received.length;
    try {
      await processSendQueue(admin, { deadline: Date.now() + 10_000, sleep: async () => {} });
      const { data } = await admin.from("outreach_recipients").select("status, error").eq("id", r2!.id).single();
      expect(data?.status).toBe("FREQUENCY");
      expect(received.length).toBe(before);
    } finally {
      await admin.from("outreach_campaigns").delete().eq("id", c2!.id);
    }
  });

  it("un seul envoi à la fois : un second passage simultané n'envoie rien", async () => {
    await admin.from("outreach_settings").update({ send_lock_until: new Date(Date.now() + 60_000).toISOString() }).eq("id", true);
    try {
      const r = await processSendQueue(admin, { deadline: Date.now() + 5_000, sleep: async () => {} });
      expect(r.sent).toBe(0);
      expect(r.stopped).toMatch(/autre envoi/);
    } finally {
      await admin.from("outreach_settings").update({ send_lock_until: null }).eq("id", true);
    }
    // Verrou libéré après un passage normal
    await processSendQueue(admin, { deadline: Date.now() + 5_000, sleep: async () => {} });
    expect((await loadSettings(admin)).send_lock_until).toBeNull();
  });
});
