import { describe, expect, it } from "vitest";
import { daysUntil, deadlineLabel, formatBudget, formatBytes, initials, isUuid, slugify, splitList } from "@/lib/format";

describe("format", () => {
  it("formate un budget selon les bornes disponibles", () => {
    expect(formatBudget(null, null)).toBeNull();
    expect(formatBudget(1000, null)).toMatch(/^À partir de 1\s?000\s?€$/);
    expect(formatBudget(null, 5000)).toMatch(/^Jusqu'à 5\s?000\s?€$/);
    expect(formatBudget(1000, 5000)).toMatch(/1\s?000\s?€ – 5\s?000\s?€/);
    expect(formatBudget(2000, 2000)).toMatch(/^2\s?000\s?€$/);
  });

  it("calcule les jours restants et le libellé d'échéance", () => {
    const now = new Date("2026-10-06T10:00:00Z");
    expect(daysUntil("2026-10-16T10:00:00Z", now)).toBe(10);
    expect(daysUntil(null, now)).toBeNull();
    expect(deadlineLabel("2026-10-05T10:00:00Z", now)).toBe("Date limite dépassée");
    expect(deadlineLabel("2026-10-06T12:00:00Z", now)).toBe("Encore 1 jour");
    expect(deadlineLabel("2026-10-16T10:00:00Z", now)).toBe("Encore 10 jours");
    expect(deadlineLabel("2027-01-16T10:00:00Z", now)).toMatch(/^Jusqu'au/);
  });

  it("découpe une liste saisie sans doublons", () => {
    expect(splitList("hydraulique, Soudure ; hydraulique\n  automatisme ")).toEqual(["hydraulique", "Soudure", "automatisme"]);
    expect(splitList("")).toEqual([]);
    expect(splitList("a,b,c,d", 2)).toEqual(["a", "b"]);
  });

  it("produit des slugs ASCII", () => {
    expect(slugify("Côtes-d'Armor")).toBe("cotes-d-armor");
    expect(slugify("  Démo Usinage de Cornouaille ")).toBe("demo-usinage-de-cornouaille");
  });

  it("divers", () => {
    expect(isUuid("1957400d-6f93-4541-bb4e-edc17e49967e")).toBe(true);
    expect(isUuid("maintenance-industrielle")).toBe(false);
    expect(initials("Jordan Démo")).toBe("JD");
    expect(formatBytes(2048)).toBe("2 Ko");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 Mo");
  });
});
