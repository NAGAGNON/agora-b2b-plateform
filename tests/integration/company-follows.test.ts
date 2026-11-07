/**
 * Suivre une entreprise : au nom de sa propre entreprise uniquement, notification à l'entreprise
 * suivie, puis aux abonnés à chaque nouveau besoin publié.
 */
import { afterAll, describe, expect, it } from "vitest";
import { admin, cleanup, company, RUN, user } from "./helpers";

afterAll(async () => {
  await cleanup();
});

describe("entreprises suivies", () => {
  it("suivre, être notifié, voir ses abonnés ; pas au nom d'une autre entreprise", async () => {
    const fan = await user("follow-fan");
    const star = await user("follow-star");
    const intruder = await user("follow-intruder");
    const fanCo = await company(fan.client, "Abonnee");
    const starCo = await company(star.client, "Suivie");
    const intruderCo = await company(intruder.client, "Intruse");
    await admin.from("company_profiles").update({ is_public: true }).eq("company_id", starCo);
    await admin.from("companies").update({ status: "ACTIVE" }).in("id", [fanCo, starCo, intruderCo]);

    // Au nom d'une autre entreprise : refusé
    const forged = await intruder.client.from("company_follows").insert({ follower_company_id: fanCo, followed_company_id: starCo, created_by: intruder.id });
    expect(forged.error).not.toBeNull();
    // Se suivre soi-même : refusé
    expect((await star.client.from("company_follows").insert({ follower_company_id: starCo, followed_company_id: starCo, created_by: star.id })).error).not.toBeNull();

    const ok = await fan.client.from("company_follows").insert({ follower_company_id: fanCo, followed_company_id: starCo, created_by: fan.id });
    expect(ok.error).toBeNull();
    const { data: notif } = await admin.from("notifications").select("title").eq("user_id", star.id).eq("type", "company_followed");
    expect(notif?.[0]?.title).toContain("Abonnee");
    expect((await star.client.from("company_follows").select("follower_company_id").eq("followed_company_id", starCo)).data).toHaveLength(1);
    expect((await intruder.client.from("company_follows").select("follower_company_id").eq("followed_company_id", starCo)).data ?? []).toHaveLength(0);
    expect(Number((await fan.client.rpc("company_followers_count", { p_company_id: starCo })).data)).toBe(1);

    // Nouveau besoin publié par l'entreprise suivie : l'abonné est prévenu
    await admin.from("opportunities").insert({
      company_id: starCo,
      type: "QUOTE_REQUEST",
      origin: "INTERNAL",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      title: `IT ${RUN} Besoin d'une entreprise suivie`,
      description: "Besoin de test publié par une entreprise suivie.",
      sector_slug: "maintenance-industrielle",
      department_code: "29",
      region: "Bretagne",
      published_at: new Date().toISOString(),
    });
    const { data: need } = await admin.from("notifications").select("title").eq("user_id", fan.id).eq("type", "followed_company_need");
    expect(need?.[0]?.title).toContain("a publié un nouveau besoin");

    expect((await fan.client.from("company_follows").delete().eq("follower_company_id", fanCo).eq("followed_company_id", starCo)).error).toBeNull();
    expect(Number((await fan.client.rpc("company_followers_count", { p_company_id: starCo })).data)).toBe(0);
  });
});
