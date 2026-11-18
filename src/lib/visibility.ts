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
  PENDING: "En attente",
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

/** Objectif de la campagne : oriente le texte proposé et le message affiché aux entreprises. */
export const OBJECTIVES = [
  { value: "CLIENTS", label: "Trouver des clients", hint: "Des entreprises qui ont besoin de vos services" },
  { value: "SOUS_TRAITANTS", label: "Trouver des sous-traitants", hint: "Des entreprises pour réaliser une partie de vos chantiers" },
  { value: "PARTENAIRES", label: "Trouver des partenaires", hint: "Pour répondre à plusieurs à des marchés" },
] as const;
export type Objective = (typeof OBJECTIVES)[number]["value"];

/** Trois formules prêtes (le détail reste réglable) : présentations par jour, durée, jours « À la une ». */
export const FORMULAS: { key: string; label: string; daily: Daily; duration: Duration; featured: Featured; recommended?: boolean }[] = [
  { key: "decouverte", label: "Découverte", daily: 5, duration: 14, featured: 0 },
  { key: "essentielle", label: "Essentielle", daily: 10, duration: 14, featured: 7, recommended: true },
  { key: "intensive", label: "Intensive", daily: 40, duration: 30, featured: 0 },
];

/** Limites de l'annonce (identiques aux contrôles de la base). */
export const AD_LIMITS = { title: 90, point: 80, text: 400 } as const;

/**
 * Contrôle automatique d'une annonce avant la relecture de l'équipe : les e-mails partent au nom de
 * LinkProB2B, donc pas de lien extérieur ni de coordonnées (le contact passe par la messagerie du site),
 * pas de texte en majuscules ni de promesse chiffrée invérifiable.
 */
export function adIssues(ad: { title: string; points: string[]; text: string }): string[] {
  const all = [ad.title, ...ad.points, ad.text].join(" ");
  const issues: string[] = [];
  if (/(https?:\/\/|www\.|\b[a-z0-9-]+\.(fr|com|net|org|io|eu)\b)/i.test(all)) issues.push("Retirez les liens vers d'autres sites : les entreprises vous contactent par LinkProB2B.");
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(all) || /(?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/.test(all)) issues.push("Retirez l'adresse e-mail et le téléphone : les entreprises vous écrivent par la messagerie du site.");
  const shouting = [ad.title, ...ad.points, ad.text].some((f) => {
    const letters = f.replace(/[^A-Za-zÀ-ÿ]/g, "");
    return letters.length > 12 && letters.replace(/[^A-ZÀ-Ý]/g, "").length / letters.length > 0.6;
  });
  if (shouting) issues.push("Évitez d'écrire en majuscules.");
  if (/\b(garanti|100 ?%|meilleur prix|n°1|numéro 1)\b/i.test(all)) issues.push("Évitez les promesses impossibles à vérifier (« garanti », « n°1 », « 100 % »…).");
  return issues;
}

/**
 * Estimation honnête d'une campagne à partir des vrais résultats des derniers envois du site
 * (taux d'ouverture et de clic mesurés) : fourchette, jamais une promesse.
 */
export function campaignEstimate(presentations: number, rates: { open: number; click: number } | null) {
  if (!rates || presentations <= 0) return null;
  const range = (r: number) => {
    const mid = presentations * r;
    return { low: Math.max(0, Math.floor(mid * 0.8)), high: Math.max(1, Math.ceil(mid * 1.1)) };
  };
  return { opens: range(rates.open), visits: range(rates.click) };
}
