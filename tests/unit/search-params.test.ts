import { describe, expect, it } from "vitest";
import { activeFilterCount, filtersToRpcArgs, parseCompanyFilters, parseOpportunityFilters } from "@/lib/search-params";

describe("filtres de recherche", () => {
  it("applique des valeurs par défaut sûres", () => {
    const f = parseOpportunityFilters({});
    expect(f).toMatchObject({ status: "OPEN", sort: "recent", page: 1, types: [], skills: [] });
    expect(activeFilterCount(f)).toBe(0);
  });

  it("ignore les valeurs invalides ou malveillantes", () => {
    const f = parseOpportunityFilters({ secteur: "drop table", departement: "999999", type: ["NEED", "HACK"], tri: "random", page: "-3", lieu: "../etc", taille: "XXL", rayon: "abc" });
    expect(f.sector).toBeUndefined();
    expect(f.department).toBeUndefined();
    expect(f.types).toEqual(["NEED"]);
    expect(f.sort).toBe("recent");
    expect(f.page).toBe(1);
    expect(f.place).toBeUndefined();
    expect(f.size).toBeUndefined();
    expect(f.radius).toBeUndefined();
  });

  it("lit les filtres valides", () => {
    const now = new Date("2026-10-06T00:00:00Z");
    const f = parseOpportunityFilters(
      { q: "compresseur", secteur: "maintenance-industrielle", departement: "29", lieu: "brest", rayon: "25", type: "NEED,QUOTE_REQUEST", origine: "EXTERNAL", publiee: "7", page: "2", competences: "hydraulique, soudure" },
      now,
    );
    expect(f).toMatchObject({ q: "compresseur", sector: "maintenance-industrielle", department: "29", place: "brest", radius: 25, origin: "EXTERNAL", page: 2, sort: "relevance" });
    expect(f.types).toEqual(["NEED", "QUOTE_REQUEST"]);
    expect(f.publishedSince).toBe("2026-09-29");
    expect(f.skills).toEqual(["hydraulique", "soudure"]);
    expect(activeFilterCount(f)).toBe(7);
  });

  it("borne le rayon et convertit en arguments RPC", () => {
    const f = parseOpportunityFilters({ rayon: "5000", page: "3" });
    expect(f.radius).toBe(500);
    const args = filtersToRpcArgs(f, 12);
    expect(args.p_offset).toBe(24);
    expect(args.p_limit).toBe(12);
    // Le rayon n'est transmis que si une ville est choisie.
    expect(args.p_radius_km).toBeUndefined();
  });

  it("annuaire", () => {
    expect(parseCompanyFilters({ type: "SUPPLIER", secteur: "cybersecurite", page: "2" })).toMatchObject({ kind: "SUPPLIER", sector: "cybersecurite", page: 2 });
    expect(parseCompanyFilters({ type: "ROBOT" }).kind).toBeUndefined();
  });
});
