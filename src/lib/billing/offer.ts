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

/** Candidatures par mois (décision du 26/11 : Gratuit 2, d'après l'usage réel — 12 entreprises sur 18 en commencent 1 par mois) */
export const FREE_CREDITS = 2;
export const PRO_CREDITS = 20;
/** Essai avec carte : 7 jours (recommandation acceptée le 26/11 : 3 jours trop courts pour préparer un appel d'offres) */
export const TRIAL_DAYS = 7;
export const FOUNDER_PRO_HT = 14.5;
export const FOUNDER_MONTHS = 3;
/** Offre fondateur : réservée aux anciens inscrits pendant 30 jours après le lancement (date affichée) */
export const FOUNDER_DEADLINE_DAYS = 30;
export const founderDeadline = (launchIso: string) => new Date(new Date(launchIso).getTime() + FOUNDER_DEADLINE_DAYS * 86_400_000).toISOString();

export const OFFER_PLANS: OfferPlan[] = [
  {
    code: "FREE",
    name: "Gratuit",
    priceHT: 0,
    credits: FREE_CREDITS,
    pitch: "Pour découvrir : trouver les appels d'offres de votre métier et essayer le parcours sur une ou deux candidatures.",
    includes: [
      `${FREE_CREDITS} candidatures par mois`,
      "Recherche et lecture des offres, lien vers l'annonce officielle",
      "Le résumé « En bref » de chaque appel d'offres",
      "1 alerte : les nouvelles offres de votre métier chaque matin",
      "Notes et journal de suivi sans limite sur vos candidatures",
      "3 questions par mois à l'assistant de candidature",
      "Votre entreprise dans l'annuaire, 3 prises de contact par mois",
      "Un aperçu flouté de ce que Pro débloque",
    ],
    trial: null,
  },
  {
    code: "PRO",
    name: "Pro",
    priceHT: 29,
    credits: PRO_CREDITS,
    pitch: "Pour répondre régulièrement et mieux préparer chaque candidature.",
    includes: [
      `${PRO_CREDITS} candidatures par mois`,
      "La fiche complète de chaque appel d'offres : conditions, pièces, critères, dates (PDF, Word)",
      "Les nouvelles offres de votre métier chaque matin, 3 alertes",
      "L'assistant de candidature sans limite, les modèles de mémoire et de courriers",
      "Les besoins des entreprises en avant-première",
      "Prévenu dès que l'acheteur publie le gagnant",
      "Offres recommandées avec un score de pertinence, historique de chaque acheteur",
      "Suivi commercial et statistiques, 30 prises de contact par mois",
      "1 collègue avec vous sur vos dossiers",
      "Présenté à 100 entreprises ciblées chaque mois",
    ],
    trial: `Essai ${TRIAL_DAYS} jours avec ${PRO_CREDITS} candidatures`,
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
      "Toute votre équipe sur les mêmes dossiers (notes, suivi partagé)",
      "Tout ce que contient Pro : fiche complète, veille du matin, assistant, résultat surveillé",
      "Présenté à 400 entreprises que vous choisissez, avec le suivi (qui lit, qui vous écrit)",
      "Alertes et prises de contact illimitées",
      "Statistiques avancées et badge Business",
    ],
    trial: `Essai ${TRIAL_DAYS} jours en illimité`,
  },
];

/** Limites de l'offre Gratuit appliquées au lancement (réglage « billing.free_limits », éteint avant). */
export const FREE_LIMITS = {
  credits: FREE_CREDITS,
  alerts: 1,
  alertFrequency: "daily" as const,
  assistantQuestionsMonth: 3,
  contactsMonth: 3,
  favorites: 3,
  fullBrief: false,
  templates: false,
  earlyNeeds: false,
  resultWatch: false,
  teamMembers: 1,
  /** null = sans limite (assoupli le 26/11 : ce sont les candidatures qui font passer à Pro) */
  notesPerApplication: null,
  journalDays: null,
  deadlineReminders: 1,
  memoirTemplate: false,
  letterTemplates: false,
  exports: false,
};

/** Pro : 1 collègue sur les dossiers (2 utilisateurs) ; Business : toute l'équipe. */
export const PRO_MEMBERS = 2;

/** Abonnement annuel : 2 mois offerts (on paie 10 mois sur 12), mêmes crédits chaque mois. */
export const YEAR_FREE_MONTHS = 2;
export const yearlyHT = (monthlyHT: number) => monthlyHT * (12 - YEAR_FREE_MONTHS);

export const offerPlan = (code: string | null | undefined) => OFFER_PLANS.find((p) => p.code === code) ?? OFFER_PLANS[0];
export const ttc = (ht: number) => Math.round(ht * 120) / 100;
export const euros = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;
export const frDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
