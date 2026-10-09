import { describe, expect, it } from "vitest";
import { listingIndexing, pageMetadata } from "@/lib/seo";

describe("référencement : listes et métadonnées", () => {
  it("pagination seule indexable (adresse canonique propre), filtres non indexés", () => {
    expect(listingIndexing("/analyses", {})).toEqual({ path: "/analyses", filtered: false });
    expect(listingIndexing("/analyses", { page: "1" })).toEqual({ path: "/analyses", filtered: false });
    expect(listingIndexing("/opportunites", { page: "3" })).toEqual({ path: "/opportunites?page=3", filtered: false });
    expect(listingIndexing("/opportunites", { page: "3", secteur: "btp" })).toEqual({ path: "/opportunites", filtered: true });
    expect(listingIndexing("/opportunites", { q: "voirie" }).filtered).toBe(true);
    expect(listingIndexing("/opportunites", { page: "abc" }).filtered).toBe(true);
  });

  it("titre et description aux longueurs affichées par Google, aperçu et carte de partage", () => {
    const m = pageMetadata({ title: "A".repeat(40) + " " + "B".repeat(60), description: "mot ".repeat(80), path: "/x" });
    const title = typeof m.title === "string" ? m.title : (m.title as { absolute: string }).absolute;
    expect(title.length).toBeLessThanOrEqual(65);
    expect((m.description ?? "").length).toBeLessThanOrEqual(158);
    expect(JSON.stringify(m.openGraph)).toContain("/opengraph-image");
    expect(m.twitter).toMatchObject({ card: "summary_large_image" });
    expect(m.alternates?.canonical).toBe("/x");
  });
});
