import { describe, expect, it } from "vitest";
import { NUTS_TO_DEPARTMENT, REGIONS, locateNuts, regionBySlug, regionForNuts, slugify } from "@/lib/geo";
import { mapTedNotice } from "@/lib/collect/connectors";
import { parseOpportunityFilters, filtersToRpcArgs } from "@/lib/search-params";

describe("référentiel géographique national", () => {
  it("couvre les 18 régions et les 101 départements via NUTS", () => {
    expect(REGIONS).toHaveLength(18);
    expect(Object.keys(NUTS_TO_DEPARTMENT)).toHaveLength(101);
    expect(new Set(Object.values(NUTS_TO_DEPARTMENT)).size).toBe(101);
  });
  it("localise un lieu d'exécution TED (département, région)", () => {
    expect(locateNuts(["FR101"])).toEqual({ departmentCode: "75", region: "Île-de-France" });
    expect(locateNuts(["FRJ23"])).toEqual({ departmentCode: "31", region: "Occitanie" });
    expect(locateNuts(["FRY40"])).toEqual({ departmentCode: "974", region: "La Réunion" });
    expect(locateNuts(["FRK"])).toEqual({ departmentCode: null, region: "Auvergne-Rhône-Alpes" });
    // Marché multi-régions : pas de région unique
    expect(locateNuts(["FRH02", "FR101"]).region).toBeNull();
    expect(regionForNuts("DE300")).toBeNull();
  });
  it("normalise les codes département de BOAMP (« 6 », « 20B »)", async () => {
    const { normalizeDepartment } = await import("@/lib/geo");
    expect(["6", "06", "20B", "2a", "971", "x", ""].map(normalizeDepartment)).toEqual(["06", "06", "2B", "2A", "971", null, null]);
    const { mapBoampRecord } = await import("@/lib/collect/connectors");
    const r = mapBoampRecord({ idweb: "26-1", objet: "Aménagement du carrefour de Neru", code_departement: ["20B"], url_avis: "https://www.boamp.fr/x" });
    expect(r.ok && r.item.departmentCode).toBe("2B");
  });
  it("mappe une annonce TED hors Bretagne", () => {
    const r = mapTedNotice({ "publication-number": "1-2026", "notice-title": { fra: "France – Travaux – Rénovation d'un collège à Lyon" }, "place-of-performance": ["FRK26"] }, []);
    expect(r.ok && r.item).toMatchObject({ departmentCode: "69", region: "Auvergne-Rhône-Alpes" });
  });
  it("lit les filtres région, ville et source depuis l'URL", () => {
    const f = parseOpportunityFilters({ region: "ile-de-france", ville: "Paris", source: "boamp" });
    expect(f).toMatchObject({ region: "ile-de-france", city: "Paris", source: "boamp" });
    expect(filtersToRpcArgs(f)).toMatchObject({ p_region: "Île-de-France", p_city: "Paris", p_source: "boamp" });
    expect(parseOpportunityFilters({ region: "atlantide" }).region).toBeUndefined();
    expect(regionBySlug("provence-alpes-cote-d-azur")?.name).toBe("Provence-Alpes-Côte d'Azur");
    expect(slugify("Provence-Alpes-Côte d'Azur")).toBe("provence-alpes-cote-d-azur");
  });
});
