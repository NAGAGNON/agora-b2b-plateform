import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

const { tedId } = await import("@/lib/tender-brief");
const { briefDocument, briefFileName } = await import("@/lib/tender-brief-export");

const brief = {
  summary: "Réhabilitation d'un collège en 8 lots.",
  deadline: "lundi 7 décembre 2026 à 12 h",
  site_visit: "Obligatoire",
  duration: null,
  pricing: "Forfaitaires",
  lots: ["Lot 1 · Démolition"],
  documents: ["DC1", "DC2"],
  judging: "Selon le règlement de consultation.",
  todo: ["Télécharger le dossier", "S'inscrire à la visite"],
  warnings: ["Visite obligatoire"],
};

describe("fiche synthèse : avis TED et téléchargement", () => {
  it("numéro TED tiré de l'adresse de l'avis", () => {
    expect(tedId("https://ted.europa.eu/fr/notice/-/detail/771559-2026")).toBe("771559-2026");
    expect(tedId("https://www.boamp.fr/pages/avis/?q=idweb:26-108110")).toBeNull();
  });

  it("document : étapes cochées, contenu échappé, impression pour le PDF seulement", () => {
    const pdf = briefDocument({ ...brief, judging: "<b>prix</b>" }, { title: "Collège", buyer: "Département", url: "https://x/o/1", source: "BOAMP 26-108110", done: [1], print: true });
    expect(pdf).toContain("☐ Télécharger le dossier");
    expect(pdf).toContain("☑ S&#39;inscrire à la visite");
    expect(pdf).toContain("&lt;b&gt;prix&lt;/b&gt;");
    expect(pdf).toContain("window.print");
    expect(pdf).not.toMatch(/\bIA\b|intelligence artificielle/i);
    expect(briefDocument(brief, { title: "Collège", buyer: null, url: "u", source: null, done: [], print: false })).not.toContain("window.print");
    expect(briefFileName("Réhabilitation du Collège Marc Bloch !", "doc")).toBe("fiche-synthese-rehabilitation-du-college-marc-bloch.doc");
  });
});
