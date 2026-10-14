/**
 * Invitation unique à activer la veille : uniquement les inscrits sans accord ni refus, adresse
 * confirmée, compte de plus d'un jour ; jamais deux fois ; annonces réelles ; désinscription respectée.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, RUN, user } from "./helpers";
import { sendVeilleInvitations } from "@/lib/veille/engine";
import { unsubscribeVeille } from "@/lib/veille/tracking";
import type { VeilleMessage } from "@/lib/veille/send";

const old = new Date(Date.now() - 3 * 86_400_000).toISOString();
const ids: Record<string, string> = {};
let unconfirmed = "";

async function member(label: string, extra: Record<string, unknown> = {}, pref?: Record<string, unknown>) {
  const u = await user(label);
  ids[label] = u.id;
  await admin.from("users").update({ created_at: old, ...extra }).eq("id", u.id);
  if (pref) await admin.from("veille_preferences").insert({ user_id: u.id, ...pref });
}

beforeAll(async () => {
  await member("inv-cible");
  await member("inv-recent");
  await admin.from("users").update({ created_at: new Date().toISOString() }).eq("id", ids["inv-recent"]);
  await member("inv-accord", { marketing_consent: true });
  await member("inv-refus", {}, { frequency: "NONE" });
  const { data } = await admin.auth.admin.createUser({ email: `it-${RUN}-inv-nonconfirme@test.linkprob2b.test`, password: `Test-${randomUUID()}-Aa1`, email_confirm: false });
  unconfirmed = data.user!.id;
  await admin.from("users").update({ created_at: old }).eq("id", unconfirmed);
});

afterAll(async () => {
  await admin.from("veille_campaigns").delete().eq("kind", "INVITE");
  await admin.auth.admin.deleteUser(unconfirmed);
  await admin.from("veille_suppressions").delete().like("email", `it-${RUN}-%`);
  await cleanup();
});

describe("Invitation à activer la veille", () => {
  const sent: VeilleMessage[] = [];
  const send = async (m: VeilleMessage) => (sent.push(m), { status: "SENT" as const });

  it("seulement les inscrits sans accord ni refus, adresse confirmée, compte de plus d'un jour", async () => {
    const r = await sendVeilleInvitations(admin, { send, deadline: Date.now() + 20_000, sleep: async () => {}, max: 1000 });
    const mine = sent.filter((m) => m.to.includes(`it-${RUN}-`)).map((m) => m.to);
    expect(mine).toEqual([`it-${RUN}-inv-cible@test.linkprob2b.test`]);
    expect(r.sent).toBeGreaterThanOrEqual(1);
    const m = sent.find((x) => x.to.includes("inv-cible"))!;
    expect(m.subject).toBe("Activez votre veille B2B gratuite sur LinkProB2B");
    expect(m.html).toContain("Activer ma veille");
    expect(m.html).toContain("Vous recevez ce message unique");
    expect(m.text).toContain(`/veille/desabonnement?jeton=${m.token}`);
    // Aucune préférence ni accord n'est créé par l'invitation
    expect((await admin.from("veille_preferences").select("user_id").eq("user_id", ids["inv-cible"])).data).toEqual([]);
  });

  it("jamais deux fois, et la désinscription depuis l'invitation est définitive", async () => {
    const before = sent.length;
    await sendVeilleInvitations(admin, { send, deadline: Date.now() + 20_000, sleep: async () => {}, max: 1000 });
    expect(sent.slice(before).some((m) => m.to.includes("inv-cible"))).toBe(false);
    const m = sent.find((x) => x.to.includes("inv-cible"))!;
    expect(await unsubscribeVeille(m.token)).toBe(true);
    expect((await admin.from("veille_preferences").select("frequency").eq("user_id", ids["inv-cible"]).single()).data?.frequency).toBe("NONE");
  });

  it("sans service d'envoi : rien n'est marqué envoyé, l'invitation repartira", async () => {
    await member("inv-plus-tard");
    const r = await sendVeilleInvitations(admin, { send: async () => ({ status: "SKIPPED" as const, error: "SMTP non configuré" }), deadline: Date.now() + 20_000, sleep: async () => {}, max: 1000 });
    expect(r.stopped).toBe("SMTP non configuré");
    expect((await admin.from("veille_sends").select("id").eq("user_id", ids["inv-plus-tard"])).data).toEqual([]);
  });
});
