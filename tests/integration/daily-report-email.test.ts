/**
 * Rapport complet de fin de journée envoyé par e-mail : vrai serveur SMTP local, chiffres réels
 * de la base, une seule fois par jour (sauf envoi à la demande), contenu détaillé et échappé.
 */
import { SMTPServer } from "smtp-server";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { admin, RUN } from "./helpers";
import { parisToday } from "@/lib/daily-report";
import { renderDailyReportEmail, reportRecipients, sendDailyReportEmail } from "@/lib/daily-report-email";

const parse = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({ default: class { beta = { messages: { parse } }; } }));

const TO = `rapport-${RUN}@example.test`;
const received: { to: string[]; data: string }[] = [];
let server: SMTPServer;
let savedReport: unknown = null;
const savedEnv = { ...process.env };
const KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_SECURE", "SMTP_REQUIRE_TLS", "DAILY_REPORT_EMAIL", "ANTHROPIC_API_KEY", "EMAIL_FROM"];

beforeAll(async () => {
  savedReport = (await admin.from("daily_reports").select("*").eq("day", parisToday()).maybeSingle()).data;
  await admin.from("daily_reports").delete().eq("day", parisToday());
  server = new SMTPServer({
    authOptional: true,
    allowInsecureAuth: true,
    disabledCommands: ["STARTTLS"],
    onAuth: (_a, _s, cb) => cb(null, { user: "test" }),
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
  Object.assign(process.env, { SMTP_HOST: "127.0.0.1", SMTP_PORT: String(port), SMTP_USER: "rapport@linkprob2b.test", SMTP_PASSWORD: "test", SMTP_SECURE: "false", SMTP_REQUIRE_TLS: "false", DAILY_REPORT_EMAIL: `${TO}, adresse-invalide`, ANTHROPIC_API_KEY: "test" });
  delete process.env.EMAIL_FROM;
  parse.mockResolvedValue({
    stop_reason: "end_turn",
    model: "test-model",
    parsed_output: {
      titre: "Journée <calme> & régulière",
      resume: "Les tâches automatiques ont tourné toute la journée.",
      points_forts: [{ domaine: "Collecte", constat: "Les sources ont été collectées." }],
      points_faibles: [],
      automatique: [{ domaine: "Outreach", bilan: "Campagne préparée." }],
      recommandations: ["Surveiller les ouvertures demain."],
    },
  });
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  for (const k of KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  if (savedReport) await admin.from("daily_reports").upsert(savedReport as never);
  else await admin.from("daily_reports").delete().eq("day", parisToday());
});

describe("Rapport de fin de journée par e-mail", () => {
  it("destinataires : DAILY_REPORT_EMAIL (adresses invalides ignorées)", async () => {
    expect(await reportRecipients()).toEqual([TO]);
  });

  it("le soir : bilan complet recalculé, envoyé une seule fois", async () => {
    const r = await sendDailyReportEmail();
    expect(r.sent).toBe(1);
    expect(received).toHaveLength(1);
    expect(received[0].to).toEqual([TO]);
    // Bilan du soir : consigne « complet et détaillé » transmise à la rédaction
    expect(JSON.stringify(parse.mock.calls.at(-1)?.[0].system)).toContain("FIN DE JOURNÉE");
    const mail = received[0].data.replace(/=\r?\n/g, "");
    for (const section of ["Rapport de la journ", "Chiffres cl", "Audience", "Outreach", "Collecte des opportunit", "R=C3=A9f=C3=A9rencement", "Inscriptions et abonnements", "T=C3=A2ches automatiques du jour", "Recommandations pour demain"]) {
      expect(mail).toContain(section);
    }
    const { data } = await admin.from("daily_reports").select("emailed_at, facts").eq("day", parisToday()).single();
    expect(data?.emailed_at).not.toBeNull();
    // Deuxième passage du soir : rien n'est renvoyé
    const again = await sendDailyReportEmail();
    expect(again.sent).toBe(0);
    expect(received).toHaveLength(1);
  });

  it("à la demande (bouton) : envoyé même si le rapport du soir est déjà parti", async () => {
    const r = await sendDailyReportEmail({ force: true });
    expect(r.sent).toBe(1);
    expect(received).toHaveLength(2);
  });

  it("contenu détaillé et échappé (aucun HTML injecté)", async () => {
    const { data } = await admin.from("daily_reports").select("day, generated_at, facts, summary, note, error").eq("day", parisToday()).single();
    const m = renderDailyReportEmail(data!);
    expect(m.html).toContain("Journée &lt;calme&gt; &amp; régulière");
    expect(m.html).not.toContain("<calme>");
    expect(m.subject).toMatch(/^Rapport LinkProB2B du .+ — \d+ visites, \d+ e-mails envoyés, \d+ inscriptions$/);
    expect(m.text).toContain("Recommandations :");
    expect(m.html).toContain("/admin");
  });
});
