import { afterAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin as typedAdmin, cleanup, user } from "./helpers";

const admin = typedAdmin as unknown as SupabaseClient;
afterAll(cleanup);

// Promesse faite par e-mail aux membres pionniers : Pro offert, même sans entreprise, jamais repassé en Gratuit avant la date
describe("membres pionniers : Pro offert attaché à la personne", () => {
  it("l'e-mail pionnier enregistre la promesse ; Pro même sans entreprise ; Gratuit après la date", async () => {
    const u = await user("pionnier");
    expect((await u.client.rpc("user_plan")).data).toBe("FREE");
    const { error } = await admin.from("email_outbox").insert({ user_id: u.id, to_email: `pionnier-${u.id}@example.test`, template: "pioneer_reward", subject: "Merci ! 3 mois de LinkProB2B Pro offerts", payload: {} });
    expect(error).toBeNull();
    const { data: g } = await admin.from("pro_grants").select("until").eq("user_id", u.id).single();
    expect(new Date(g!.until).getTime()).toBeGreaterThan(Date.now() + 85 * 86_400_000);
    expect((await u.client.rpc("user_plan")).data).toBe("PRO");
    await admin.from("pro_grants").update({ until: new Date(Date.now() - 1000).toISOString() }).eq("user_id", u.id);
    expect((await u.client.rpc("user_plan")).data).toBe("FREE");
  });
});
