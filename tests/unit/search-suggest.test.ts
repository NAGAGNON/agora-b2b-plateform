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
