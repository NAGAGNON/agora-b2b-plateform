import { SKILL_CATALOG, type CatalogSkill } from "@/lib/skill-catalog";
import { slugify } from "@/lib/format";

export type FreelanceTrade = CatalogSkill & { slug: string };

/** Métiers exercés par des indépendants (catalogue des compétences « à distance »), dans l'ordre du catalogue. */
export const FREELANCE_TRADES: FreelanceTrade[] = Object.values(SKILL_CATALOG)
  .flat()
  .filter((s) => s.remote)
  .map((s) => ({ ...s, slug: slugify(s.label) }));

export const freelanceTrade = (slug: string | undefined) => (slug ? (FREELANCE_TRADES.find((t) => t.slug === slug) ?? null) : null);

/** Tous les mots des métiers d'indépendants (vue générale). */
export const ALL_FREELANCE_TERMS = [...new Set(FREELANCE_TRADES.flatMap((t) => t.terms))];
