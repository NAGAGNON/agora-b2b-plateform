import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

/**
 * Accès Stripe côté serveur uniquement. Aucune clé n'est exposée au navigateur :
 * le paiement se fait sur Stripe Checkout (page hébergée par Stripe) et la gestion
 * de l'abonnement sur le portail client Stripe.
 *
 * Variables d'environnement :
 *  - STRIPE_SECRET_KEY         sk_test_… (mode test) puis sk_live_… (production)
 *  - STRIPE_WEBHOOK_SECRET     whsec_… (secret de signature du webhook)
 *  - STRIPE_PRO_PRICE_ID       price_… (LinkProB2B Pro, mensuel)
 *  - STRIPE_BUSINESS_PRICE_ID  price_… (LinkProB2B Business, mensuel)
 *  - STRIPE_TAX_RATE_ID        txr_… (TVA 20 %, exclusive) — facultatif
 *  - STRIPE_PRO_YEARLY_PRICE_ID       price_… (LinkProB2B Pro, annuel 590 € HT) — facultatif
 *  - STRIPE_BUSINESS_YEARLY_PRICE_ID  price_… (LinkProB2B Business, annuel 990 € HT) — facultatif
 *  Sans prix annuel configuré, seul l'abonnement mensuel est proposé.
 */

export type PaidPlan = "PRO" | "BUSINESS";

let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim() && priceIdFor("PRO") && priceIdFor("BUSINESS"));
}

/** Mode du compte Stripe connecté (test ou live), déduit de la clé. */
export function stripeMode(): "test" | "live" | null {
  const k = process.env.STRIPE_SECRET_KEY?.trim();
  if (!k) return null;
  return k.startsWith("sk_live_") || k.startsWith("rk_live_") ? "live" : "test";
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY absente");
  client ??= new Stripe(key, { appInfo: { name: "LinkProB2B" }, maxNetworkRetries: 2, timeout: 20_000 });
  return client;
}

export function priceIdFor(plan: PaidPlan, interval: "month" | "year" = "month"): string | null {
  const name = `STRIPE_${plan}${interval === "year" ? "_YEARLY" : ""}_PRICE_ID`;
  return process.env[name]?.trim() || null;
}

/** Offre correspondant à un prix Stripe (mensuel ou annuel). null si le prix est inconnu. */
export function planForPrice(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null;
  for (const plan of ["PRO", "BUSINESS"] as const) {
    if (priceId === priceIdFor(plan, "month") || priceId === priceIdFor(plan, "year")) return plan;
  }
  return null;
}

/** Abonnement annuel proposé pour cette offre (prix annuel Stripe configuré) ? */
export function yearlyAvailable(plan: PaidPlan): boolean {
  return Boolean(priceIdFor(plan, "year"));
}

export function taxRateId(): string | null {
  return process.env.STRIPE_TAX_RATE_ID?.trim() || null;
}

/**
 * Souscription payante ouverte au public ? Sur le site de production avec une clé de TEST, non :
 * le paiement n'est pas réel (une carte de test donnerait l'offre gratuitement). Seule l'équipe
 * peut alors essayer le parcours. Ailleurs (prévisualisation, développement) et en LIVE : ouvert.
 */
export function paidPlansOpen(isStaff: boolean): boolean {
  if (!stripeConfigured()) return false;
  return stripeMode() === "live" || !env.isProduction || isStaff;
}
