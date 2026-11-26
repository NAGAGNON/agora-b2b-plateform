import { afterAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin as typedAdmin, cleanup, user } from "./helpers";

const admin = typedAdmin as unknown as SupabaseClient;
afterAll(cleanup);

// Promesse faite par e-mail aux membres pionniers : Pro offert, même sans entreprise, jamais repassé en Gratuit avant la date
describe("membres pionniers (3 personnes, e-mail du 12/11) : Pro offert attaché à la personne", () => {
  it("Pro même sans entreprise tant que la promesse court ; Gratuit après la date ; jamais attribué automatiquement", async () => {
    const u = await user("pionnier");
    expect((await u.client.rpc("user_plan")).data).toBe("FREE");
    // La récompense automatique reste suspendue : rien n'est accordé tout seul
    expect((await admin.rpc("process_pioneer_rewards", { p_limit: 5 })).data).toMatchObject({ suspendu: true });
    expect((await u.client.rpc("user_plan")).data).toBe("FREE");
    await admin.from("pro_grants").insert({ user_id: u.id, until: new Date(Date.now() + 90 * 86_400_000).toISOString(), reason: "test" });
    expect((await u.client.rpc("user_plan")).data).toBe("PRO");
    await admin.from("pro_grants").update({ until: new Date(Date.now() - 1000).toISOString() }).eq("user_id", u.id);
    expect((await u.client.rpc("user_plan")).data).toBe("FREE");
  });
});
