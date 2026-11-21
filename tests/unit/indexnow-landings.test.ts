import { describe, expect, it } from "vitest";
import { landingPaths } from "@/lib/indexnow-landings";

const counts = [
  { dimension: "region", key: "Bretagne", n: 40 },
  { dimension: "department", key: "29", n: 20 },
  { dimension: "department", key: "35", n: 2 },
  { dimension: "sector", key: "nettoyage-proprete", n: 30 },
  { dimension: "sector", key: "travaux-btp", n: 2 },
  { dimension: "department_sector", key: "29|nettoyage-proprete", n: 5 },
  { dimension: "department_sector", key: "29|travaux-btp", n: 2 },
  { dimension: "region_sector", key: "Bretagne|nettoyage-proprete", n: 8 },
];
const departments = [
  { code: "29", slug: "finistere", region: "Bretagne" },
  { code: "35", slug: "ille-et-vilaine", region: "Bretagne" },
];

describe("pages d'atterrissage signalées aux moteurs (IndexNow)", () => {
  it("premier envoi : toutes les pages avec assez d'offres, jamais une page presque vide", () => {
    const all = landingPaths(counts, departments, "all");
    expect(all).toEqual(
      expect.arrayContaining(["/opportunites/bretagne", "/opportunites/bretagne/finistere", "/opportunites/bretagne/finistere/nettoyage-proprete", "/opportunites/bretagne/nettoyage-proprete", "/opportunites/nettoyage-proprete"]),
    );
    expect(all).not.toContain("/opportunites/bretagne/ille-et-vilaine");
    expect(all).not.toContain("/opportunites/bretagne/finistere/travaux-btp");
    expect(all).not.toContain("/opportunites/travaux-btp");
  });

  it("ensuite : seulement les pages touchées par les nouvelles offres, et la page de l'acheteur", () => {
    const some = landingPaths(counts, departments, [{ department_code: "29", sector_slug: "nettoyage-proprete", region: "Bretagne", external_buyer_name: "Ville de Brest" }]);
    expect(some).toContain("/opportunites/bretagne/finistere/nettoyage-proprete");
    expect(some.some((p) => p.startsWith("/acheteurs/"))).toBe(true);
    const none = landingPaths(counts, departments, [{ department_code: "35", sector_slug: "travaux-btp", region: null, external_buyer_name: null }]);
    expect(none).toEqual([]);
  });
});
