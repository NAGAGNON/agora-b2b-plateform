import { describe, expect, it } from "vitest";
import { parisDayStart, parisToday, unknownReportNumbers, type DailySummary } from "@/lib/daily-report";

const summary = (text: string): DailySummary => ({ titre: text, resume: "", points_forts: [], points_faibles: [], automatique: [], recommandations: [] });

describe("bilan du jour", () => {
  it("minuit à Paris, été comme hiver", () => {
    expect(parisDayStart("2026-10-08").toISOString()).toBe("2026-10-07T22:00:00.000Z");
    expect(parisDayStart("2026-12-15").toISOString()).toBe("2026-12-14T23:00:00.000Z");
  });

  it("jour de Paris (et non UTC) juste après minuit", () => {
    expect(parisToday(new Date("2026-10-07T22:30:00Z"))).toBe("2026-10-08");
  });

  it("repère les nombres absents des faits (anti-invention)", () => {
    const facts = { visites: 42, emails: 7, total: 1250 };
    expect(unknownReportNumbers(summary("42 visites et 7 e-mails, 1 250 au total"), facts)).toEqual([]);
    expect(unknownReportNumbers(summary("43 visites, en hausse de 15"), facts)).toEqual(["43", "15"]);
  });
});
