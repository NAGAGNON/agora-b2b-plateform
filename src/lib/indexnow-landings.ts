import { REGIONS } from "@/lib/geo";
import { buyerSlug } from "@/lib/buyer-slug";

/** Seuil d'une page d'atterrissage indexable (même règle que le plan du site : pas de page vide). */
const MIN = 3;

type Count = { dimension: string; key: string | null; n: number };
type Dept = { code: string; slug: string; region: string | null };
type Change = { department_code: string | null; sector_slug: string | null; region: string | null; external_buyer_name: string | null };

/**
 * Pages d'atterrissage à signaler aux moteurs (IndexNow : Bing, donc ChatGPT) : celles dont la liste a
 * changé (nouvelle offre dans le métier × département, le département, la région, le métier, chez
 * l'acheteur), ou toutes les pages indexables au premier envoi. Uniquement des pages avec assez d'offres.
 */
export function landingPaths(counts: Count[], departments: Dept[], changes: Change[] | "all"): string[] {
  const n = (dimension: string, key: string | null) => counts.find((c) => c.dimension === dimension && c.key === key)?.n ?? 0;
  const out = new Set<string>();
  const sectors = [...new Set(counts.filter((c) => c.dimension === "sector" && c.key).map((c) => c.key!))];
  const touched = (pred: (c: Change) => boolean) => changes === "all" || changes.some(pred);
  for (const r of REGIONS) {
    if (n("region", r.name) < MIN) continue;
    if (touched((c) => c.region === r.name)) out.add(`/opportunites/${r.slug}`);
    for (const d of departments.filter((x) => x.region === r.name)) {
      if (n("department", d.code) < MIN) continue;
      if (touched((c) => c.department_code === d.code)) out.add(`/opportunites/${r.slug}/${d.slug}`);
      for (const s of sectors)
        if (n("department_sector", `${d.code}|${s}`) >= MIN && touched((c) => c.department_code === d.code && c.sector_slug === s)) out.add(`/opportunites/${r.slug}/${d.slug}/${s}`);
    }
    for (const s of sectors) if (n("region_sector", `${r.name}|${s}`) >= MIN && touched((c) => c.region === r.name && c.sector_slug === s)) out.add(`/opportunites/${r.slug}/${s}`);
  }
  for (const s of sectors) if (n("sector", s) >= MIN && touched((c) => c.sector_slug === s)) out.add(`/opportunites/${s}`);
  if (changes !== "all") for (const c of changes) {
    const slug = buyerSlug(c.external_buyer_name);
    if (slug) out.add(`/acheteurs/${slug}`);
  }
  return [...out];
}
