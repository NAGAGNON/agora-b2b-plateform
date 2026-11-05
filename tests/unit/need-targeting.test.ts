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

import { alertTermsFor, matchedSkill, skillTerms } from "@/lib/skill-catalog";

describe("alertes par compétences", () => {
  it("métiers exercés à distance : alerte nationale ; métiers de terrain : département", () => {
    expect(alertTermsFor(["Traduction et interprétariat"]).remote).toBe(true);
    expect(alertTermsFor(["Graphisme et identité visuelle", "Rédaction et contenus"]).remote).toBe(true);
    expect(alertTermsFor(["Couverture et étanchéité"]).remote).toBe(false);
    expect(alertTermsFor(["Traduction et interprétariat", "Plomberie et sanitaires"]).remote).toBe(false);
  });

  it("les mots trop généraux saisis seuls sont ignorés, les spécialités précises gardées", () => {
    expect(skillTerms("application")).toEqual([]);
    expect(skillTerms("3D")).toEqual([]);
    expect(skillTerms("Réalité virtuelle")).toEqual(["realite virtuelle"]);
    expect(alertTermsFor(["application", "simulation"]).terms).toEqual([]);
  });

  it("une offre de graphisme est reconnue, une offre de dératisation « 2D-3D » ne l'est pas pour la 3D", () => {
    expect(matchedSkill(["Graphisme et identité visuelle"], "Création d'une charte graphique et d'un logo pour la ville")).toBe("Graphisme et identité visuelle");
    expect(matchedSkill(["Réalité virtuelle, 3D et serious games"], "Contrat 2D – 3D dératisation – désinsectisation")).toBeNull();
    expect(matchedSkill(["Réalité virtuelle, 3D et serious games"], "Production de modules pédagogiques en réalité virtuelle")).toBe("Réalité virtuelle, 3D et serious games");
  });
});
