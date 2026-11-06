/**
 * Alertes par compétences : mots du métier sans tenir compte des accents ; un mot seul doit figurer
 * dans l'intitulé ; le secteur choisi n'est pas exigé quand l'alerte a des mots de compétence.
 */
import { afterAll, describe, expect, it } from "vitest";
import { admin, cleanup, RUN, user } from "./helpers";

afterAll(async () => {
  await cleanup();
});

const offer = (title: string, description: string, sector: string) =>
  admin
    .from("opportunities")
    .insert({ type: "PUBLIC_TENDER", origin: "EXTERNAL", status: "PUBLISHED", visibility: "PUBLIC", title: `IT ${RUN} ${title}`, description, sector_slug: sector, department_code: "75", region: "Île-de-France", response_deadline: new Date(Date.now() + 20 * 86_400_000).toISOString(), published_at: new Date().toISOString() })
    .select("id")
    .single();

describe("alertes par compétences", () => {
  it("graphisme : charte graphique retenue, offre d'un autre métier écartée", async () => {
    const u = await user("skill-alert");
    const graph = (await offer("Création d'une charte graphique et d'un logo", "Identité visuelle de la commune.", "communication-evenementiel")).data!;
    const other = (await offer("Travaux de voirie", "Réfection de chaussée ; mise en page du dossier non demandée.", "travaux-btp")).data!;
    const vr = (await offer("Production de modules pédagogiques en réalité virtuelle", "Modules immersifs de formation pour les agents.", "formation")).data!;
    const derat = (await offer("Contrat 2D – 3D dératisation", "Lutte contre les nuisibles.", "nettoyage-proprete")).data!;
    const { data: a, error } = await admin
      .from("alerts")
      .insert({ user_id: u.id, name: "Graphisme", sector_slug: "communication-evenementiel", match_terms: ["graphisme", "charte graphique", "identite visuelle", "mise en page"] })
      .select("id")
      .single();
    expect(error).toBeNull();
    const { data: b } = await admin.from("alerts").insert({ user_id: u.id, name: "VR", match_terms: ["realite virtuelle", "unity", "immersif"] }).select("id").single();
    const match = async (o: string, alert: string) => (await admin.rpc("opportunity_matches_alert", { p_opportunity_id: o, p_alert_id: alert })).data;
    expect(await match(graph.id, a!.id)).toBe(true);
    // « mise en page » seulement dans le descriptif d'une offre d'un autre secteur : écartée
    expect(await match(other.id, a!.id)).toBe(false);
    expect(await match(vr.id, b!.id)).toBe(true);
    expect(await match(derat.id, b!.id)).toBe(false);
  });
});

describe("alertes d'un département peu actif", () => {
  it("élargies à la région (même métier), jamais au-delà ; remises à zéro si le département change", async () => {
    const u = await user("widen-alert");
    const at = (dept: string, region: string) =>
      admin
        .from("opportunities")
        .insert({ type: "PUBLIC_TENDER", origin: "EXTERNAL", status: "PUBLISHED", visibility: "PUBLIC", title: `IT ${RUN} Étude de structure ${dept}`, description: "Mission d'ingénierie : étude de structure et note de calcul.", sector_slug: "ingenierie-etudes", department_code: dept, region, response_deadline: new Date(Date.now() + 20 * 86_400_000).toISOString(), published_at: new Date().toISOString() })
        .select("id")
        .single();
    const herault = (await at("34", "Occitanie")).data!;
    const gironde = (await at("33", "Nouvelle-Aquitaine")).data!;
    const { data: a } = await admin
      .from("alerts")
      .insert({ user_id: u.id, name: "Ingénierie — Lozère", sector_slug: "ingenierie-etudes", department_code: "48", created_at: new Date(Date.now() - 2 * 3_600_000).toISOString() })
      .select("id")
      .single();
    const match = async (o: string) => (await admin.rpc("opportunity_matches_alert", { p_opportunity_id: o, p_alert_id: a!.id })).data;
    expect(await match(herault.id)).toBe(false);
    await admin.rpc("widen_sparse_alerts");
    const { data: widened } = await admin.from("alerts").select("widen_region, name").eq("id", a!.id).single();
    expect(widened).toEqual({ widen_region: "Occitanie", name: "Ingénierie — Lozère + région Occitanie" });
    expect(await match(herault.id)).toBe(true);
    expect(await match(gironde.id)).toBe(false);
    await admin.from("alerts").update({ department_code: "33" }).eq("id", a!.id);
    expect((await admin.from("alerts").select("widen_region").eq("id", a!.id).single()).data?.widen_region).toBeNull();
  });
});
