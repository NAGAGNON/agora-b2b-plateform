import { describe, expect, it } from "vitest";
import { buyingScore } from "@/lib/buying-score";

const none = { days: 1, views: 0, searches: 0, sources: 0, alerts: 0, favorites: 0, hasCompany: false };

describe("score commercial", () => {
  it("applique le barème critère par critère", () => {
    expect(buyingScore(none).score).toBe(0);
    expect(buyingScore({ ...none, days: 2 }).base).toBe(20);
    expect(buyingScore({ ...none, views: 1 }).base).toBe(10);
    expect(buyingScore({ ...none, sources: 1 }).base).toBe(15);
    expect(buyingScore({ ...none, alerts: 1 }).base).toBe(15);
    expect(buyingScore({ ...none, favorites: 1 }).base).toBe(10);
    expect(buyingScore({ ...none, hasCompany: true }).base).toBe(10);
  });
  it("classe un membre très actif en « chaud » et plafonne le bonus", () => {
    const r = buyingScore({ days: 6, views: 141, searches: 66, sources: 22, alerts: 1, favorites: 2, hasCompany: true });
    expect(r.base).toBe(80);
    expect(r.bonus).toBe(20);
    expect(r.level).toBe("CHAUD");
  });
  it("niveau tiède et froid", () => {
    expect(buyingScore({ ...none, days: 2, views: 3, hasCompany: true }).level).toBe("TIEDE");
    expect(buyingScore({ ...none, views: 3 }).level).toBe("FROID");
  });
});
