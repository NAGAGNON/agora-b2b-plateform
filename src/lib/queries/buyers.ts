import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { REGIONS, slugify } from "@/lib/geo";

export type BuyerSummary = { name: string; slug: string; region: string | null; open: number; total: number };

/** Tous les acheteurs publics référencés (nom, région, marchés ouverts), en cache 30 minutes. */
export const allBuyers = unstable_cache(
  async (): Promise<BuyerSummary[]> => {
    const { data, error } = await createAdminClient().rpc("public_buyers", { p_limit: 10000, p_offset: 0 });
    if (error) throw error;
    return (data ?? []).map((x) => ({ name: x.name, slug: x.slug, region: x.region, open: Number(x.open_count), total: Number(x.total_count) }));
  },
  ["public-buyers-all-v1"],
  { revalidate: 1800 },
);

/** Page « acheteurs d'une région » : chaque région, plus « national » pour les acheteurs sans région. */
export const NATIONAL_BUYERS = { slug: "national", name: "France entière" } as const;
export function buyerRegionSlug(region: string | null): string {
  return region ? (REGIONS.find((r) => r.name === region)?.slug ?? slugify(region)) : NATIONAL_BUYERS.slug;
}
