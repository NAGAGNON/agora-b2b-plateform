import { describe, expect, it } from "vitest";
import { evaluateLaunch } from "@/lib/launch-readiness-core";

describe("Seuils du lancement payant (fixés par le fondateur)", () => {
  it("prêt seulement si les trois seuils sont atteints 2 semaines de suite", () => {
    expect(evaluateLaunch([{ inscrits: 30, revenus: 16, dossiers: 12 }, { inscrits: 26, revenus: 15, dossiers: 10 }], "2026-12-01").pret).toBe(true);
    expect(evaluateLaunch([{ inscrits: 30, revenus: 16, dossiers: 12 }, { inscrits: 26, revenus: 15, dossiers: 9 }], "2026-12-01").pret).toBe(false);
    expect(evaluateLaunch([{ inscrits: 30, revenus: 16, dossiers: 12 }, { inscrits: 24, revenus: 15, dossiers: 10 }], "2026-12-01").pret).toBe(false);
  });
  it("situation du 16 novembre et date de réexamen", () => {
    const r = evaluateLaunch([{ inscrits: 28, revenus: 7, dossiers: 6 }, { inscrits: 33, revenus: 3, dossiers: 0 }], "2026-11-16");
    expect(r.atteints).toBe(1);
    expect(r.criteres[2]).toMatchObject({ actuel: "6 puis 0", atteint: false });
    expect(r.reexamenDu).toBe(false);
    expect(evaluateLaunch([{ inscrits: 28, revenus: 7, dossiers: 6 }, { inscrits: 33, revenus: 3, dossiers: 0 }], "2027-01-15").reexamenDu).toBe(true);
  });
});
