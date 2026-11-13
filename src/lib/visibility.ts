/**
 * Offre « Visibilité » : présentation de l'entreprise (ou d'un besoin) à un nombre d'entreprises chaque
 * jour, et/ou affichage « À la une ». Gratuite pendant la phase de lancement ; les prix ci-dessous
 * (hors taxes) s'appliqueront au lancement payant, après validation du propriétaire.
 */
export const DAILY_OPTIONS = [0, 5, 10, 20, 40, 80] as const;
export const FEATURED_OPTIONS = [0, 7, 14, 30, 60] as const;
export const DURATION_OPTIONS = [7, 14, 30, 60] as const;
export type Daily = (typeof DAILY_OPTIONS)[number];
export type Featured = (typeof FEATURED_OPTIONS)[number];
export type Duration = (typeof DURATION_OPTIONS)[number];

/** Prix HT par jour selon le nombre d'entreprises présentées chaque jour. */
export const PRESENTATION_DAY_PRICE: Record<Daily, number> = { 0: 0, 5: 1.5, 10: 2.5, 20: 4, 40: 7, 80: 13 };
/** Palier « Intensif » (le plus de présentations). */
export const INTENSIVE_DAILY: Daily = 80;
/** Prix HT par jour d'affichage « À la une ». */
export const FEATURED_DAY_PRICE = 1;

export function boostPrice(daily: Daily, featured: Featured, duration: Duration): number {
  return Math.round((PRESENTATION_DAY_PRICE[daily] * duration + FEATURED_DAY_PRICE * featured) * 100) / 100;
}

/** Nombre maximal d'entreprises présentées sur toute la durée. */
export const totalPresentations = (daily: Daily, duration: Duration) => daily * duration;

export const BOOST_STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente de validation",
  ACTIVE: "En cours",
  ENDED: "Terminée",
  REJECTED: "Non retenue",
  CANCELLED: "Annulée",
};

/** Offre proposée à la création de l'entreprise (cochée par la personne, jamais d'office). */
export const STARTER_BOOST: { daily: Daily; featured: Featured; duration: Duration } = { daily: 10, featured: 7, duration: 14 };

/**
 * Prix après déduction des présentations incluses dans l'abonnement (Pro / Business) : les présentations
 * couvertes ne sont pas facturées ; la mise en avant « À la une » reste au prix normal.
 */
export function boostPriceWithIncluded(daily: Daily, featured: Featured, duration: Duration, includedLeft: number) {
  const total = totalPresentations(daily, duration);
  const covered = Math.max(0, Math.min(includedLeft, total));
  const perPresentation = daily ? PRESENTATION_DAY_PRICE[daily] / daily : 0;
  const price = Math.max(0, Math.round((boostPrice(daily, featured, duration) - covered * perPresentation) * 100) / 100);
  return { price, covered };
}

/** Argument commercial honnête : taille réelle de la base (arrondie vers le bas, jamais gonflée). */
export function reachLabel(reach: { total: number; reachable: number } | null): string | null {
  if (!reach || !reach.total) return null;
  const down = (n: number) => (n >= 100_000 ? Math.floor(n / 10_000) * 10_000 : n >= 10_000 ? Math.floor(n / 1_000) * 1_000 : n);
  const nf = (n: number) => n.toLocaleString("fr-FR");
  return `Plus de ${nf(down(reach.total))} entreprises françaises référencées, dont ${nf(down(reach.reachable))} joignables par e-mail`;
}
