import { describe, expect, it } from "vitest";
import { classifySector } from "@/lib/collect/classify";

const c = (t: string) => classifySector([], t).sector;

describe("classement des métiers : offres auparavant sans métier", () => {
  it("reconnaît les expressions ajoutées", () => {
    expect(c("ACCORD CADRE A BON DE COMMANDE POUR DES PRESTATIONS VIDEO")).toBe("communication-evenementiel");
    expect(c("Restructuration du collège Joseph FONTANET à Frontenex")).toBe("travaux-btp");
    expect(c("Réalisation de signalisation horizontale sur les routes départementales")).toBe("travaux-btp");
    expect(c("Prestations de numérisation et d'océrisation de documents d'archives")).toBe("services-aux-entreprises");
    expect(c("Etude hydrologique et de ruissellement sur le bassin versant")).toBe("ingenierie-etudes");
    expect(c("Analyses de polluants")).toBe("ingenierie-etudes");
    expect(c("service de déneigement")).toBe("espaces-verts");
    expect(c("Prestations de transports sanitaires terrestres")).toBe("transport-logistique");
    expect(c("Prestations de collecte et de recyclage de vêtements professionnels usagés")).toBe("nettoyage-proprete");
    expect(c("Direction artistique du festival")).toBe("communication-evenementiel");
  });
  it("ne change pas les classements existants", () => {
    expect(c("Maintenance des ascenseurs")).toBe("maintenance-industrielle");
    expect(c("Fourniture de carburant")).toBe("transport-logistique");
    expect(c("Contrat d'assurance flotte automobile")).toBe("assurances-finance");
    expect(c("Médecine de prévention pour les agents")).toBe(null);
  });
});
