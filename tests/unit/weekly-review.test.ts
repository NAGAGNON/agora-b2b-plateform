import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
import { fallbackSummary, frWeek, unknownNumbers, variation, weekDays, type WeeklyFacts } from "@/lib/weekly-review-core";

const facts: WeeklyFacts = {
  semaine: { du: "2026-11-09", au: "2026-11-15" },
  precedente: { du: "2026-11-02", au: "2026-11-08" },
  chiffres: [
    { cle: "inscrits", libelle: "Nouveaux inscrits", semaine: 27, precedente: 18 },
    { cle: "emails", libelle: "E-mails envoyés", semaine: 137, precedente: 200 },
    { cle: "besoins", libelle: "Besoins publiés", semaine: 0, precedente: 0 },
  ],
};

describe("Analyste du lundi", () => {
  it("analyse la semaine du lundi au dimanche précédent (heure de Paris)", () => {
    // Lundi 16 novembre, 8 h à Paris
    expect(weekDays(new Date("2026-11-16T07:00:00Z"))).toMatchObject({ start: "2026-11-09", end: "2026-11-15", prevStart: "2026-11-02", prevEnd: "2026-11-08" });
    // Dimanche soir : toujours la semaine d'avant (la semaine en cours n'est pas finie)
    expect(weekDays(new Date("2026-11-15T22:30:00Z")).start).toBe("2026-11-02");
    // Dimanche 23 h 30 UTC = lundi 0 h 30 à Paris
    expect(weekDays(new Date("2026-11-15T23:30:00Z")).start).toBe("2026-11-09");
  });

  it("calcule l'évolution en %", () => {
    expect(variation({ semaine: 27, precedente: 18 })).toBe(50);
    expect(variation({ semaine: 3, precedente: 0 })).toBeNull();
  });

  it("refuse un résumé avec un nombre inventé", () => {
    const ok = { titre: "Semaine en hausse", points: [{ tendance: "hausse" as const, texte: "27 inscrits contre 18 (+50 %), soit 9 de plus." }], actions: [] };
    expect(unknownNumbers(ok, facts)).toEqual([]);
    const bad = { ...ok, points: [{ tendance: "hausse" as const, texte: "42 entreprises ont publié un besoin." }] };
    expect(unknownNumbers(bad, facts)).toEqual(["42"]);
  });

  it("résumé de secours sans IA, en français", () => {
    const s = fallbackSummary(facts);
    expect(s.titre).toBe("27 nouveaux inscrits cette semaine.");
    expect(s.points[0].texte).toContain("Nouveaux inscrits : 27");
    expect(s.points.some((p) => p.texte.includes("Besoins"))).toBe(false);
    expect(unknownNumbers(s, facts)).toEqual([]);
    expect(frWeek(facts.semaine)).toBe("du 9 novembre au 15 novembre");
    expect(frWeek({ du: "2026-10-26", au: "2026-11-01" })).toBe("du 26 octobre au 1er novembre");
  });
});

describe("E-mail de l'Analyste du lundi", () => {
  it("affiche les constats, les actions et le tableau des chiffres", async () => {
    const { renderWeeklyReviewEmail } = await import("@/lib/weekly-review");
    const summary = { titre: "Une semaine qui accélère", points: [{ tendance: "hausse" as const, texte: "27 nouveaux inscrits contre 18." }], actions: ["Relancer les inscrits sans entreprise."] };
    const msg = renderWeeklyReviewEmail({ week_start: "2026-11-09", generated_at: "2026-11-16T07:00:00Z", facts, summary, error: null, emailed_at: null });
    expect(msg.subject).toBe("Analyste du lundi : Une semaine qui accélère");
    expect(msg.html).toContain("27 nouveaux inscrits contre 18.");
    expect(msg.html).toContain("À faire cette semaine");
    expect(msg.html).toContain("+9 (+50 %)");
    expect(msg.text).toContain("- Nouveaux inscrits : 27 / 18");
    if (process.env.WEEKLY_EMAIL_OUT) (await import("node:fs")).writeFileSync(process.env.WEEKLY_EMAIL_OUT, msg.html);
  });
});
