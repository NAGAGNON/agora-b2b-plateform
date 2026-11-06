/**
 * Offre de lancement : l'essai Pro donne les droits Pro sans abonnement, puis s'arrête seul ; il ne
 * peut pas être modifié par un membre ; sans lancement, l'essai à la demande est refusé.
 */
import { afterAll, describe, expect, it } from "vitest";
import { admin, cleanup, company, days, user } from "./helpers";

afterAll(async () => {
  await cleanup();
});

describe("essai Pro de l'offre de lancement", () => {
  it("droits Pro pendant l'essai, Gratuit ensuite ; non modifiable par le membre", async () => {
    const u = await user("trial");
    const id = await company(u.client, "Essai Pro");
    const plan = async () => (await u.client.rpc("company_plan", { p_company_id: id })).data;
    expect(await plan()).toBe("FREE");
    await admin.from("companies").update({ trial_started_at: days(-1), trial_ends_at: days(13) }).eq("id", id);
    expect(await plan()).toBe("PRO");
    expect((await u.client.rpc("user_plan")).data).toBe("PRO");
    await admin.from("companies").update({ trial_ends_at: days(-1) }).eq("id", id);
    expect(await plan()).toBe("FREE");
    // Le membre ne peut pas prolonger son essai lui-même
    const { error } = await u.client.from("companies").update({ trial_ends_at: days(365) } as never).eq("id", id);
    expect(error).not.toBeNull();
    expect(await plan()).toBe("FREE");
  });

  it("essai à la demande refusé tant que l'offre n'est pas lancée", async () => {
    const u = await user("trial-off");
    const id = await company(u.client, "Essai refusé");
    const { error } = await u.client.rpc("start_pro_trial", { p_company_id: id });
    expect(error?.message).toMatch(/indisponible/);
  });

  it("recherches illimitées pendant la phase de lancement gratuite", async () => {
    const u = await user("search");
    for (let i = 0; i < 20; i++) expect((await u.client.rpc("count_search")).data).toBe(true);
  });
});
