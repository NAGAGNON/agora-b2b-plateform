/**
 * Produits et plans Whop de LinkProB2B (entreprise Whop biz_OAf20Gyq2ZyMO4), créés le 18 novembre 2026.
 * Identifiants publics (pas des secrets) : la clé API et le secret du webhook restent dans les variables
 * d'environnement (WHOP_API_KEY, WHOP_WEBHOOK_SECRET). Prix hors taxes, en euros, taxes ajoutées par Whop.
 * Le paiement n'est pas encore branché : tant qu'il ne l'est pas, rien n'est vendu par Whop.
 */
export const WHOP_COMPANY_ID = "biz_OAf20Gyq2ZyMO4";

export const WHOP_PRODUCTS = {
  PRO: "prod_z9pWfo52l0GAj",
  BUSINESS: "prod_v2EyZpwmYtHDS",
  VISIBILITY: "prod_2xF1GqFw6AeOt",
} as const;

/** Abonnements (renouvellement automatique). */
export const WHOP_SUBSCRIPTION_PLANS = {
  PRO: { month: "plan_KxMJWhfl5mkx2", year: "plan_jxdI5Znh2HlsN" },
  BUSINESS: { month: "plan_ptvZ5obpodNCp", year: "plan_UTbOHYo1t1ohC" },
} as const;

/** Campagnes de visibilité (paiement unique), par formule (voir FORMULAS dans visibility.ts). */
export const WHOP_VISIBILITY_PLANS = {
  decouverte: "plan_5qUP32QA5i3Y3",
  essentielle: "plan_bVOn3d65LLhWb",
  intensive: "plan_ZqvVPxIM8yWDd",
} as const;
