/**
 * Offre payante par crédits (décisions du fondateur du 25 et 26/11). Présentation uniquement :
 * les débits et limites réels sont en base (credit_wallets, spend_credits, platform_settings).
 * Tout reste caché tant que « billing.credits_enabled » vaut false.
 */

export type OfferCode = "FREE" | "PRO" | "BUSINESS";

export type OfferPlan = {
  code: OfferCode;
  name: string;
  priceHT: number;
  /** Candidatures (crédits) par mois ; null = illimité */
  credits: number | null;
  pitch: string;
  /** Ce que la formule donne, en clair (sans « tout Pro ») */
  includes: string[];
  trial: string | null;
  recommended?: boolean;
};

export const TRIAL_DAYS = 3;
export const FOUNDER_PRO_HT = 14.5;
export const FOUNDER_MONTHS = 3;

export const OFFER_PLANS: OfferPlan[] = [
  {
    code: "FREE",
    name: "Gratuit",
    priceHT: 0,
    credits: 5,
    pitch: "Pour découvrir : trouver les appels d'offres de votre métier et en préparer quelques-uns.",
    includes: [
      "5 candidatures par mois, avec le parcours en 7 étapes",
      "Recherche et lecture des offres illimitées",
      "La veille du matin par e-mail",
      "1 alerte sur les nouvelles offres",
      "Le résumé « En bref » de chaque appel d'offres",
      "Votre entreprise dans l'annuaire, la messagerie",
    ],
    trial: null,
  },
  {
    code: "PRO",
    name: "Pro",
    priceHT: 29,
    credits: 20,
    pitch: "Pour répondre régulièrement et mieux préparer chaque candidature.",
    includes: [
      "20 candidatures par mois",
      "La fiche complète de chaque appel d'offres : conditions, pièces, critères, dates (PDF, Word)",
      "Les besoins des entreprises en avant-première",
      "Prévenu dès que l'acheteur publie le gagnant",
      "Offres recommandées avec un score de pertinence",
      "Suivi commercial, statistiques, historique de chaque acheteur",
      "3 alertes, favoris illimités, 100 demandes de contact par mois",
      "Présenté à 100 entreprises ciblées chaque mois",
    ],
    trial: `Essai ${TRIAL_DAYS} jours avec 20 candidatures`,
    recommended: true,
  },
  {
    code: "BUSINESS",
    name: "Business",
    priceHT: 59,
    credits: null,
    pitch: "Pour une équipe qui répond beaucoup, avec une prospection chaque mois.",
    includes: [
      "Candidatures illimitées",
      "Toute votre équipe sur les mêmes dossiers",
      "La fiche complète, les besoins en avant-première, le résultat surveillé",
      "Présenté à 400 entreprises que vous choisissez, avec le suivi (qui lit, qui vous écrit)",
      "Alertes illimitées, 300 demandes de contact par mois",
      "Statistiques avancées et badge Business",
    ],
    trial: `Essai ${TRIAL_DAYS} jours en illimité`,
  },
];

export const offerPlan = (code: string | null | undefined) => OFFER_PLANS.find((p) => p.code === code) ?? OFFER_PLANS[0];
export const ttc = (ht: number) => Math.round(ht * 120) / 100;
export const euros = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;
export const frDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
