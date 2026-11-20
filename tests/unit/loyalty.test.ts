import { describe, expect, it } from "vitest";
import { loyaltyFromDays, loyaltyLabel } from "@/lib/admin/user-activity";

describe("fidélité d'un inscrit (jours de visite)", () => {
  it("compte les jours différents et les jours de suite jusqu'au dernier", () => {
    const l = loyaltyFromDays(["2026-11-17", "2026-11-20", "2026-11-19", "2026-11-18", "2026-11-10"]);
    expect(l).toEqual({ days: 5, streak: 4, lastDay: "2026-11-20" });
    expect(loyaltyLabel(l)).toBe("5e jour de visite · 4 jours de suite");
  });
  it("une interruption remet la série à 1", () => {
    const l = loyaltyFromDays(["2026-11-20", "2026-11-18"]);
    expect(l.streak).toBe(1);
    expect(loyaltyLabel(l)).toBe("2e jour de visite");
  });
  it("premier jour", () => {
    expect(loyaltyLabel(loyaltyFromDays(["2026-11-20"]))).toBe("1er jour de visite");
    expect(loyaltyLabel(loyaltyFromDays([]))).toBeNull();
  });
});
