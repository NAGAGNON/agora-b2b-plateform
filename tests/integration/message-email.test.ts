/** Message, intérêt ou réponse reçus : e-mail envoyé même si l'utilisateur a coupé les e-mails de notification. */
import { afterAll, describe, expect, it } from "vitest";
import { admin, cleanup, user } from "./helpers";

afterAll(cleanup);

describe("e-mail des messages reçus", () => {
  it("toujours envoyé pour un message, selon la préférence pour le reste", async () => {
    const u = await user("msg-mail");
    await admin.from("users").update({ notify_email: false }).eq("id", u.id);
    for (const type of ["new_message", "alert_match"]) {
      const { error } = await admin.rpc("notify_user" as never, { p_user_id: u.id, p_type: type, p_title: `Test ${type}`, p_body: "Bonjour", p_link: "/dashboard/messages" } as never);
      expect(error).toBeNull();
    }
    const { data } = await admin.from("email_outbox").select("subject").eq("user_id", u.id);
    const subjects = (data ?? []).map((r) => r.subject);
    expect(subjects).toContain("Test new_message");
    expect(subjects).not.toContain("Test alert_match");
  });
});
