/** Fiche « En savoir plus » : une seule rédaction à la fois par offre (la seconde demande attend). */
import { afterAll, describe, expect, it } from "vitest";
import { admin, cleanup } from "./helpers";

let opp = "";
afterAll(async () => {
  if (opp) await admin.from("opportunities").delete().eq("id", opp);
  await cleanup();
});

describe("rédaction unique de la fiche", () => {
  it("la première demande obtient la rédaction, la seconde non ; libérée, elle redevient disponible", async () => {
    const { data, error } = await admin
      .from("opportunities")
      .insert({ type: "EXTERNAL_OPPORTUNITY", origin: "EXTERNAL", status: "PUBLISHED", visibility: "PUBLIC", title: "Fiche unique test", description: "Test de rédaction unique.", summary: "Test.", published_at: new Date().toISOString() })
      .select("id")
      .single();
    expect(error).toBeNull();
    opp = data!.id;
    expect((await admin.rpc("claim_brief_generation", { p_opportunity_id: opp })).data).toBe(true);
    expect((await admin.rpc("claim_brief_generation", { p_opportunity_id: opp })).data).toBe(false);
    await admin.from("brief_generations").delete().eq("opportunity_id", opp);
    expect((await admin.rpc("claim_brief_generation", { p_opportunity_id: opp })).data).toBe(true);
    // Une rédaction bloquée depuis plus de 2 minutes est reprise
    await admin.from("brief_generations").update({ started_at: new Date(Date.now() - 3 * 60_000).toISOString() }).eq("opportunity_id", opp);
    expect((await admin.rpc("claim_brief_generation", { p_opportunity_id: opp })).data).toBe(true);
  });
});
