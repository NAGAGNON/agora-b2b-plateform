import { getSectors } from "@/lib/queries/platform";
import { REGIONS } from "@/lib/geo";
import { getAwardCounts, RANKING_MIN_AWARDS } from "@/lib/queries/awards";

/** « tous » = tous les métiers (classement d'une région). */
export const ALL_TRADES = "tous";

/** Métier et région d'une page de classement (null si l'adresse ne correspond à rien). */
export async function rankingScope(sectorSlug: string, regionSlug: string | null) {
  const sectors = await getSectors();
  const sector = sectorSlug === ALL_TRADES ? null : (sectors.find((s) => s.slug === sectorSlug) ?? undefined);
  if (sector === undefined) return null;
  const region = regionSlug ? (REGIONS.find((r) => r.slug === regionSlug) ?? undefined) : null;
  if (region === undefined) return null;
  const counts = await getAwardCounts().catch(() => []);
  const n = counts.filter((c) => (!sector || c.sector === sector.slug) && (!region || c.region === region.name)).reduce((s, c) => s + c.n, 0);
  return { sector, region, n, indexable: n >= RANKING_MIN_AWARDS, sectors };
}

export const tradePhrase = (label: string) => `de ${label.toLowerCase()}`;

/** Le premier titre qui tient en entier dans Google (65 signes), sinon le plus court. */
export function fitTitle(...candidates: string[]): string {
  return candidates.map((c) => c.replace(/\s+/g, " ").trim()).find((c) => c.length <= 65) ?? candidates.reduce((a, b) => (a.length <= b.length ? a : b));
}
