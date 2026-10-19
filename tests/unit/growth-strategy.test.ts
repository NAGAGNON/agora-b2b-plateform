import { describe, expect, it } from "vitest";
import { decideStrategy, DEFAULT_HOME_REGIONS, DEFAULT_STRATEGY, topicSlugs, type GrowthMetrics } from "@/lib/growth/strategy";

const ctx = {
  day: "2026-10-20",
  regionSlugs: new Set(["bretagne", "occitanie", "normandie", ...DEFAULT_HOME_REGIONS]),
  regionName: (s: string) => ({ bretagne: "Bretagne", occitanie: "Occitanie", normandie: "Normandie" })[s] ?? s,
  sectorLabel: (s: string) => ({ "travaux-btp": "Travaux et BTP", informatique: "Informatique" })[s] ?? s,
  deptSlug: (code: string) => ({ "29": "finistere", "35": "ille-et-vilaine" })[code],
};

const empty: GrowthMetrics = { from: "", to: "", visits: 0, from_search: 0, signups: 0, entry_groups: [], search_landings: [], zones: [], articles: [], outreach_sectors: [] };

describe("stratégie automatique", () => {
  it("sans données : stratégie par défaut, aucun changement annoncé", () => {
    const { strategy, changes } = decideStrategy(empty, null, ctx);
    expect(strategy.articles.boosts).toEqual({});
    expect(strategy.home.regions).toEqual(DEFAULT_HOME_REGIONS);
    expect(strategy.articles.per_day).toBe(1);
    expect(changes).toEqual([]);
  });

  it("thèmes d'articles : les pages les plus recherchées et lues passent en premier", () => {
    const m: GrowthMetrics = {
      ...empty,
      search_landings: [{ path: "/opportunites/normandie", visits: 4 }, { path: "/opportunites/selection/x", visits: 9 }],
      zones: [{ slug: "travaux-btp", views: 5 }, { slug: "normandie", views: 2 }],
      articles: [{ slug: "a", topic_key: "departement:29:2026-10", published_at: "", views: 3, search_visits: 1 }],
    };
    const { strategy, changes } = decideStrategy(m, null, ctx);
    // normandie : 4×3 + 2 = 14 (max → 3) ; finistere : 3×2 = 6 ; travaux-btp : 5
    expect(strategy.articles.boosts.normandie).toBe(3);
    expect(strategy.articles.boosts.finistere).toBeCloseTo(1.9, 1);
    expect(strategy.articles.boosts.selection).toBeUndefined();
    expect(changes[0]).toMatchObject({ domaine: "Articles" });
    expect(changes[0].decision).toContain("Normandie");
    // Région demandée mise en avant en tête de l'accueil
    expect(strategy.home.regions[0]).toBe("normandie");
    expect(strategy.home.regions).toHaveLength(7);
  });

  it("type d'article qui obtient le plus de lectures par article en premier", () => {
    const art = (topic_key: string, views: number) => ({ slug: topic_key, topic_key, published_at: "", views, search_visits: 0 });
    const m: GrowthMetrics = { ...empty, articles: [art("region:bretagne:x", 30), art("secteur:informatique:x", 0), art("secteur:travaux-btp:x", 1)] };
    const { strategy, changes } = decideStrategy(m, null, ctx);
    expect(strategy.articles.family_order[0]).toBe("region");
    expect(changes.some((c) => c.decision.includes("analyses par région"))).toBe(true);
  });

  it("rythme des articles : relevé quand ils amènent des visiteurs depuis les moteurs, jamais au-delà de 3", () => {
    const m: GrowthMetrics = { ...empty, articles: [{ slug: "a", topic_key: "secteur:informatique:x", published_at: "", views: 9, search_visits: 6 }] };
    expect(decideStrategy(m, null, ctx).strategy.articles.per_day).toBe(2);
    const at3 = { ...DEFAULT_STRATEGY("x"), articles: { ...DEFAULT_STRATEGY("x").articles, per_day: 3 } };
    expect(decideStrategy(m, at3, ctx).strategy.articles.per_day).toBe(3);
  });

  it("prospection : priorité aux secteurs qui répondent le mieux, rien sous 50 envois", () => {
    const sectors = [
      { sector: "travaux-btp", sent: 60, clicks: 12, signups: 2 },
      { sector: "informatique", sent: 60, clicks: 1, signups: 0 },
    ];
    const { strategy, changes } = decideStrategy({ ...empty, outreach_sectors: sectors }, null, ctx);
    expect(strategy.outreach.sector_priority["travaux-btp"]).toBeGreaterThan(0);
    expect(strategy.outreach.sector_priority.informatique).toBeLessThan(0);
    expect(strategy.outreach.sector_priority["travaux-btp"]).toBeLessThanOrEqual(1);
    expect(changes.find((c) => c.domaine === "Prospection")?.decision).toContain("Travaux et BTP");
    const few = decideStrategy({ ...empty, outreach_sectors: [{ sector: "travaux-btp", sent: 20, clicks: 5, signups: 1 }] }, null, ctx);
    expect(few.strategy.outreach.sector_priority).toEqual({});
  });

  it("points à surveiller : pages qui font fuir et inscriptions inachevées", () => {
    const m: GrowthMetrics = { ...empty, signups: 1, entry_groups: [{ grp: "accueil", visits: 20, bounces: 18, intent: 6, signups: 1, from_search: 3 }] };
    const { strategy } = decideStrategy(m, null, ctx);
    expect(strategy.watch.join(" ")).toContain("accueil : 90 %");
    expect(strategy.watch.join(" ")).toContain("6 visiteurs ont ouvert la page d'inscription, 1 sont allés au bout");
  });

  it("même stratégie que la veille : aucun changement annoncé", () => {
    const m: GrowthMetrics = { ...empty, zones: [{ slug: "normandie", views: 9 }] };
    const first = decideStrategy(m, null, ctx).strategy;
    expect(decideStrategy(m, first, ctx).changes).toEqual([]);
  });

  it("pages couvertes par un thème d'article", () => {
    expect(topicSlugs("secteur:informatique:2026-10", ctx.deptSlug)).toEqual(["informatique"]);
    expect(topicSlugs("departement:29:2026-10", ctx.deptSlug)).toEqual(["finistere"]);
    expect(topicSlugs("secteur-departement:informatique:35:2026-10", ctx.deptSlug)).toEqual(["informatique", "ille-et-vilaine"]);
    expect(topicSlugs("acheteur:ville-de-brest:2026-10", ctx.deptSlug)).toEqual([]);
  });
});
