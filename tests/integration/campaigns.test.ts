/** Campagnes : garantie (prolongation si le nombre prévu n'est pas atteint) et mise en avant publique. */
import { afterAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, company, user } from "./helpers";

afterAll(async () => {
  await cleanup();
});

describe("campagnes de visibilité", () => {
  it("prolongée une fois, gratuitement, quand le nombre d'entreprises prévu n'est pas atteint", async () => {
    const u = await user("campagne");
    const co = await company(u.client, "Campagne");
    await admin.from("company_profiles").update({ sectors: ["maintenance-industrielle"] }).eq("company_id", co);
    const ends = new Date(Date.now() + 30 * 60_000).toISOString();
    const { data: b, error } = await admin
      .from("visibility_boosts")
      .insert({ company_id: co, target: "COMPANY", daily_presentations: 10, duration_days: 7, featured_days: 0, status: "ACTIVE", starts_at: new Date(Date.now() - 7 * 86_400_000).toISOString(), ends_at: ends, ad_title: "Maintenance industrielle en Bretagne", ad_status: "APPROVED" })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect((await admin.rpc("extend_underdelivered_boosts")).error).toBeNull();
    const { data: after } = await admin.from("visibility_boosts").select("ends_at, guarantee_extended_days").eq("id", b!.id).single();
    // 70 prévues, 0 réalisées : 7 jours de plus (au plus la durée de la campagne), une seule fois
    expect(after!.guarantee_extended_days).toBe(7);
    expect(new Date(after!.ends_at!).getTime()).toBeGreaterThan(new Date(ends).getTime() + 6 * 86_400_000);
    await admin.rpc("extend_underdelivered_boosts");
    const { data: again } = await admin.from("visibility_boosts").select("guarantee_extended_days, ends_at").eq("id", b!.id).single();
    expect(again).toEqual(after);

    // Mise en avant : visible sans compte, avec le titre de l'annonce validée, filtrée par métier
    const { data: shown } = await anon().rpc("campaign_companies", { p_sector: "maintenance-industrielle", p_limit: 6 });
    expect((shown ?? []).find((c) => c.id === co)).toMatchObject({ ad_title: "Maintenance industrielle en Bretagne" });
    const { data: other } = await anon().rpc("campaign_companies", { p_sector: "espaces-verts", p_limit: 6 });
    expect((other ?? []).some((c) => c.id === co)).toBe(false);
    // Plus d'entreprise ni de fonction de prolongation pour un visiteur
    expect((await anon().rpc("extend_underdelivered_boosts")).error).not.toBeNull();
    await admin.from("visibility_boosts").delete().eq("id", b!.id);
  });
});
