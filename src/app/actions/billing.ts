"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCompany } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { logServerError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { getStripe, priceIdFor, stripeConfigured, stripeMode, taxRateId, type PaidPlan } from "@/lib/billing/stripe";
import { ENTITLED_STATUSES } from "@/lib/billing/sync";
import type { ActionResult } from "@/lib/validation";

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
  acceptTerms: z.literal("on", { error: "Veuillez accepter les conditions d'abonnement pour continuer." }),
});

export async function startCheckout(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = checkoutSchema.safeParse({ plan: fd.get("plan"), acceptTerms: fd.get("acceptTerms") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Offre invalide." };
  const plan = parsed.data.plan as PaidPlan;
  const { session, error } = await adminCompany(`/dashboard/abonnement?offre=${plan}`);
  if (error) return { ok: false, error };
  if (!stripeConfigured()) return { ok: false, error: UNAVAILABLE };
  if (liveBlocked()) return { ok: false, error: "Paiement désactivé : le mode LIVE de Stripe n'est pas encore autorisé." };
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
      line_items: [{ price: priceIdFor(plan)!, quantity: 1 }],
      subscription_data: { metadata: { company_id: companyId, plan }, ...(tax ? { default_tax_rates: [tax] } : {}) },
      metadata: { company_id: companyId, plan, terms_accepted_at: new Date().toISOString(), accepted_by: session.userId },
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      tax_id_collection: { enabled: true },
      allow_promotion_codes: true,
      locale: "fr",
      success_url: `${env.siteUrl}/dashboard/abonnement?paiement=succes&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.siteUrl}/dashboard/abonnement?paiement=annule`,
    });
    url = checkout.url;
    await db.from("audit_logs").insert({ actor_user_id: session.userId, action: "billing.checkout_started", entity_type: "company", entity_id: companyId, metadata: { plan, terms_accepted: true } });
  } catch (e) {
    logServerError("stripe checkout", e);
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
