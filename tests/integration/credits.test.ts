import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, company, days, RUN, user } from "./helpers";

const setEnabled = (on: boolean) => admin.from("platform_settings").upsert({ key: "billing.credits_enabled", value: on, description: "Crédits" }, { onConflict: "key" });
let u: Awaited<ReturnType<typeof user>>;
const opps: string[] = [];

beforeAll(async () => {
  u = await user("credits");
  const other = await user("credits-acheteur");
  const co = await company(other.client, "Acheteur crédits");
  const rows = Array.from({ length: 5 }, (_, i) => ({
    company_id: co, type: "QUOTE_REQUEST" as const, status: "PUBLISHED" as const, title: `IT ${RUN} crédit ${i}`,
    description: "Description de test suffisamment longue.", sector_slug: "maintenance-industrielle", city: "Brest", response_deadline: days(20), published_at: new Date().toISOString(),
  }));
  const { data, error } = await admin.from("opportunities").insert(rows).select("id");
  if (error) throw error;
  opps.push(...data.map((d) => d.id));
});
afterAll(async () => {
  await setEnabled(false);
  await cleanup();
});

describe("crédits", () => {
  it("en sommeil : rien n'est débité", async () => {
    await setEnabled(false);
    const { data } = await u.client.rpc("charge_follow", { p_opportunity_id: opps[0] });
    expect(data).toMatchObject({ charged: 0, dormant: true });
  });

  it("Gratuit : 3 crédits, 1 par offre suivie, jamais deux fois la même, solde insuffisant refusé", async () => {
    await setEnabled(true);
    expect((await u.client.rpc("my_credits")).data).toMatchObject({ plan: "FREE", balance: 3 });
    expect((await u.client.rpc("charge_follow", { p_opportunity_id: opps[0] })).data).toMatchObject({ charged: 1 });
    expect((await u.client.rpc("charge_follow", { p_opportunity_id: opps[0] })).data).toMatchObject({ charged: 0, already: true });
    // Veille de 20 jours = 2 crédits ; il ne reste plus rien
    expect((await u.client.rpc("alert_credit_cost", { p_days: 20 })).data).toBe(2);
    expect((await u.client.rpc("spend_credits", { p_kind: "ALERT_ACTIVATION", p_amount: 2, p_days: 20 })).error).toBeNull();
    const refused = await u.client.rpc("charge_follow", { p_opportunity_id: opps[1] });
    expect(refused.error?.hint).toBe("PLAN_LIMIT:credits");
    expect((await u.client.rpc("my_credits")).data).toMatchObject({ balance: 0 });
  });

  it("registre complet ; impossible de modifier son solde soi-même", async () => {
    const { data } = await u.client.from("credit_ledger").select("kind, amount, balance_after").order("id");
    expect(data?.map((d) => d.kind)).toEqual(["MONTHLY_GRANT", "OPPORTUNITY_FOLLOW", "ALERT_ACTIVATION"]);
    await u.client.from("credit_wallets").update({ balance: 99 }).eq("user_id", u.id);
    expect((await u.client.rpc("my_credits")).data).toMatchObject({ balance: 0 });
  });

  it("recharge au changement de période, sans report ni double attribution", async () => {
    await admin.from("credit_wallets").update({ period_end: new Date(Date.now() - 1000).toISOString() }).eq("user_id", u.id);
    await Promise.all([u.client.rpc("my_credits"), u.client.rpc("my_credits")]);
    expect((await u.client.rpc("my_credits")).data).toMatchObject({ balance: 3 });
    const { count } = await admin.from("credit_ledger").select("id", { count: "exact", head: true }).eq("user_id", u.id).eq("kind", "MONTHLY_GRANT");
    expect(count).toBe(2);
  });
});
