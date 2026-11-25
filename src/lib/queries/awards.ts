import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

export type AwardItem = Database["public"]["Functions"]["winner_awards"]["Returns"][number];
export type TopWinner = Database["public"]["Functions"]["top_winners"]["Returns"][number];

/** Seuils d'indexation : une page n'entre dans Google qu'avec assez de données réelles. */
export const WINNER_MIN_AWARDS = 2;
export const RANKING_MIN_AWARDS = 10;
const since12Months = () => new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);

/** Marchés remportés par une entreprise (clé du nom). */
export const getWinnerAwards = cache(async (key: string): Promise<AwardItem[]> => {
  if (!/^[a-z0-9-]{2,80}$/.test(key)) return [];
  const { data } = await createAdminClient().rpc("winner_awards", { p_key: key, p_limit: 300 });
  return data ?? [];
});

/** Classement des entreprises qui gagnent le plus (12 derniers mois), en cache une heure. */
export const getTopWinners = unstable_cache(
  async (sector: string | null, region: string | null, limit = 20): Promise<TopWinner[]> => {
    const { data } = await createAdminClient().rpc("top_winners", { p_sector: sector ?? undefined, p_region: region ?? undefined, p_since: since12Months(), p_limit: limit });
    return data ?? [];
  },
  ["top-winners-v1"],
  { revalidate: 3600 },
);

/** Nombre d'avis par métier et région, en cache une heure. */
export const getAwardCounts = unstable_cache(
  async () => {
    const { data } = await createAdminClient().rpc("award_counts");
    return (data ?? []).map((r) => ({ sector: r.sector_slug, region: r.region, n: Number(r.n) }));
  },
  ["award-counts-v1"],
  { revalidate: 3600 },
);

/** Entreprises qui ont demandé le retrait de leurs résultats : jamais affichées. */
export const getOptouts = unstable_cache(
  async (): Promise<string[]> => {
    const { data } = await createAdminClient().from("award_optouts").select("winner_key");
    return (data ?? []).map((r) => r.winner_key);
  },
  ["award-optouts-v1"],
  { revalidate: 600 },
);

/** Retire des avis les entreprises qui ont demandé le retrait (et les avis devenus vides). */
export function withoutOptouts(awards: AwardItem[], optouts: string[]): AwardItem[] {
  if (!optouts.length) return awards;
  const out = new Set(optouts);
  return awards
    .map((a) => {
      const keep = a.winner_keys.map((k, i) => (out.has(k) ? -1 : i)).filter((i) => i >= 0);
      return { ...a, winners: keep.map((i) => a.winners[i]), winner_keys: keep.map((i) => a.winner_keys[i]) };
    })
    .filter((a) => a.winners.length > 0);
}

/** Derniers marchés attribués (filtrés par métier, région ou acheteur). */
export const getLatestAwards = unstable_cache(
  async (filter: { sector?: string | null; region?: string | null; buyer?: string | null }, limit = 20): Promise<AwardItem[]> => {
    let q = createAdminClient()
      .from("awards")
      .select("idweb, title, buyer_name, buyer_key, winners, winner_keys, published_on, department_code, region, sector_slug, market_type, url")
      .order("published_on", { ascending: false })
      .limit(limit);
    if (filter.sector) q = q.eq("sector_slug", filter.sector);
    if (filter.region) q = q.eq("region", filter.region);
    if (filter.buyer) q = q.eq("buyer_key", filter.buyer);
    const { data } = await q;
    return withoutOptouts(data ?? [], await getOptouts());
  },
  ["latest-awards-v1"],
  { revalidate: 3600 },
);
