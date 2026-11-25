import { describe, expect, it } from "vitest";
import { isLikelyPerson, mapAward, winnerKey } from "@/lib/awards-core";

describe("résultats des marchés", () => {
  it("clé d'entreprise sans forme juridique", () => {
    expect(winnerKey("COLAS FRANCE SAS")).toBe(winnerKey("Colas France"));
    expect(winnerKey("Idverde")).toBe("idverde");
  });
  it("les personnes sont écartées, les entreprises gardées", () => {
    expect(isLikelyPerson("Jean Dupont")).toBe(true);
    expect(isLikelyPerson("M. MARTIN")).toBe(true);
    expect(isLikelyPerson("Marie-Claire LEROY")).toBe(true);
    expect(isLikelyPerson("COLAS FRANCE")).toBe(false);
    expect(isLikelyPerson("JEAN LEFEBVRE SAS")).toBe(false);
    expect(isLikelyPerson("ARTELIA")).toBe(false);
    expect(isLikelyPerson("BUREAU VERITAS EXPLOITATION")).toBe(false);
  });
  it("avis BOAMP → ligne publiable", () => {
    const row = mapAward({ idweb: "26-1", objet: "Nettoyage des locaux de la mairie", nomacheteur: "Ville de Brest", titulaire: ["ONET SERVICES", "Jean Dupont"], dateparution: "2026-11-20", code_departement: ["29"], type_marche: ["SERVICES"] });
    expect(row?.winners).toEqual(["ONET SERVICES"]);
    expect(row?.department_code).toBe("29");
    expect(row?.sector_slug).toBe("nettoyage-proprete");
    expect(mapAward({ idweb: "26-2", objet: "Travaux", titulaire: ["Pierre Durand"], dateparution: "2026-11-20" })).toBeNull();
  });
});
