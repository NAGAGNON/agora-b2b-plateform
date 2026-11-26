import { describe, expect, it } from "vitest";
import { certificationMatch, computeCompatibility, type CompatCompany, type CompatOffer } from "@/lib/compatibility";

const offer: CompatOffer = { title: "Maintenance des équipements de chauffage", summary: null, sector_slug: "maintenance-industrielle", department_code: "29", region: "Bretagne", lat: 48.39, lng: -4.49 };
const company: CompatCompany = { sectors: ["maintenance-industrielle"], skills: [], certifications: ["Qualibat 1311"], department: "29", region: "Bretagne", lat: 48.4, lng: -4.5, radiusKm: 50, zone: null };

describe("compatibilité entreprise / appel d'offres", () => {
  it("métier, zone et certifications réunis : très bonne correspondance", () => {
    const c = computeCompatibility(offer, company, { certifications: ["Qualibat 1311 ou équivalent"], capacity: [] });
    expect(c.score).toBe(100);
    expect(c.level).toBe("high");
    expect(c.questions).toEqual([]);
  });

  it("une certification absente de la fiche baisse la note et devient une question ; « Je l'ai » la remonte", () => {
    const req = { certifications: ["RGE"], capacity: [] };
    const before = computeCompatibility(offer, company, req);
    expect(before.score).toBeLessThan(100);
    expect(before.questions).toEqual([{ text: "RGE", kind: "cert", answer: null }]);
    expect(before.suggestPartner).toBe(true);
    const after = computeCompatibility(offer, company, req, null, { RGE: true });
    expect(after.score).toBe(100);
    expect(computeCompatibility(offer, company, req, null, { RGE: false }).score).toBe(before.score);
  });

  it("autres conditions : jamais comptées sans réponse, puis « Je ne l'ai pas » fait baisser", () => {
    const req = { certifications: [], capacity: ["Chiffre d'affaires minimum de 500 000 €"] };
    expect(computeCompatibility(offer, company, req).score).toBe(100);
    expect(computeCompatibility(offer, company, req, null, { "Chiffre d'affaires minimum de 500 000 €": false }).score).toBeLessThan(100);
    expect(computeCompatibility(offer, company, req, null, { "Chiffre d'affaires minimum de 500 000 €": true }).score).toBe(100);
  });

  it("ce qu'on ne sait pas ne compte jamais contre l'entreprise ; trop peu d'éléments : pas de note", () => {
    const empty: CompatCompany = { ...company, sectors: [], certifications: [], department: null, region: null, lat: null, lng: null };
    const c = computeCompatibility(offer, empty, null);
    expect(c.score).toBeNull();
    expect(c.profileIncomplete).toBe(true);
  });

  it("hors zone et autre métier : faible correspondance", () => {
    const far: CompatCompany = { ...company, sectors: ["nettoyage"], department: "13", region: "Provence-Alpes-Côte d'Azur", lat: 43.3, lng: 5.4 };
    const c = computeCompatibility(offer, far, { certifications: [], capacity: [] });
    expect(c.level).toBe("low");
  });

  it("reconnaît une certification déclarée autrement écrite, sans confondre les numéros", () => {
    expect(certificationMatch("Qualibat 1311 ou équivalent", ["QUALIBAT 1311"])).toBe(true);
    expect(certificationMatch("ISO 9001", ["iso 14001"])).toBe(false);
    expect(certificationMatch("RGE", ["Qualibat RGE"])).toBe(true);
  });
});
