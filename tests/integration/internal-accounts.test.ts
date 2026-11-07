/** Comptes internes (propriétaire, essais) : exclus de la facturation et des inscriptions comptées. */
import { afterAll, describe, expect, it } from "vitest";
import { admin, cleanup, company, user } from "./helpers";

afterAll(async () => {
  await cleanup();
});

describe("comptes internes", () => {
  it("une entreprise interne abonnée ne compte ni dans le revenu ni dans les entreprises Pro", async () => {
    const boss = await user("internal-admin", "ADMIN");
    const before = (await boss.client.rpc("admin_billing_stats")).data as { companies_pro: number; mrr_cents: number; companies_total: number };
    const owner = await user("internal-owner");
    const co = await company(owner.client, "Interne");
    await admin.from("companies").update({ plan_code: "PRO", status: "ACTIVE" }).eq("id", co);
    await admin.from("users").update({ is_internal: true } as never).eq("id", owner.id);
    await admin.from("companies").update({ is_internal: true } as never).eq("id", co);
    const after = (await boss.client.rpc("admin_billing_stats")).data as typeof before;
    expect(after.companies_pro).toBe(before.companies_pro);
    expect(after.mrr_cents).toBe(before.mrr_cents);
    expect(after.companies_total).toBe(before.companies_total);
    const audience = (await boss.client.rpc("admin_audience_stats", { p_days: 1 })).data as { signups: number };
    const internalSignup = await admin.from("users").select("id").eq("id", owner.id).eq("is_internal" as never, true as never);
    expect(internalSignup.data).toHaveLength(1);
    expect(typeof audience.signups).toBe("number");
  });
});
