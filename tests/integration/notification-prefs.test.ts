/** Préférences de notifications : une catégorie désactivée n'envoie plus d'e-mail (la notification reste dans le site). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, user } from "./helpers";

let u: Awaited<ReturnType<typeof user>>;
beforeAll(async () => {
  u = await user("prefs");
});
afterAll(cleanup);

const mails = async (type: string) => (await admin.from("email_outbox").select("id").eq("user_id", u.id).eq("payload->>type", type)).data?.length ?? 0;

describe("préférences de notifications", () => {
  it("l'utilisateur règle ses catégories ; messages toujours envoyés", async () => {
    expect((await u.client.from("users").update({ notify_prefs: { pipeline: false } }).eq("id", u.id)).error).toBeNull();
    for (const type of ["pipeline_due", "need_no_response", "new_message"]) {
      expect((await admin.rpc("notify_user", { p_user_id: u.id, p_type: type, p_title: `Test ${type}`, p_body: "Corps", p_link: "/dashboard" })).error).toBeNull();
    }
    expect(await mails("pipeline_due")).toBe(0);
    expect(await mails("need_no_response")).toBe(1);
    expect(await mails("new_message")).toBe(1);
    const { data } = await admin.from("notifications").select("type").eq("user_id", u.id).eq("type", "pipeline_due");
    expect(data?.length).toBe(1);
  });
});
