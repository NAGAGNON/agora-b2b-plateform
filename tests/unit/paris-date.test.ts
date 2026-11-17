import { describe, expect, it } from "vitest";
import { parisDate } from "@/lib/weekly-review-core";

describe("parisDate (membres revenus : jour d'inscription à Paris)", () => {
  it("donne le jour calendaire à Paris, pas en UTC", () => {
    expect(parisDate("2026-11-16T23:30:00Z")).toBe("2026-11-17");
    expect(parisDate("2026-11-16T22:59:00Z")).toBe("2026-11-16");
    expect(parisDate("2026-07-01T22:30:00Z")).toBe("2026-07-02"); // heure d'été
  });
  it("une visite le jour même de l'inscription n'est pas un retour", () => {
    expect(parisDate("2026-11-16T20:00:00Z") > parisDate("2026-11-16T08:00:00Z")).toBe(false);
    expect(parisDate("2026-11-17T06:00:00Z") > parisDate("2026-11-16T08:00:00Z")).toBe(true);
  });
});
