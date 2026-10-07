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
    tagline: "Pour découvrir LinkProB2B et publier un premier besoin.",
    highlights: ["Profil entreprise", "Recherche d'opportunités et d'entreprises", "1 besoin actif", "5 demandes de contact par mois", "10 favoris", "1 alerte"],
    cta: "Créer mon compte gratuitement",
  },
  {
    code: "PRO",
    name: "Pro",
    priceHT: 29,
    tagline: "Pour développer votre activité avec des opportunités adaptées.",
    highlights: [
      "Besoins actifs illimités",
      "Recommandations « Recommandé pour votre entreprise »",
      "Alertes illimitées",
      "100 demandes de contact par mois",
      "Favoris illimités",
      "Pipeline commercial",
      "Statistiques",
    ],
    cta: "Passer à Pro",
    popular: true,
  },
  {
    code: "BUSINESS",
    name: "Business",
    priceHT: 59,
    tagline: "Pour les équipes commerciales et achats.",
    highlights: ["Tout Pro, plus :", "Utilisateurs multiples", "300 demandes de contact par mois", "Badge Business sur votre profil", "Statistiques avancées"],
    cta: "Passer à Business",
  },
];

export const PLAN_LABEL: Record<PlanCode, string> = { FREE: "Gratuit", PRO: "Pro", BUSINESS: "Business" };

export function planInfo(code: string | null | undefined): PlanInfo {
  return PLANS.find((p) => p.code === code) ?? PLANS[0];
}

export const formatEuros = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + " €";
export const priceTTC = (ht: number) => Math.round(ht * (1 + VAT_RATE) * 100) / 100;

/** Tableau comparatif (true = inclus, false = non inclus, texte = limite). */
export const COMPARISON: { label: string; values: [string | boolean, string | boolean, string | boolean] }[] = [
  { label: "Profil entreprise et annuaire", values: [true, true, true] },
  { label: "Recherche d'opportunités (dont marchés publics BOAMP / TED)", values: [true, true, true] },
  { label: "Besoins actifs publiés", values: ["1", "Illimités", "Illimités"] },
  { label: "Demandes de contact (intérêts et réponses)", values: ["5 / mois", "100 / mois", "300 / mois"] },
  { label: "Favoris", values: ["10", "Illimités", "Illimités"] },
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
