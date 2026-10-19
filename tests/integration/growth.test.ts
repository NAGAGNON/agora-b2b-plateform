/**
 * Stratégie automatique : chiffres calculés en base à partir des visites réelles (sessions, pages
 * d'entrée, moteurs de recherche, inscriptions), stratégie enregistrée et appliquée (accueil,
 * thèmes d'articles), désactivation possible.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, RUN } from "./helpers";
import { currentStrategy, runGrowthStrategy } from "@/lib/growth/engine";
import { candidateTopics } from "@/lib/articles";
import type { GrowthMetrics } from "@/lib/growth/strategy";

const ZONE = `zz-test-${RUN.toLowerCase()}`;
const keys = ["private.growth_strategy", "private.growth_enabled", "growth_public"];
const saved = new Map<string, unknown>();
const sessions: string[] = [];
let today = "";

beforeAll(async () => {
  for (const k of keys) saved.set(k, (await admin.from("platform_settings").select("value").eq("key", k).maybeSingle()).data?.value ?? null);
  await admin.from("platform_settings").delete().eq("key", "private.growth_enabled");
  const at = (min: number) => new Date(Date.now() - 2 * 3_600_000 + min * 60_000).toISOString();
  const visit = async (pages: string[], ref: string | null) => {
    const sid = randomUUID();
    sessions.push(sid);
    const { error } = await admin.from("page_views").insert(pages.map((path, i) => ({ session_id: sid, path, referrer_host: i === 0 ? ref : null, created_at: at(i) })));
    if (error) throw error;
  };
  // 3 visiteurs Google arrivés sur la page de la zone, dont 1 inscrit ; 1 visiteur direct reparti aussitôt
  await visit([`/opportunites/${ZONE}`, "/inscription", "/onboarding/entreprise"], "google.com");
  await visit([`/opportunites/${ZONE}`, "/opportunites"], "google.fr");
  await visit([`/opportunites/${ZONE}`], "bing.com");
  await visit(["/"], null);
});

afterAll(async () => {
  await admin.from("page_views").delete().in("session_id", sessions);
  if (today) await admin.from("growth_snapshots").delete().eq("day", today);
  for (const k of keys) {
    const v = saved.get(k);
    if (v === null) await admin.from("platform_settings").delete().eq("key", k);
    else await admin.from("platform_settings").upsert({ key: k, value: v as never });
  }
});

describe("stratégie automatique", () => {
  it("chiffres réels : pages d'entrée, moteurs de recherche, inscriptions", async () => {
    const { data, error } = await admin.rpc("growth_metrics", { p_from: new Date(Date.now() - 86_400_000).toISOString(), p_to: new Date().toISOString() });
    expect(error).toBeNull();
    const m = data as unknown as GrowthMetrics;
    const zones = m.entry_groups.find((g) => g.grp === "pages régions et secteurs")!;
    expect(zones.visits).toBeGreaterThanOrEqual(3);
    expect(zones.from_search).toBeGreaterThanOrEqual(3);
    expect(zones.intent).toBeGreaterThanOrEqual(1);
    expect(zones.signups).toBeGreaterThanOrEqual(1);
    expect(m.search_landings.find((l) => l.path === `/opportunites/${ZONE}`)?.visits).toBe(3);
    expect(m.zones.find((z) => z.slug === ZONE)?.views).toBe(3);
    // Fonction réservée au serveur
    const { error: anonError } = await (await import("./helpers")).anon().rpc("growth_metrics", { p_from: new Date(0).toISOString(), p_to: new Date().toISOString() });
    expect(anonError).not.toBeNull();
  });

  it("calcul du soir : stratégie enregistrée, historique, accueil et thèmes d'articles adaptés", async () => {
    const r = await runGrowthStrategy();
    today = r.day;
    expect(r.skipped).toBeUndefined();
    const s = await currentStrategy(admin);
    expect(s?.version).toBe(1);
    expect(s!.articles.boosts[ZONE]).toBeGreaterThan(0);
    const { data: snap } = await admin.from("growth_snapshots").select("metrics, strategy, changes").eq("day", r.day).single();
    expect(snap?.strategy).toMatchObject({ version: 1, day: r.day });
    const { data: pub } = await admin.from("platform_settings").select("value").eq("key", "growth_public").single();
    expect((pub?.value as { home_regions: string[] }).home_regions).toHaveLength(7);

    // Un thème moins fourni mais plus recherché passe devant
    const opp = (sector: string, i: number) => ({ id: `${sector}-${i}`, title: "t", type: "PUBLIC_TENDER", origin: "EXTERNAL", external_buyer_name: null, city: null, department_code: null, region: null, sector_slug: sector, response_deadline: null, published_at: null });
    const ctx = {
      opps: [...Array.from({ length: 9 }, (_, i) => opp("gros-secteur", i)), ...Array.from({ length: 5 }, (_, i) => opp(ZONE, i))],
      sectors: new Map([["gros-secteur", "Gros secteur"], [ZONE, "Secteur recherché"]]),
      departments: new Map(),
      types: new Map(),
      used: new Set<string>(),
    };
    expect(candidateTopics(ctx as never, new Date(), null)[0].page).toBe("/opportunites/gros-secteur");
    expect(candidateTopics(ctx as never, new Date(), s)[0].page).toBe(`/opportunites/${ZONE}`);
  });

  it("désactivée : plus de calcul, le site reprend son comportement habituel", async () => {
    await admin.from("platform_settings").upsert({ key: "private.growth_enabled", value: { enabled: false } });
    expect(await runGrowthStrategy()).toMatchObject({ skipped: "Stratégie automatique désactivée" });
    expect(await currentStrategy(admin)).toBeNull();
    await admin.from("platform_settings").delete().eq("key", "private.growth_enabled");
  });
});
