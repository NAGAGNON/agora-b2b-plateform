import { describe, expect, it } from "vitest";
import { decpAwardsCount, decpAwardsUrl, minEmployees, publicProcurementProfile } from "@/lib/outreach/public-awards";
import { analyzeOpportunity, scoreMatch, type ProspectInput } from "@/lib/outreach/matching";

const prospect = (over: Partial<ProspectInput> = {}): ProspectInput => ({
  id: "p1",
  naf_code: "43.21A",
  naf_label: "Travaux d'installation électrique",
  sectors: [],
  activity: null,
  services: [],
  keywords: [],
  department_code: "29",
  region: "Bretagne",
  intervention_zone: "REGIONAL",
  contacts_count: 0,
  last_clicked_at: null,
  ...over,
});
const elec = analyzeOpportunity({
  id: "o1",
  title: "Travaux d'installation électrique de l'école",
  summary: null,
  description: "Remplacement des tableaux électriques et de l'éclairage.",
  sector_slug: "electricite-automatisme",
  skills: [],
  keywords: [],
  department_code: "29",
  region: "Bretagne",
  response_deadline: null,
});

describe("Outreach — profils habitués des marchés publics", () => {
  it("BTP, travaux publics, ingénierie, industrie, maintenance, services aux collectivités", () => {
    expect(publicProcurementProfile("43.21A")).toBe("BTP");
    expect(publicProcurementProfile("42.11Z")).toBe("travaux publics");
    expect(publicProcurementProfile("71.12B")).toBe("ingénierie et études techniques");
    expect(publicProcurementProfile("25.62A")).toBe("industrie");
    expect(publicProcurementProfile("33.12Z")).toBe("maintenance et réparation");
    expect(publicProcurementProfile("81.21Z")).toBe("services aux collectivités");
    expect(publicProcurementProfile("38.11Z")).toBe("services aux collectivités");
    expect(publicProcurementProfile("62.01Z")).toBeNull();
    expect(publicProcurementProfile("73.11Z")).toBeNull();
    expect(publicProcurementProfile(null)).toBeNull();
  });

  it("taille d'après la tranche INSEE enregistrée", () => {
    expect(minEmployees("10 à 19 salariés")).toBe(10);
    expect(minEmployees("1 000 à 1 999 salariés")).toBe(1000);
    expect(minEmployees("0 salarié")).toBe(0);
    expect(minEmployees(null)).toBeNull();
  });
});

describe("Outreach — marchés publics remportés (DECP)", () => {
  it("requête sur les trois titulaires, par SIREN", () => {
    const url = new URL(decpAwardsUrl("123456789"));
    expect(url.hostname).toBe("data.economie.gouv.fr");
    expect(url.pathname).toContain("decp-2022-marches-valides");
    const where = url.searchParams.get("where")!;
    for (const i of [1, 2, 3]) expect(where).toContain(`startswith(titulaire_id_${i}, "123456789")`);
    expect(() => decpAwardsUrl('1234" OR 1=1')).toThrow();
  });

  it("nombre de marchés lu dans total_count ; erreurs explicites", async () => {
    const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
    expect(await decpAwardsCount("123456789", reply(200, { total_count: 7, results: [] }))).toBe(7);
    await expect(decpAwardsCount("123456789", reply(429, {}))).rejects.toThrow(/429/);
    await expect(decpAwardsCount("123456789", reply(500, {}))).rejects.toThrow(/HTTP 500/);
    await expect(decpAwardsCount("123456789", reply(200, { results: [] }))).rejects.toThrow(/inattendue/);
  });
});

describe("Outreach — priorité au score", () => {
  it("les entreprises qui remportent des marchés publics passent devant, raison affichée", () => {
    const none = scoreMatch(elec, prospect({ public_awards_count: 0 }));
    const some = scoreMatch(elec, prospect({ public_awards_count: 2 }));
    const many = scoreMatch(elec, prospect({ public_awards_count: 12 }));
    expect(some.score).toBeGreaterThan(none.score);
    expect(many.score).toBeGreaterThan(some.score);
    expect(many.reasons.join(" ")).toContain("A remporté 12 marchés publics");
    expect(none.reasons.join(" ")).toContain("Métier habitué des appels d'offres publics (BTP)");
  });

  it("taille : capacité à répondre et à sous-traiter ; sans salarié : légère pénalité", () => {
    const base = scoreMatch(elec, prospect()).score;
    const pme = scoreMatch(elec, prospect({ size_range: "20 à 49 salariés" }));
    expect(pme.score).toBeGreaterThan(base);
    expect(pme.reasons.join(" ")).toContain("20 à 49 salariés");
    expect(scoreMatch(elec, prospect({ size_range: "0 salarié" })).score).toBeLessThan(base);
  });

  it("sans activité correspondante, les marchés remportés ne suffisent pas (score nul)", () => {
    expect(scoreMatch(elec, prospect({ naf_code: "56.10A", naf_label: "Restauration", public_awards_count: 30 })).score).toBe(0);
  });
});
