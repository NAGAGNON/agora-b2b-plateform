import { describe, expect, it } from "vitest";
import { matchRank, norm, suggest } from "@/lib/search-suggest";

const src = {
  sectors: [{ slug: "electricite-automatisme", label: "Électricité et automatisme" }, { slug: "nettoyage-proprete", label: "Nettoyage et propreté" }],
  departments: [{ code: "69", name: "Rhône" }, { code: "29", name: "Finistère" }],
  places: [{ name: "Lyon", department_code: "69" }, { name: "Lyon 3e", department_code: "69" }],
};

describe("suggestions de recherche", () => {
  it("sans accents, sur le début des mots", () => {
    expect(norm("Électricité")).toBe("electricite");
    expect(matchRank("Électricité et automatisme", "elec")).toBe(0);
    expect(matchRank("éclairage public", "pub")).toBe(1);
    expect(matchRank("plomberie", "elec")).toBeNull();
  });
  it("« elec » propose électricité en premier, puis le secteur", () => {
    const s = suggest("elec", src);
    expect(s[0]).toMatchObject({ kind: "mot", label: "électricité" });
    expect(s.some((x) => x.kind === "secteur" && x.value === "electricite-automatisme")).toBe(true);
  });
  it("villes, départements et numéro de département", () => {
    expect(suggest("lyo", src).map((x) => x.label)).toContain("Lyon");
    expect(suggest("finis", src)[0]).toMatchObject({ kind: "departement", value: "29" });
    expect(suggest("29", src)[0]).toMatchObject({ kind: "departement", value: "29" });
  });
  it("rien sous 2 lettres", () => {
    expect(suggest("e", src)).toEqual([]);
  });
});

describe("fautes de frappe et noms de métiers", () => {
  it("distance d'édition", async () => {
    const { editDistance } = await import("@/lib/search-suggest");
    expect(editDistance("netoyage", "nettoyage")).toBe(1);
    expect(editDistance("plombier", "plombier")).toBe(0);
  });
  it("corrige une recherche mal orthographiée, laisse une recherche correcte", async () => {
    const { correctQuery } = await import("@/lib/search-suggest");
    expect(correctQuery("nétoyage")).toBe("nettoyage");
    expect(correctQuery("maconerie")).toBe("maçonnerie");
    expect(correctQuery("electrisité")).toBe("électricité");
    expect(correctQuery("nettoyage de bureaux")).toBeNull();
    expect(correctQuery("plombier")).toBeNull();
    // Mots courts : pas de correction hasardeuse
    expect(correctQuery("BTP")).toBeNull();
  });
  it("la petite barre propose les métiers et tolère une faute", () => {
    expect(suggest("plomb", src).map((s) => s.label)).toContain("plombier");
    expect(suggest("netoy", src).some((s) => s.label === "nettoyage")).toBe(true);
  });
});

describe("indexation des listes", () => {
  it("les paramètres de suivi (publicité, partage) ne rendent pas la page « filtrée »", async () => {
    const { listingIndexing } = await import("@/lib/seo");
    expect(listingIndexing("/opportunites/nettoyage-proprete", { utm_source: "google", gclid: "x" })).toEqual({ path: "/opportunites/nettoyage-proprete", filtered: false });
    expect(listingIndexing("/opportunites/nettoyage-proprete", { q: "vitres" }).filtered).toBe(true);
  });
});
