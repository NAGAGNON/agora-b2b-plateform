import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
const { boampId, BriefSchema } = await import("@/lib/tender-brief");

describe("fiche synthèse", () => {
  it("identifiant de l'avis BOAMP tiré de l'adresse de la source", () => {
    expect(boampId("https://www.boamp.fr/pages/avis/?q=idweb:26-108110")).toBe("26-108110");
    expect(boampId("https://ted.europa.eu/fr/notice/-/detail/123456-2026")).toBeNull();
    expect(boampId(null)).toBeNull();
  });

  it("une information absente reste vide (rien n'est inventé)", () => {
    const r = BriefSchema.safeParse({ summary: "Réhabilitation d'un collège.", deadline: "lundi 7 décembre 2026 à 12 h", site_visit: null, duration: null, pricing: null, lots: [], documents: [], judging: "Critères détaillés dans le règlement de consultation.", todo: [], warnings: [] });
    expect(r.success).toBe(true);
    expect(BriefSchema.safeParse({ summary: "x" }).success).toBe(false);
  });
});
