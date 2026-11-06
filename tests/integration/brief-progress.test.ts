/**
 * Étapes de la fiche synthèse : enregistrées sur la ligne de pipeline de l'entreprise, modifiables
 * par ses membres seulement.
 */
import { afterAll, describe, expect, it } from "vitest";
import { admin, cleanup, company, RUN, user } from "./helpers";

afterAll(async () => {
  await cleanup();
});

describe("étapes cochées de la fiche synthèse", () => {
  it("le membre coche ses étapes ; une autre entreprise n'y a pas accès", async () => {
    const u = await user("brief-steps");
    const other = await user("brief-other");
    const id = await company(u.client, "Etapes");
    await company(other.client, "Autre");
    const { data: opp } = await admin
      .from("opportunities")
      .insert({ type: "PUBLIC_TENDER", origin: "EXTERNAL", status: "PUBLISHED", visibility: "PUBLIC", title: `IT ${RUN} Appel d'offres étapes`, description: "Avis de test pour les étapes de la fiche synthèse.", sector_slug: "travaux-btp", department_code: "29", region: "Bretagne", response_deadline: new Date(Date.now() + 20 * 86_400_000).toISOString(), published_at: new Date().toISOString() })
      .select("id")
      .single();
    const oppId = opp!.id;
    const { error } = await u.client.from("pipeline_items").insert({ company_id: id, opportunity_id: oppId, stage: "RESPONSE_PREPARING", brief_done: [0] });
    expect(error).toBeNull();
    expect((await u.client.from("pipeline_items").update({ brief_done: [0, 2] }).eq("company_id", id).eq("opportunity_id", oppId)).error).toBeNull();
    const { data: mine } = await u.client.from("pipeline_items").select("brief_done").eq("opportunity_id", oppId).single();
    expect(mine?.brief_done).toEqual([0, 2]);
    const { data: seen } = await other.client.from("pipeline_items").select("id").eq("opportunity_id", oppId);
    expect(seen ?? []).toHaveLength(0);
  });
});
