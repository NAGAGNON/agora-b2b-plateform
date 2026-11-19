/**
 * Présentation des offres (pages Tarifs, Mon abonnement, encarts de mise à niveau).
 * Les limites réellement appliquées sont en base (table plans + déclencheurs) ; ce
 * fichier ne fait que les décrire. Prix hors taxes, TVA 20 % en sus.
 */

export type PlanCode = "FREE" | "PRO" | "BUSINESS";

export const VAT_RATE = 0.2;

export type PlanInfo = {
  code: PlanCode;
  name: string;
  priceHT: number; // euros par mois, hors taxes
  yearlyPriceHT: number; // euros par an, hors taxes (abonnement annuel : 2 mois offerts)
  tagline: string;
  highlights: string[];
  cta: string;
  popular?: boolean;
};

export const PLANS: PlanInfo[] = [
  {
    code: "FREE",
    name: "Gratuit",
    priceHT: 0,
    yearlyPriceHT: 0,
    tagline: "Pour voir les appels d'offres de votre métier et publier un besoin.",
    highlights: [
      "Votre entreprise dans l'annuaire",
      "Les 3 meilleures offres pour votre métier, expliquées",
      "La fiche synthèse : le résumé de chaque appel d'offres",
      "1 alerte e-mail sur les nouvelles offres",
      "Publier 1 besoin et recevoir des réponses",
      "5 recherches par jour · 20 demandes de contact par mois",
    ],
    cta: "Créer mon compte gratuitement",
  },
  {
    code: "PRO",
    name: "Pro",
    priceHT: 29,
    yearlyPriceHT: 290,
    tagline: "Pour trouver plus d'appels d'offres, et y répondre mieux.",
    highlights: [
      "Les nouvelles offres de votre métier chaque matin, du lundi au vendredi",
      "La fiche synthèse complète de chaque appel d'offres (PDF, Word)",
      "Les besoins des entreprises en avant-première : proposé en premier quand un client publie",
      "Recherches, alertes et offres recommandées illimitées",
      "Le suivi de chaque réponse jusqu'à « gagné » (pipeline)",
      "L'historique complet de chaque acheteur",
      "Une campagne de visibilité : présenté à 100 entreprises ciblées chaque mois",
    ],
    cta: "Passer à Pro",
    popular: true,
  },
  {
    code: "BUSINESS",
    name: "Business",
    priceHT: 59,
    yearlyPriceHT: 590,
    tagline: "On prospecte pour vous chaque mois, et toute votre équipe travaille ensemble.",
    highlights: [
      "Une campagne de prospection chaque mois : présenté à 400 entreprises que vous choisissez (métier, région, taille)",
      "Le suivi de la campagne : qui lit, qui clique, qui vous écrit",
      "Toute votre équipe sur le même compte, avec le même suivi",
      "Tout Pro inclus : veille du matin, fiche synthèse complète, besoins en avant-première, pipeline",
      "300 demandes de contact par mois",
    ],
    cta: "Passer à Business",
  },
];

export const PLAN_LABEL: Record<PlanCode, string> = { FREE: "Gratuit", PRO: "Pro", BUSINESS: "Business" };

export function planInfo(code: string | null | undefined): PlanInfo {
  return PLANS.find((p) => p.code === code) ?? PLANS[0];
}

export const formatEuros = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + " €";
export const priceTTC = (ht: number) => Math.round(ht * (1 + VAT_RATE) * 100) / 100;

export type BillingInterval = "month" | "year";

/** Économie de l'abonnement annuel par rapport à 12 mensualités (en euros HT). */
export const yearlySavingHT = (p: PlanInfo) => p.priceHT * 12 - p.yearlyPriceHT;
/** Prix annuel ramené au mois (en euros HT, arrondi au centime). */
export const yearlyMonthlyHT = (p: PlanInfo) => Math.round((p.yearlyPriceHT / 12) * 100) / 100;

/** Tableau comparatif (true = inclus, false = non inclus, texte = limite). */
export const COMPARISON: { label: string; values: [string | boolean, string | boolean, string | boolean] }[] = [
  { label: "Profil entreprise et annuaire", values: [true, true, true] },
  { label: "Recherches d'opportunités", values: ["5 / jour", "Illimitées", "Illimitées"] },
  { label: "Besoins actifs publiés", values: ["1", "Illimités", "Illimités"] },
  { label: "Demandes de contact (intérêts et réponses)", values: ["20 / mois", "100 / mois", "300 / mois"] },
  { label: "Favoris", values: ["3", "Illimités", "Illimités"] },
  { label: "Visibilité : entreprises ciblées à qui vous êtes présenté", values: ["Option payante", "100 / mois inclus", "400 / mois inclus"] },
  { label: "Alertes e-mail", values: ["1", "Illimitées", "Illimitées"] },
  { label: "Messagerie avec les entreprises", values: [true, true, true] },
  { label: "Recommandations avec score de pertinence", values: [false, true, true] },
  { label: "Pipeline commercial", values: [false, true, true] },
  { label: "Statistiques", values: [false, true, true] },
  { label: "Utilisateurs", values: ["1", "1", "Illimités"] },
  { label: "Badge Business", values: [false, false, true] },
  { label: "Statistiques avancées", values: [false, false, true] },
];

/** Libellés des limites (clé d'erreur PLAN_LIMIT:<clé>). */
export const LIMIT_LABEL: Record<string, string> = {
  active_needs: "besoins actifs",
  contact_requests_month: "demandes de contact ce mois-ci",
  favorites: "favoris",
  alerts: "alertes",
  pipeline: "pipeline commercial",
  members: "utilisateurs",
  recommendations: "recommandations",
};

/** Présentations « Visibilité » incluses chaque mois selon l'offre (au-delà : option payante). */
export const VISIBILITY_INCLUDED: Record<PlanCode, number> = { FREE: 0, PRO: 100, BUSINESS: 400 };
