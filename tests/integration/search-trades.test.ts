/**
 * Recherche par nom de métier (« plombier » trouve les offres de plomberie), « consultant » sans les
 * « consultations », et alertes : un mot seul trop courant ne fait plus remonter une offre d'un autre métier.
 */
import { afterAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, RUN, user } from "./helpers";

afterAll(async () => {
  await cleanup();
});

const offer = async (title: string, description: string, sector: string) => {
  const r = await admin
    .from("opportunities")
    .insert({ type: "PUBLIC_TENDER", origin: "EXTERNAL", status: "PUBLISHED", visibility: "PUBLIC", title: `IT ${RUN} ${title}`, description, sector_slug: sector, department_code: "93", region: "Île-de-France", response_deadline: new Date(Date.now() + 20 * 86_400_000).toISOString(), published_at: new Date().toISOString() })
    .select("id")
    .single();
  if (r.error) throw new Error(`${title}: ${r.error.message}`);
  return r;
};

const found = async (q: string, id: string) => {
  const { data } = await anon().rpc("search_opportunities", { p_q: `${q} ${RUN}`, p_limit: 50 });
  return (data ?? []).some((r) => r.id === id);
};

describe("recherche par métier", () => {
  it("plombier, électricien, couvreur trouvent les offres de leur domaine", async () => {
    const plomb = (await offer("Travaux de plomberie sanitaire", "Remplacement des réseaux d'eau.", "batiment-technique")).data!;
    const elec = (await offer("Travaux d'électricité courants forts", "Mise aux normes électriques.", "electricite-automatisme")).data!;
    const toit = (await offer("Réfection de toiture et zinguerie", "Couverture en zinc et reprise des gouttières.", "travaux-btp")).data!;
    expect(await found("plombier", plomb.id)).toBe(true);
    expect(await found("plombiers", plomb.id)).toBe(true);
    expect(await found("électricien", elec.id)).toBe(true);
    expect(await found("couvreur", toit.id)).toBe(true);
    expect(await found("plomberie", plomb.id)).toBe(true);
    expect(await found("plombier", elec.id)).toBe(false);
  });

  it("« consultant » ne remonte plus les simples consultations", async () => {
    const consult = (await offer("Consultation pour la fourniture de mobilier", "Avis de consultation.", "fournitures-industrielles")).data!;
    const conseil = (await offer("Mission de conseil en organisation", "Accompagnement au changement.", "conseil")).data!;
    expect(await found("consultant", consult.id)).toBe(false);
    expect(await found("consultant", conseil.id)).toBe(true);
  });
});

describe("alertes précises", () => {
  it("un mot seul ne fait plus remonter une offre d'un autre métier", async () => {
    const u = await user("alerte-transport");
    const imprimes = (await offer("Fabrication et livraison des imprimés de valeur", "Impression sécurisée.", "services-aux-entreprises")).data!;
    const livraisons = (await offer("Livraison de colis et messagerie", "Tournées quotidiennes.", "transport-logistique")).data!;
    const autre = (await offer("Transport de marchandises pour les services techniques", "Camions plateau pour les services techniques.", "services-aux-entreprises")).data!;
    const { data: a } = await admin
      .from("alerts")
      .insert({ user_id: u.id, name: "Transport — 93", sector_slug: "transport-logistique", department_code: "93", match_terms: ["transport de marchandises", "messagerie", "fret", "livraison"] })
      .select("id")
      .single();
    const match = async (o: string) => (await admin.rpc("opportunity_matches_alert", { p_opportunity_id: o, p_alert_id: a!.id })).data;
    expect(await match(imprimes.id)).toBe(false);
    expect(await match(livraisons.id)).toBe(true);
    // Autre métier mais expression précise de plusieurs mots : retenue
    expect(await match(autre.id)).toBe(true);
  });
});
