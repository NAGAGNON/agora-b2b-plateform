import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buyingScore, type BuyerSignals } from "@/lib/buying-score";
import { getOpenCounts, getSectorLabels } from "@/lib/queries/platform";
import { sectorLabel } from "@/lib/constants";

type Db = ReturnType<typeof createAdminClient>;

export type BuyerProfile = {
  userId: string;
  name: string | null;
  email: string;
  company: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  signals: BuyerSignals;
  /** Métier le plus consulté (libellé), et marchés ouverts dans ce métier aujourd'hui */
  topSector: string | null;
  topSectorSlug: string | null;
  openInSector: number;
  /** Départements les plus regardés */
  topDepartments: string[];
} & ReturnType<typeof buyingScore>;

/**
 * Profils commerciaux des membres (équipe et comptes de démonstration exclus), classés du plus
 * susceptible de payer au moins susceptible. Uniquement des actions réellement enregistrées.
 */
export async function loadBuyerProfiles(db: Db = createAdminClient(), userIds?: string[]): Promise<BuyerProfile[]> {
  let q = db.from("users").select("id, full_name, email, created_at, last_seen_at").eq("status", "ACTIVE").eq("platform_role", "USER").eq("is_internal", false).eq("is_demo", false).limit(5000);
  if (userIds) q = q.in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: users } = await q;
  const list = users ?? [];
  if (!list.length) return [];
  const ids = list.map((u) => u.id);
  const [{ data: events }, { data: visits }, { data: favs }, { data: alerts }, { data: members }, labels, count] = await Promise.all([
    db.from("analytics_events").select("user_id, event_name, properties").in("user_id", ids).in("event_name", ["view_opportunity", "search_opportunities", "source_outbound_clicked", "create_alert", "save_favorite"]).limit(100000),
    db.from("user_visits").select("user_id").in("user_id", ids).limit(100000),
    db.from("favorites").select("user_id").in("user_id", ids).limit(100000),
    db.from("alerts").select("user_id").in("user_id", ids).limit(100000),
    db.from("company_members").select("user_id, companies(name)").in("user_id", ids),
    getSectorLabels(),
    getOpenCounts(),
  ]);
  // Métier et départements des marchés consultés
  const viewed = new Map<string, string[]>();
  for (const e of events ?? []) {
    if (e.event_name !== "view_opportunity" || !e.user_id) continue;
    const id = (e.properties as { opportunity_id?: string } | null)?.opportunity_id;
    if (id) viewed.set(e.user_id, [...(viewed.get(e.user_id) ?? []), id]);
  }
  const oppIds = [...new Set([...viewed.values()].flat())].slice(0, 5000);
  const opps = new Map<string, { sector: string | null; dep: string | null }>();
  for (let i = 0; i < oppIds.length; i += 500) {
    const { data } = await db.from("opportunities").select("id, sector_slug, department_code").in("id", oppIds.slice(i, i + 500));
    for (const o of data ?? []) opps.set(o.id, { sector: o.sector_slug, dep: o.department_code });
  }
  const tally = (arr: (string | null)[]) => {
    const m = new Map<string, number>();
    for (const v of arr) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  };
  const by = <T extends { user_id: string | null }>(rows: T[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) if (r.user_id) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
    return m;
  };
  const ev = (name: string) => by((events ?? []).filter((e) => e.event_name === name));
  const [views, searches, sources, alertEvents, favEvents] = [ev("view_opportunity"), ev("search_opportunities"), ev("source_outbound_clicked"), ev("create_alert"), ev("save_favorite")];
  const days = by(visits as { user_id: string }[] | null);
  const favCount = by(favs);
  const alertCount = by(alerts);
  const company = new Map<string, string>();
  for (const m of members ?? []) {
    const c = m.companies as { name?: string } | null;
    if (c?.name && !company.has(m.user_id)) company.set(m.user_id, c.name);
  }
  return list
    .map((u) => {
      const signals: BuyerSignals = {
        days: days.get(u.id) ?? 0,
        views: views.get(u.id) ?? 0,
        searches: searches.get(u.id) ?? 0,
        sources: sources.get(u.id) ?? 0,
        alerts: Math.max(alertCount.get(u.id) ?? 0, alertEvents.get(u.id) ?? 0),
        favorites: Math.max(favCount.get(u.id) ?? 0, favEvents.get(u.id) ?? 0),
        hasCompany: company.has(u.id),
      };
      const seen = (viewed.get(u.id) ?? []).map((id) => opps.get(id)).filter(Boolean) as { sector: string | null; dep: string | null }[];
      const topSectorSlug = tally(seen.map((o) => o.sector))[0] ?? null;
      return {
        userId: u.id,
        name: u.full_name,
        email: u.email,
        company: company.get(u.id) ?? null,
        createdAt: u.created_at,
        lastSeenAt: u.last_seen_at,
        signals,
        topSectorSlug,
        topSector: topSectorSlug ? sectorLabel(topSectorSlug, labels) : null,
        openInSector: topSectorSlug ? count("sector", topSectorSlug) : 0,
        topDepartments: tally(seen.map((o) => o.dep)).slice(0, 3),
        ...buyingScore(signals),
      };
    })
    .sort((a, b) => b.score - a.score || (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? ""));
}
