import { describe, expect, it } from "vitest";
import { analyzeOpportunity, NEIGHBOR_REGIONS, scoreMatch } from "@/lib/outreach/matching";

const need = {
  id: "n1",
  title: "750M2 NIMES nous recherchons une entreprise spécialisée dans le désamiantage et la rénovation de toitures",
  summary: null,
  description: "Dépose de la couverture existante contenant de l'amiante, pose d'une couverture en bac acier.",
  sector_slug: "sous-traitance-industrielle",
  skills: [],
  keywords: [],
  department_code: "30",
  region: "Occitanie",
};

describe("ciblage des besoins d'entreprises", () => {
  it("les métiers du titre comptent même si le secteur est mal choisi", () => {
    const strict = analyzeOpportunity(need as never);
    expect(strict.primaryNaf).not.toContain("43.91B");
    const a = analyzeOpportunity(need as never, { trustTitle: true });
    expect(a.primaryNaf).toEqual(expect.arrayContaining(["43.91A", "43.91B", "43.11Z", "39.00Z"]));
    expect(a.primaryNaf).not.toContain("41.20A");
  });

  it("un couvreur d'une région voisine est retenu, avec la raison", () => {
    const a = { ...analyzeOpportunity({ ...need, sector_slug: "travaux-btp" } as never, { trustTitle: true }), nearbyRegions: NEIGHBOR_REGIONS.Occitanie };
    const p = { id: "p", naf_code: "43.91B", naf_label: "Travaux de couverture par éléments", sectors: [], activity: null, services: [], keywords: [], department_code: "13", region: "Provence-Alpes-Côte d'Azur", intervention_zone: "LOCAL", contacts_count: 0, last_clicked_at: null };
    const m = scoreMatch(a, p);
    expect(m.score).toBeGreaterThanOrEqual(55);
    expect(m.reasons.join(" ")).toContain("région voisine");
    expect(scoreMatch(a, { ...p, region: "Bretagne", department_code: "29" }).score).toBeLessThan(m.score);
  });
});
