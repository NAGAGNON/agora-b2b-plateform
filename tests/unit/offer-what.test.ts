import { describe, expect, it } from "vitest";
import { isGenericSummary, offerWhat } from "@/lib/offer-what";

describe("Ce que cherche l'acheteur", () => {
  it("remplace le résumé de collecte par une phrase claire tirée de l'avis", () => {
    expect(
      offerWhat({
        title: "Maintenance des installations et matériels de la restauration collective",
        summary: "Commune de Joué-lès-Tours — Marché de services",
        description: "Avis publié au BOAMP par Commune de Joué-lès-Tours.\nObjet : Maintenance des installations et matériels de la restauration collective et buanderie.\nType de marché : services.",
        external_buyer_name: "Commune de Joué-lès-Tours",
      }),
    ).toBe("Commune de Joué-lès-Tours cherche un prestataire pour : maintenance des installations et matériels de la restauration collective et buanderie.");
  });
  it("garde un vrai résumé", () => {
    expect(isGenericSummary("La Ville cherche une entreprise pour entretenir les cuisines.")).toBe(false);
    expect(offerWhat({ title: "x", summary: "La Ville cherche une entreprise pour entretenir les cuisines.", description: null })).toBe("La Ville cherche une entreprise pour entretenir les cuisines.");
  });
  it("travaux, majuscules et sigles", () => {
    expect(offerWhat({ title: "REHABILITATION DES BLOCS SANITAIRES", summary: "OPAC — Marché de travaux", description: null })).toBe("OPAC cherche une entreprise de travaux pour : rehabilitation des blocs sanitaires.");
  });
  it("laisse la description libre quand l'avis n'a pas de ligne « Objet »", () => {
    expect(offerWhat({ title: "Travaux électriques", summary: null, description: "Remplacement des tableaux électriques de l'école." })).toBeNull();
  });
});
