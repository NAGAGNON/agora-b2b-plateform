import { describe, expect, it } from "vitest";
import { evaluateLaunch } from "@/lib/launch-readiness-core";

describe("Seuils du lancement payant (fixés par le fondateur)", () => {
  it("prêt seulement si les seuils hebdomadaires sont atteints 2 semaines de suite et les entreprises suffisantes", () => {
    expect(evaluateLaunch([{ inscrits: 30, revenus: 16 }, { inscrits: 26, revenus: 15 }], 40).pret).toBe(true);
    expect(evaluateLaunch([{ inscrits: 30, revenus: 16 }, { inscrits: 24, revenus: 15 }], 40).pret).toBe(false);
    expect(evaluateLaunch([{ inscrits: 30, revenus: 16 }, { inscrits: 26, revenus: 15 }], 39).pret).toBe(false);
  });
  it("affiche les chiffres actuels (situation du 16 novembre)", () => {
    const r = evaluateLaunch([{ inscrits: 28, revenus: 7 }, { inscrits: 33, revenus: 3 }], 26);
    expect(r.atteints).toBe(1);
    expect(r.criteres[0]).toMatchObject({ actuel: "28 puis 33", atteint: true });
    expect(r.criteres[1]).toMatchObject({ actuel: "7 puis 3", atteint: false });
  });
});
