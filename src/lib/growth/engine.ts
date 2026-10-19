import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";
import { REGIONS } from "@/lib/geo";
import { parisToday } from "@/lib/daily-report";
import { decideStrategy, DEFAULT_STRATEGY, type Change, type GrowthMetrics, type GrowthStrategy } from "@/lib/growth/strategy";

type Db = ReturnType<typeof createAdminClient>;

export const GROWTH_WINDOW_DAYS = 14;
const STRATEGY_KEY = "private.growth_strategy";
const ENABLED_KEY = "private.growth_enabled";
/** Partie publique (lue par la page d'accueil) */
const PUBLIC_KEY = "growth_public";

/** Stratégie automatique activée (par défaut oui ; désactivable dans Administration → Stratégie). */
export async function growthEnabled(db: Db = createAdminClient()): Promise<boolean> {
  const { data } = await db.from("platform_settings").select("value").eq("key", ENABLED_KEY).maybeSingle();
  return (data?.value as { enabled?: boolean } | null)?.enabled !== false;
}

/** Stratégie en vigueur, ou null si désactivée / jamais calculée (le site garde alors son comportement habituel). */
export async function currentStrategy(db: Db = createAdminClient()): Promise<GrowthStrategy | null> {
  if (!(await growthEnabled(db))) return null;
  const { data } = await db.from("platform_settings").select("value").eq("key", STRATEGY_KEY).maybeSingle();
  const s = data?.value as GrowthStrategy | null;
  return s?.version === 1 ? s : null;
}

/**
 * Calcule les chiffres des 14 derniers jours, décide de la stratégie du lendemain et l'applique
 * (une fois par jour ; un nouveau calcul le même jour remplace le précédent). Sans effet si la
 * stratégie automatique est désactivée.
 */
export async function runGrowthStrategy(now = new Date(), db: Db = createAdminClient()): Promise<{ skipped?: string; day: string; changes: Change[]; watch: string[] }> {
  const day = parisToday(now);
  if (!(await growthEnabled(db))) return { skipped: "Stratégie automatique désactivée", day, changes: [], watch: [] };
  const from = new Date(now.getTime() - GROWTH_WINDOW_DAYS * 86_400_000).toISOString();
  const [{ data: metrics, error }, { data: prevRow }, { data: sectors }, { data: departments }, { data: snapshotToday }] = await Promise.all([
    db.rpc("growth_metrics", { p_from: from, p_to: now.toISOString() }),
    db.from("platform_settings").select("value").eq("key", STRATEGY_KEY).maybeSingle(),
    db.from("sectors").select("slug, label"),
    db.from("departments").select("code, slug"),
    db.from("growth_snapshots").select("strategy").eq("day", day).maybeSingle(),
  ]);
  if (error) throw error;
  // Base de comparaison : la stratégie de la veille (un nouveau calcul le même jour repart de la même base)
  const stored = (prevRow?.value ?? null) as GrowthStrategy | null;
  let previous = stored?.version === 1 ? stored : null;
  if (snapshotToday && previous?.day === day) {
    const { data: before } = await db.from("growth_snapshots").select("strategy").lt("day", day).order("day", { ascending: false }).limit(1).maybeSingle();
    previous = (before?.strategy as GrowthStrategy | null) ?? DEFAULT_STRATEGY(day);
  }
  const sectorLabels = new Map((sectors ?? []).map((s) => [s.slug, s.label]));
  const deptSlugs = new Map((departments ?? []).map((d) => [d.code, d.slug]));
  const { strategy, changes } = decideStrategy(metrics as unknown as GrowthMetrics, previous, {
    day,
    regionSlugs: new Set(REGIONS.map((r) => r.slug)),
    regionName: (slug) => REGIONS.find((r) => r.slug === slug)?.name ?? slug,
    sectorLabel: (slug) => sectorLabels.get(slug) ?? slug,
    deptSlug: (code) => deptSlugs.get(code),
  });
  const json = (v: unknown) => v as NonNullable<Json>;
  const writes = await Promise.all([
    db.from("growth_snapshots").upsert({ day, computed_at: now.toISOString(), metrics: json(metrics), strategy: json(strategy), changes: json(changes) }),
    db.from("platform_settings").upsert({ key: STRATEGY_KEY, value: json(strategy), description: "Stratégie automatique (calculée chaque soir)" }),
    db.from("platform_settings").upsert({ key: PUBLIC_KEY, value: json({ home_regions: strategy.home.regions }), description: "Mises en avant de l'accueil (stratégie automatique)" }),
  ]);
  const failed = writes.find((w) => w.error);
  if (failed?.error) throw failed.error;
  return { day, changes, watch: strategy.watch };
}

/** Régions mises en avant sur l'accueil (stratégie du jour, sinon la liste habituelle). */
export function homeRegions(value: unknown): string[] {
  const regions = (value as { home_regions?: unknown } | null)?.home_regions;
  const known = new Set(REGIONS.map((r) => r.slug));
  const list = Array.isArray(regions) ? regions.filter((r): r is string => typeof r === "string" && known.has(r)) : [];
  return list.length ? list.slice(0, 7) : DEFAULT_STRATEGY("").home.regions;
}
