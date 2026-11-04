/**
 * « Suivre cet acheteur » : alerte sur le nom exact de l'acheteur, qui retient ses appels d'offres
 * et pas ceux des autres acheteurs ; une seule alerte par acheteur.
 */
import { afterAll, describe, expect, it } from "vitest";
import { admin, cleanup, RUN, user } from "./helpers";
import { followBuyer } from "@/lib/buyer-follow";

const BUYER = `Commune IT ${RUN} Suivi`;
afterAll(async () => {
  await cleanup();
});

describe("Suivre un acheteur", () => {
  it("alerte précise sur l'acheteur, sans doublon", async () => {
    const u = await user("follow-buyer");
    const mk = (title: string, buyer: string) =>
      admin.from("opportunities").insert({ type: "PUBLIC_TENDER", origin: "EXTERNAL", status: "PUBLISHED", visibility: "PUBLIC", title: `IT ${RUN} ${title}`, description: "Avis de test pour le suivi d'un acheteur public.", sector_slug: "travaux-btp", department_code: "29", region: "Bretagne", external_buyer_name: buyer, response_deadline: new Date(Date.now() + 20 * 86_400_000).toISOString(), published_at: new Date().toISOString() }).select("id").single();
    const a = await mk("Travaux de voirie", BUYER);
    const b = await mk("Travaux de voirie bis", `Département IT ${RUN}`);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    const mine = a.data!;
    const other = b.data!;
    expect(await followBuyer(u.client, u.id, BUYER)).toBe(true);
    expect(await followBuyer(u.client, u.id, BUYER)).toBe(true);
    const { data: alerts } = await admin.from("alerts").select("id, name, keywords").eq("user_id", u.id);
    expect(alerts).toHaveLength(1);
    expect(alerts![0].name).toBe(`Acheteur : ${BUYER}`);
    const match = async (o: string) => (await admin.rpc("opportunity_matches_alert", { p_opportunity_id: o, p_alert_id: alerts![0].id })).data;
    expect(await match(mine.id)).toBe(true);
    expect(await match(other.id)).toBe(false);
  });
});
