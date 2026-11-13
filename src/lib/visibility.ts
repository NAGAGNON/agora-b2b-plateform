/**
 * Offre « Visibilité » : présentation de l'entreprise (ou d'un besoin) à un nombre d'entreprises chaque
 * jour, et/ou affichage « À la une ». Gratuite pendant la phase de lancement ; les prix ci-dessous
 * (hors taxes) s'appliqueront au lancement payant, après validation du propriétaire.
 */
export const DAILY_OPTIONS = [0, 5, 10, 20, 40] as const;
export const FEATURED_OPTIONS = [0, 7, 14, 30] as const;
export const DURATION_OPTIONS = [7, 14, 30] as const;
export type Daily = (typeof DAILY_OPTIONS)[number];
export type Featured = (typeof FEATURED_OPTIONS)[number];
export type Duration = (typeof DURATION_OPTIONS)[number];

/** Prix HT par jour selon le nombre d'entreprises présentées chaque jour. */
export const PRESENTATION_DAY_PRICE: Record<Daily, number> = { 0: 0, 5: 1.5, 10: 2.5, 20: 4, 40: 7 };
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
