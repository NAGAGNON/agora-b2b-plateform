"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { logServerError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { getStripe, priceIdFor, stripeConfigured, paidPlansOpen, stripeMode, taxRateId, type PaidPlan } from "@/lib/billing/stripe";
import { ENTITLED_STATUSES } from "@/lib/billing/sync";
import type { ActionResult } from "@/lib/validation";
import { cardTrial } from "@/lib/billing/card-trial";
import { FOUNDER_COUPON_ID, FOUNDER_DISCOUNT, founderOffer, founderOpen, founderSeatsTaken, seatsLeft } from "@/lib/billing/founder";

/**
 * Paiement et gestion de l'abonnement. L'offre choisie est validée côté serveur et
 * convertie en prix Stripe à partir des variables d'environnement : le navigateur ne
 * transmet jamais de prix ni de montant. Seul un administrateur de l'entreprise peut
 * souscrire ou gérer l'abonnement.
 */

const UNAVAILABLE = "Le paiement en ligne n'est pas encore activé sur LinkProB2B. Réessayez prochainement ou contactez-nous.";

/** Garde-fou : refuse le mode LIVE tant qu'il n'a pas été explicitement autorisé (STRIPE_ALLOW_LIVE=1). */
function liveBlocked() {
  return stripeMode() === "live" && process.env.STRIPE_ALLOW_LIVE !== "1";
}

async function adminCompany(next: string) {
  const session = await requireCompany(next);
  const company = session.activeCompany;
  if (company.role !== "COMPANY_ADMIN") return { session, error: "Seul un administrateur de l'entreprise peut gérer l'abonnement." };
  return { session, error: null };
}

/** Client Stripe de l'entreprise : réutilisé s'il existe, sinon créé (une seule fois, clé d'idempotence). */
async function ensureCustomer(companyId: string, companyName: string, email: string): Promise<string> {
  const db = createAdminClient();
  const { data } = await db.from("companies").select("stripe_customer_id").eq("id", companyId).single();
  if (data?.stripe_customer_id) return data.stripe_customer_id;
  const customer = await getStripe().customers.create(
    { name: companyName, email, metadata: { company_id: companyId }, preferred_locales: ["fr"] },
    { idempotencyKey: `customer-${companyId}` },
  );
  await db.from("companies").update({ stripe_customer_id: customer.id }).eq("id", companyId).is("stripe_customer_id", null);
  const { data: again } = await db.from("companies").select("stripe_customer_id").eq("id", companyId).single();
  return again?.stripe_customer_id ?? customer.id;
}

const checkoutSchema = z.object({
  plan: z.enum(["PRO", "BUSINESS"]),
  interval: z.enum(["month", "year"]).default("month"),
  acceptTerms: z.literal("on", { error: "Veuillez accepter les conditions d'abonnement pour continuer." }),
});

export async function startCheckout(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = checkoutSchema.safeParse({ plan: fd.get("plan"), interval: fd.get("interval") ?? undefined, acceptTerms: fd.get("acceptTerms") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Offre invalide." };
  const plan = parsed.data.plan as PaidPlan;
  const interval = parsed.data.interval;
  const { session, error } = await adminCompany(`/dashboard/abonnement?offre=${plan}`);
  if (error) return { ok: false, error };
  if (!stripeConfigured()) return { ok: false, error: UNAVAILABLE };
  if (!paidPlansOpen(session.isStaff)) return { ok: false, error: "Les offres payantes ouvrent prochainement : le paiement en ligne est en cours de mise en service." };
  if (liveBlocked()) return { ok: false, error: "Paiement désactivé : le mode LIVE de Stripe n'est pas encore autorisé." };
  if (interval === "year" && !priceIdFor(plan, "year")) return { ok: false, error: "L'abonnement annuel n'est pas encore disponible pour cette offre. Choisissez l'abonnement mensuel." };
  if (!(await rateLimit("billing-checkout", 10, 3600))) return { ok: false, error: "Trop de tentatives. Réessayez dans quelques minutes." };

  const companyId = session.activeCompany.company.id;
  const db = createAdminClient();
  const { data: live } = await db.from("subscriptions").select("id").eq("company_id", companyId).in("status", [...ENTITLED_STATUSES]).limit(1);
  // Déjà abonné : le changement de formule se fait dans le portail Stripe (prorata calculé par Stripe)
  if (live && live.length > 0) return openBillingPortal();

  let url: string | null = null;
  try {
    const customer = await ensureCustomer(companyId, session.activeCompany.company.name, session.email);
    const tax = taxRateId();
    const checkout = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: companyId,
      line_items: [{ price: priceIdFor(plan, interval)!, quantity: 1 }],
      subscription_data: { metadata: { company_id: companyId, plan, interval }, ...(tax ? { default_tax_rates: [tax] } : {}) },
      metadata: { company_id: companyId, plan, interval, terms_accepted_at: new Date().toISOString(), accepted_by: session.userId },
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      tax_id_collection: { enabled: true },
      allow_promotion_codes: true,
      locale: "fr",
      success_url: `${env.siteUrl}/dashboard/abonnement?paiement=succes&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.siteUrl}/dashboard/abonnement?paiement=annule`,
    });
    url = checkout.url;
    await db.from("audit_logs").insert({ actor_user_id: session.userId, action: "billing.checkout_started", entity_type: "company", entity_id: companyId, metadata: { plan, interval, terms_accepted: true } });
  } catch (e) {
    logServerError("stripe checkout", e);
    return { ok: false, error: "Impossible d'ouvrir la page de paiement pour le moment. Réessayez dans quelques instants." };
  }
  if (!url) return { ok: false, error: "Impossible d'ouvrir la page de paiement pour le moment." };
  redirect(url);
}

const trialSchema = z.object({
  plan: z.enum(["PRO", "BUSINESS"]),
  interval: z.enum(["month", "year"]).default("month"),
  acceptTerms: z.literal("on", { error: "Veuillez accepter les conditions d'abonnement pour continuer." }),
});

/**
 * Essai avec carte (lancement payant) : 0 € aujourd'hui, la carte est enregistrée par Stripe et le premier
 * paiement a lieu à la fin de l'essai, sauf résiliation avant. Un seul essai par entreprise. Inactif tant
 * que le propriétaire ne l'a pas validé (seule l'équipe peut alors essayer le parcours, en mode test).
 */
export async function startCardTrial(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = trialSchema.safeParse({ plan: fd.get("plan"), interval: fd.get("interval") ?? undefined, acceptTerms: fd.get("acceptTerms") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Offre invalide." };
  const plan = parsed.data.plan as PaidPlan;
  const interval = parsed.data.interval;
  const { session, error } = await adminCompany(`/essai?offre=${plan}`);
  if (error) return { ok: false, error };
  const trial = await cardTrial();
  if (!trial.enabled && !session.isStaff) return { ok: false, error: "L'essai n'est pas encore ouvert." };
  if (!stripeConfigured()) return { ok: false, error: UNAVAILABLE };
  if (!paidPlansOpen(session.isStaff)) return { ok: false, error: "Les offres payantes ouvrent prochainement : le paiement en ligne est en cours de mise en service." };
  if (liveBlocked()) return { ok: false, error: "Paiement désactivé : le mode LIVE de Stripe n'est pas encore autorisé." };
  if (interval === "year" && !priceIdFor(plan, "year")) return { ok: false, error: "L'abonnement annuel n'est pas encore disponible pour cette offre. Choisissez l'abonnement mensuel." };
  if (!(await rateLimit("billing-checkout", 10, 3600))) return { ok: false, error: "Trop de tentatives. Réessayez dans quelques minutes." };

  const companyId = session.activeCompany.company.id;
  const db = createAdminClient();
  const { data: subs } = await db.from("subscriptions").select("id, status").eq("company_id", companyId).limit(20);
  if ((subs ?? []).some((s) => (ENTITLED_STATUSES as readonly string[]).includes(s.status))) return openBillingPortal();
  // Un seul essai par entreprise : après un premier abonnement, souscription directe sans essai
  const trialDays = (subs ?? []).length === 0 ? trial.days : 0;

  let url: string | null = null;
  try {
    const customer = await ensureCustomer(companyId, session.activeCompany.company.name, session.email);
    const tax = taxRateId();
    const checkout = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: companyId,
      line_items: [{ price: priceIdFor(plan, interval)!, quantity: 1 }],
      payment_method_collection: "always",
      subscription_data: {
        metadata: { company_id: companyId, plan, interval, card_trial: trialDays ? "1" : "0" },
        ...(trialDays ? { trial_period_days: trialDays, trial_settings: { end_behavior: { missing_payment_method: "cancel" as const } } } : {}),
        ...(tax ? { default_tax_rates: [tax] } : {}),
      },
      metadata: { company_id: companyId, plan, interval, terms_accepted_at: new Date().toISOString(), accepted_by: session.userId, card_trial: trialDays ? "1" : "0" },
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      tax_id_collection: { enabled: true },
      allow_promotion_codes: true,
      locale: "fr",
      success_url: `${env.siteUrl}/dashboard?essai=ok&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.siteUrl}/essai?offre=${plan}&paiement=annule`,
    });
    url = checkout.url;
    await db.from("audit_logs").insert({ actor_user_id: session.userId, action: "billing.card_trial_started", entity_type: "company", entity_id: companyId, metadata: { plan, interval, trial_days: trialDays } });
  } catch (e) {
    logServerError("stripe card trial", e);
    return { ok: false, error: "Impossible d'ouvrir la page de paiement pour le moment. Réessayez dans quelques instants." };
  }
  if (!url) return { ok: false, error: "Impossible d'ouvrir la page de paiement pour le moment." };
  redirect(url);
}

/** Réduction « membre fondateur » (−50 % à vie) : créée une seule fois dans Stripe, réutilisée ensuite. */
async function ensureFounderCoupon(): Promise<string> {
  const stripe = getStripe();
  try {
    return (await stripe.coupons.retrieve(FOUNDER_COUPON_ID)).id;
  } catch {
    const c = await stripe.coupons.create(
      { id: FOUNDER_COUPON_ID, name: "Membre fondateur LinkProB2B", percent_off: FOUNDER_DISCOUNT, duration: "forever" },
      { idempotencyKey: `coupon-${FOUNDER_COUPON_ID}` },
    );
    return c.id;
  }
}

const db0 = () => createAdminClient();

const founderSchema = z.object({
  interval: z.enum(["month", "year"]).default("month"),
  acceptTerms: z.literal("on", { error: "Veuillez accepter les conditions d'abonnement pour continuer." }),
});

/**
 * Souscription au tarif fondateur : offre Pro avec la réduction fondateur appliquée à vie.
 * Uniquement pendant l'offre de lancement (non terminée) et tant qu'il reste des places.
 */
export async function startFounderCheckout(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = founderSchema.safeParse({ interval: fd.get("interval") ?? undefined, acceptTerms: fd.get("acceptTerms") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Demande invalide." };
  const interval = parsed.data.interval;
  const { session, error } = await adminCompany("/offre-fondateur");
  if (error) return { ok: false, error };
  const offer = await founderOffer();
  if (!founderOpen(offer)) return { ok: false, error: "L'offre de lancement est terminée. Les offres actuelles sont sur la page Tarifs." };
  if (seatsLeft(offer, await founderSeatsTaken(db0())) <= 0) return { ok: false, error: "Toutes les places au tarif fondateur ont été prises. Les offres actuelles sont sur la page Tarifs." };
  if (!stripeConfigured()) return { ok: false, error: UNAVAILABLE };
  if (!paidPlansOpen(session.isStaff)) return { ok: false, error: "Le paiement en ligne est en cours de mise en service." };
  if (liveBlocked()) return { ok: false, error: "Paiement désactivé : le mode LIVE de Stripe n'est pas encore autorisé." };
  if (interval === "year" && !priceIdFor("PRO", "year")) return { ok: false, error: "L'abonnement annuel n'est pas encore disponible. Choisissez l'abonnement mensuel." };
  if (!(await rateLimit("billing-checkout", 10, 3600))) return { ok: false, error: "Trop de tentatives. Réessayez dans quelques minutes." };

  const companyId = session.activeCompany.company.id;
  const db = createAdminClient();
  const { data: live } = await db.from("subscriptions").select("id").eq("company_id", companyId).in("status", [...ENTITLED_STATUSES]).limit(1);
  if (live && live.length > 0) return { ok: false, error: "Votre entreprise a déjà un abonnement : gérez-le depuis « Mon abonnement »." };

  let url: string | null = null;
  try {
    const customer = await ensureCustomer(companyId, session.activeCompany.company.name, session.email);
    const coupon = await ensureFounderCoupon();
    const tax = taxRateId();
    const checkout = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: companyId,
      line_items: [{ price: priceIdFor("PRO", interval)!, quantity: 1 }],
      discounts: [{ coupon }],
      subscription_data: { metadata: { company_id: companyId, plan: "PRO", interval, founder: "1" }, ...(tax ? { default_tax_rates: [tax] } : {}) },
      metadata: { company_id: companyId, plan: "PRO", interval, founder: "1", terms_accepted_at: new Date().toISOString(), accepted_by: session.userId },
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      tax_id_collection: { enabled: true },
      locale: "fr",
      success_url: `${env.siteUrl}/dashboard/abonnement?paiement=succes&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.siteUrl}/offre-fondateur?paiement=annule`,
    });
    url = checkout.url;
    await db.from("audit_logs").insert({ actor_user_id: session.userId, action: "billing.founder_checkout_started", entity_type: "company", entity_id: companyId, metadata: { interval, terms_accepted: true } });
  } catch (e) {
    logServerError("stripe founder checkout", e);
    return { ok: false, error: "Impossible d'ouvrir la page de paiement pour le moment. Réessayez dans quelques instants." };
  }
  if (!url) return { ok: false, error: "Impossible d'ouvrir la page de paiement pour le moment." };
  redirect(url);
}

/** Portail client Stripe : moyen de paiement, factures, changement de formule, résiliation. */
export async function openBillingPortal(): Promise<ActionResult> {
  const { session, error } = await adminCompany("/dashboard/abonnement");
  if (error) return { ok: false, error };
  if (!process.env.STRIPE_SECRET_KEY) return { ok: false, error: UNAVAILABLE };
  if (liveBlocked()) return { ok: false, error: "Le mode LIVE de Stripe n'est pas encore autorisé." };
  const { data } = await createAdminClient().from("companies").select("stripe_customer_id").eq("id", session.activeCompany.company.id).single();
  if (!data?.stripe_customer_id) return { ok: false, error: "Aucun abonnement à gérer pour le moment." };
  let url: string;
  try {
    const portal = await getStripe().billingPortal.sessions.create({ customer: data.stripe_customer_id, return_url: `${env.siteUrl}/dashboard/abonnement`, locale: "fr" });
    url = portal.url;
  } catch (e) {
    logServerError("stripe portal", e);
    return { ok: false, error: "Le portail de gestion est momentanément indisponible. Réessayez dans quelques instants." };
  }
  redirect(url);
}

/** Essai Pro de 14 jours sans carte (une fois par entreprise, pendant l'offre de lancement). */
export async function startProTrial(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const next = typeof fd.get("suite") === "string" && String(fd.get("suite")).startsWith("/") ? String(fd.get("suite")) : "/dashboard";
  const session = await requireCompany(next);
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_pro_trial", { p_company_id: session.activeCompany.company.id });
  if (error) return { ok: false, error: /déjà/.test(error.message) ? "L'essai Pro a déjà été utilisé pour votre entreprise." : "L'essai Pro n'est pas disponible pour le moment." };
  revalidatePath("/", "layout");
  redirect(`${next}${next.includes("?") ? "&" : "?"}essai=active`);
}
