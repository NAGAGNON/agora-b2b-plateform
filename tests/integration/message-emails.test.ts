/** E-mails des messages : le message complet, coupable partout (profil) ou pour une seule conversation. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin as typedAdmin, cleanup, company, user } from "./helpers";

const admin = typedAdmin as unknown as SupabaseClient;
let a: Awaited<ReturnType<typeof user>>;
let b: Awaited<ReturnType<typeof user>>;
let companyA: string;
let companyB: string;
let conv: string;

const mailsToB = async () => (await admin.from("email_outbox").select("id, payload").eq("user_id", b.id).like("subject", "Nouveau message%")).data ?? [];

beforeAll(async () => {
  a = await user("mail-msg-a");
  b = await user("mail-msg-b");
  companyA = await company(a.client, "Mail msg A");
  companyB = await company(b.client, "Mail msg B");
  const long = "Bonjour, " + "nous cherchons un partenaire pour un chantier. ".repeat(10);
  const { data, error } = await a.client.rpc("contact_company", { p_target_company_id: companyB, p_company_id: companyA, p_body: long });
  expect(error).toBeNull();
  conv = data!;
});
afterAll(cleanup);

describe("e-mails des messages", () => {
  it("par défaut : un e-mail avec le message complet (plus de 140 caractères)", async () => {
    const m = await mailsToB();
    expect(m.length).toBe(1);
    expect(String((m[0].payload as { body: string }).body).length).toBeGreaterThan(300);
  });

  it("conversation coupée : plus d'e-mail, la notification sur le site reste", async () => {
    expect((await b.client.from("conversation_email_mutes").insert({ user_id: b.id, conversation_id: conv })).error).toBeNull();
    await a.client.rpc("send_message", { p_conversation_id: conv, p_body: "Deuxième message" });
    expect((await mailsToB()).length).toBe(1);
    const { count } = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", b.id).eq("type", "new_message");
    expect(count).toBe(2);
    await b.client.from("conversation_email_mutes").delete().eq("conversation_id", conv);
    await a.client.rpc("send_message", { p_conversation_id: conv, p_body: "Troisième message" });
    expect((await mailsToB()).length).toBe(2);
  });

  it("messages coupés dans le profil : plus d'e-mail pour aucune conversation", async () => {
    await admin.from("users").update({ notify_prefs: { messages: false } }).eq("id", b.id);
    await a.client.rpc("send_message", { p_conversation_id: conv, p_body: "Quatrième message" });
    expect((await mailsToB()).length).toBe(2);
  });
});
