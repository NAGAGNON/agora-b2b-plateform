/**
 * Cycle d'authentification par e-mail, de bout en bout sur l'Auth Supabase locale :
 * les e-mails sont réellement émis par l'application (transport « boîte de test »)
 * et interceptés par un serveur local ; les liens qu'ils contiennent sont utilisés.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { admin, anon, RUN } from "./helpers";

type Mail = { To: { Email: string }[]; Subject: string; HTML: string; Text: string };
const inbox: Mail[] = [];
let server: Server;
const email = `it-${RUN}-auth@test.linkprob2b.test`;

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.url === "/api/v1/send") inbox.push(JSON.parse(body));
      res.writeHead(200, { "Content-Type": "application/json" }).end("{}");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  vi.stubEnv("MAILPIT_URL", `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("SITE_URL", "https://linkprob2b.test");
});

afterAll(async () => {
  vi.unstubAllEnvs();
  server.close();
  const { data } = await admin.from("users").select("id").eq("email", email).maybeSingle();
  if (data) await admin.auth.admin.deleteUser(data.id);
});

function link(mail: Mail) {
  const url = new URL(mail.Text.match(/https:\/\/linkprob2b\.test\/auth\/confirmation\S+/)![0]);
  return { tokenHash: url.searchParams.get("token_hash")!, type: url.searchParams.get("type")!, suite: url.searchParams.get("suite") };
}

describe("e-mails d'authentification", () => {
  it("inscription : e-mail de confirmation, lien à usage unique, compte activé", async () => {
    const { signUpWithEmail } = await import("@/lib/email/auth-emails");
    const r = await signUpWithEmail({ email, password: "Valide-Passw0rd-IT", data: { full_name: "IT Auth", terms_accepted: "true" } });
    expect(r).toEqual({ ok: true });
    const mail = inbox.find((m) => m.To[0].Email === email && /Confirmez/.test(m.Subject))!;
    expect(mail).toBeDefined();
    expect(mail.HTML).toContain("Confirmer mon adresse e-mail");
    const { tokenHash, type, suite } = link(mail);
    expect(type).toBe("signup");
    expect(suite).toBe("/onboarding/entreprise");

    const client = anon();
    const { data, error } = await client.auth.verifyOtp({ type: "signup", token_hash: tokenHash });
    expect(error).toBeNull();
    expect(data.user?.email_confirmed_at).toBeTruthy();
    // Lien à usage unique
    expect((await anon().auth.verifyOtp({ type: "signup", token_hash: tokenHash })).error).not.toBeNull();
    // Trace d'envoi journalisée, sans le jeton
    const { data: logs } = await admin.from("email_outbox").select("status, payload").eq("to_email", email).eq("template", "auth_confirm_signup");
    expect(logs?.[0]?.status).toBe("SENT");
    expect(JSON.stringify(logs?.[0]?.payload)).not.toContain(tokenHash);
  });

  it("refuse une seconde inscription avec la même adresse", async () => {
    const { signUpWithEmail } = await import("@/lib/email/auth-emails");
    expect(await signUpWithEmail({ email, password: "Valide-Passw0rd-IT", data: {} })).toEqual({ ok: false, reason: "exists" });
  });

  it("mot de passe oublié : lien de réinitialisation, nouveau mot de passe, connexion", async () => {
    const { sendPasswordReset } = await import("@/lib/email/auth-emails");
    await sendPasswordReset(email);
    const mail = inbox.filter((m) => m.To[0].Email === email && /Réinitialisation/.test(m.Subject)).at(-1)!;
    expect(mail).toBeDefined();
    const { tokenHash, type, suite } = link(mail);
    expect(type).toBe("recovery");
    expect(suite).toBe("/reinitialiser-mot-de-passe");

    const client = anon();
    expect((await client.auth.verifyOtp({ type: "recovery", token_hash: tokenHash })).error).toBeNull();
    expect((await client.auth.updateUser({ password: "Nouveau-Passw0rd-IT" })).error).toBeNull();
    await client.auth.signOut();
    expect((await anon().auth.signInWithPassword({ email, password: "Valide-Passw0rd-IT" })).error).not.toBeNull();
    expect((await anon().auth.signInWithPassword({ email, password: "Nouveau-Passw0rd-IT" })).error).toBeNull();
  });

  it("n'envoie rien pour une adresse inconnue (pas d'énumération des comptes)", async () => {
    const { sendPasswordReset } = await import("@/lib/email/auth-emails");
    const before = inbox.length;
    await sendPasswordReset(`inconnu-${RUN}@test.linkprob2b.test`);
    expect(inbox.length).toBe(before);
  });

  it("le rôle anonyme ne peut exécuter aucune fonction métier privilégiée", async () => {
    const calls = [
      anon().rpc("moderate_opportunity", { p_opportunity_id: "00000000-0000-0000-0000-000000000000", p_action: "APPROVE", p_reason: "" }),
      anon().rpc("send_message", { p_conversation_id: "00000000-0000-0000-0000-000000000000", p_body: "x" } as never),
      anon().rpc("export_my_data"),
      anon().rpc("admin_stats"),
    ];
    for (const r of await Promise.all(calls)) expect(r.error?.code).toBe("42501");
  });
});
