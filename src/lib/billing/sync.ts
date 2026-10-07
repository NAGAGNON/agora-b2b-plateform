import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/errors";
import { getStripe, planForPrice } from "@/lib/billing/stripe";

/**
 * Synchronisation Stripe → LinkProB2B. Source de vérité : Stripe. Seul ce module
 * (appelé par le webhook signé ou après lecture directe de l'API Stripe) modifie le
 * plan d'une entreprise ; aucune donnée transmise par le navigateur n'est utilisée.
 */

const PLAN_RANK: Record<string, number> = { FREE: 0, PRO: 1, BUSINESS: 2 };
/** Statuts Stripe qui donnent accès à l'offre payante (past_due : pendant les relances de paiement). */
export const ENTITLED_STATUSES = ["active", "trialing", "past_due"] as const;

const ts = (s: number | null | undefined) => (s ? new Date(s * 1000).toISOString() : null);
const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));

async function companyForCustomer(customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  const { data } = await createAdminClient().from("companies").select("id").eq("stripe_customer_id", customerId).maybeSingle();
  return data?.id ?? null;
}

/** Entreprise d'un abonnement : métadonnées posées à la création du Checkout, sinon client Stripe. */
async function companyForSubscription(sub: Stripe.Subscription): Promise<string | null> {
  return sub.metadata?.company_id || (await companyForCustomer(idOf(sub.customer)));
}

/** E-mail transactionnel aux administrateurs de l'entreprise (indépendant des préférences de notification). */
async function emailCompanyAdmins(companyId: string, type: string, title: string, body: string, link: string) {
  const db = createAdminClient();
  const { data } = await db.from("company_members").select("user:users(id, email, status)").eq("company_id", companyId).eq("role", "COMPANY_ADMIN");
  const rows = (data ?? [])
    .map((m) => (Array.isArray(m.user) ? m.user[0] : m.user) as { id: string; email: string; status: string } | null)
    .filter((u): u is { id: string; email: string; status: string } => Boolean(u && u.status === "ACTIVE" && u.email));
  if (rows.length === 0) return;
  await db.from("email_outbox").insert(
    rows.map((u) => ({ user_id: u.id, to_email: u.email, template: "notification", subject: title, payload: { title, body, link, type } })),
  );
}

/** Notification dans l'application (cloche) pour tous les membres + e-mail aux administrateurs. */
async function notify(companyId: string, type: string, title: string, body: string, link = "/dashboard/abonnement") {
  const db = createAdminClient();
  await db.rpc("notify_company", { p_company_id: companyId, p_type: type, p_title: title, p_body: body, p_link: link, p_send_email: false });
  await emailCompanyAdmins(companyId, type, title, body, link);
}

const LABEL: Record<string, string> = { FREE: "Gratuit", PRO: "Pro", BUSINESS: "Business" };

/**
 * Recalcule l'offre de l'entreprise à partir de ses abonnements : la meilleure offre
 * parmi les abonnements donnant droit (actif, essai, relance de paiement), sinon Gratuit.
 * Ne supprime jamais de données : un retour au Gratuit bloque seulement les nouveaux ajouts.
 */
export async function recomputeCompanyPlan(companyId: string, opts: { notify?: boolean } = {}) {
  const db = createAdminClient();
  const [{ data: company }, { data: subs }] = await Promise.all([
    db.from("companies").select("plan_code").eq("id", companyId).maybeSingle(),
    db.from("subscriptions").select("plan_code, status").eq("company_id", companyId).in("status", [...ENTITLED_STATUSES]),
  ]);
  if (!company) return null;
  const next = (subs ?? []).reduce((best, s) => ((PLAN_RANK[s.plan_code] ?? 0) > (PLAN_RANK[best] ?? 0) ? s.plan_code : best), "FREE");
  const prev = company.plan_code in PLAN_RANK ? company.plan_code : "FREE";
  if (next === prev) return next;
  const { error } = await db.from("companies").update({ plan_code: next }).eq("id", companyId);
  if (error) throw error;
  await db.from("audit_logs").insert({ action: "billing.plan_changed", entity_type: "company", entity_id: companyId, metadata: { from: prev, to: next } });
  if (opts.notify !== false) {
    if (prev === "FREE")
      await notify(companyId, "subscription_activated", `Bienvenue sur LinkProB2B ${LABEL[next]}`, `Votre abonnement ${LABEL[next]} est actif : toutes les fonctionnalités de l'offre sont disponibles dès maintenant.`);
    else if (next === "FREE")
      await notify(companyId, "subscription_ended", "Votre abonnement est terminé", "Votre entreprise est repassée à l'offre Gratuite. Toutes vos données sont conservées ; vous pouvez vous réabonner à tout moment.", "/tarifs");
    else
      await notify(companyId, "subscription_changed", `Formule modifiée : LinkProB2B ${LABEL[next]}`, `Votre entreprise est désormais sur l'offre ${LABEL[next]}.`);
  }
  return next;
}

/** Enregistre (ou met à jour) un abonnement Stripe, puis recalcule l'offre de l'entreprise. */
export async function syncSubscription(sub: Stripe.Subscription, hintCompanyId?: string | null) {
  const db = createAdminClient();
  const companyId = (await companyForSubscription(sub)) ?? hintCompanyId ?? null;
  if (!companyId) {
    logServerError("stripe sync", new Error(`Abonnement ${sub.id} sans entreprise associée`));
    return null;
  }
  const item = sub.items?.data?.[0];
  const priceId = item?.price?.id ?? null;
  const plan = planForPrice(priceId);
  if (!plan) {
    // Prix inconnu (variables STRIPE_*_PRICE_ID mal renseignées) : aucun droit n'est accordé.
    logServerError("stripe sync", new Error(`Prix ${priceId} non reconnu pour l'abonnement ${sub.id}`));
    return null;
  }
  const customerId = idOf(sub.customer)!;
  const { data: prev } = await db.from("subscriptions").select("status, cancel_at_period_end").eq("stripe_subscription_id", sub.id).maybeSingle();
  const row = {
    company_id: companyId,
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId,
    stripe_price_id: priceId,
    plan_code: plan,
    status: sub.status,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end || sub.cancel_at),
    unit_amount_cents: item?.price?.unit_amount ?? null,
    currency: item?.price?.currency ?? null,
    billing_interval: item?.price?.recurring?.interval ?? null,
    current_period_start: ts(item?.current_period_start),
    current_period_end: ts(sub.cancel_at ?? item?.current_period_end),
    started_at: ts(sub.start_date),
    canceled_at: ts(sub.canceled_at),
    ended_at: ts(sub.ended_at),
    latest_invoice_id: idOf(sub.latest_invoice as string | { id: string } | null),
  };
  const { error } = await db.from("subscriptions").upsert(row, { onConflict: "stripe_subscription_id" });
  if (error) throw error;
  // Mémorise le client Stripe de l'entreprise (portail client, prochains paiements)
  await db.from("companies").update({ stripe_customer_id: customerId }).eq("id", companyId).is("stripe_customer_id", null);

  const plan2 = await recomputeCompanyPlan(companyId);
  // Résiliation programmée (fin de période) : information, sans perte d'accès immédiate
  if (row.cancel_at_period_end && prev && !prev.cancel_at_period_end && ["active", "trialing", "past_due"].includes(sub.status)) {
    const end = row.current_period_end ? new Date(row.current_period_end).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : "la fin de la période en cours";
    await notify(companyId, "subscription_cancel_scheduled", "Résiliation enregistrée", `Votre abonnement ${LABEL[plan]} reste actif jusqu'au ${end}, puis votre entreprise repassera à l'offre Gratuite. Vos données sont conservées.`);
  }
  return { companyId, plan: plan2 };
}

/** Enregistre une facture Stripe (historique dans « Mon abonnement »). */
export async function recordInvoice(inv: Stripe.Invoice) {
  const db = createAdminClient();
  const subId = idOf(inv.parent?.subscription_details?.subscription as string | { id: string } | null | undefined);
  let companyId = inv.parent?.subscription_details?.metadata?.company_id || (await companyForCustomer(idOf(inv.customer)));
  if (!companyId && subId) {
    const { data } = await db.from("subscriptions").select("company_id").eq("stripe_subscription_id", subId).maybeSingle();
    companyId = data?.company_id ?? null;
  }
  if (!companyId || !inv.id) return null;
  const line = inv.lines?.data?.[0];
  const { error } = await db.from("invoices").upsert(
    {
      company_id: companyId,
      stripe_invoice_id: inv.id,
      stripe_subscription_id: subId,
      number: inv.number,
      status: inv.status ?? "open",
      amount_due_cents: inv.amount_due,
      amount_paid_cents: inv.amount_paid,
      currency: inv.currency,
      period_start: ts(line?.period?.start ?? inv.period_start),
      period_end: ts(line?.period?.end ?? inv.period_end),
      hosted_invoice_url: inv.hosted_invoice_url ?? null,
      invoice_pdf: inv.invoice_pdf ?? null,
    },
    { onConflict: "stripe_invoice_id" },
  );
  if (error) throw error;
  return { companyId, subscriptionId: subId };
}

const euros = (cents: number, currency = "eur") => new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

/** Relit l'abonnement depuis l'API Stripe (source de vérité) puis le synchronise. */
export async function refreshSubscription(id: string, hint?: string | null) {
  const sub = await getStripe().subscriptions.retrieve(id);
  return syncSubscription(sub, hint);
}

/**
 * Traite un événement Stripe vérifié. Idempotent : un même événement n'est appliqué
 * qu'une fois (table billing_events). Retourne false si déjà traité.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<boolean> {
  const db = createAdminClient();
  const { data: seen } = await db.from("billing_events").select("stripe_event_id").eq("stripe_event_id", event.id).maybeSingle();
  if (seen) return false;

  let companyId: string | null = null;
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      if (s.mode === "subscription" && s.subscription) {
        const r = await refreshSubscription(idOf(s.subscription)!, s.client_reference_id ?? s.metadata?.company_id ?? null);
        companyId = r?.companyId ?? null;
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed": {
      const r = await syncSubscription(event.data.object);
      companyId = r?.companyId ?? null;
      break;
    }
    case "invoice.paid": {
      const inv = event.data.object;
      const r = await recordInvoice(inv);
      companyId = r?.companyId ?? null;
      if (r?.subscriptionId) await refreshSubscription(r.subscriptionId, companyId);
      // Renouvellement (hors première facture, déjà couverte par « abonnement activé »)
      if (companyId && inv.billing_reason === "subscription_cycle" && inv.amount_paid > 0)
        await notify(companyId, "payment_succeeded", "Paiement reçu — abonnement renouvelé", `Votre paiement de ${euros(inv.amount_paid, inv.currency)} a bien été reçu. Merci !`);
      break;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object;
      const r = await recordInvoice(inv);
      companyId = r?.companyId ?? null;
      if (r?.subscriptionId) await refreshSubscription(r.subscriptionId, companyId);
      if (companyId)
        await notify(
          companyId,
          "payment_failed",
          "Votre paiement n'a pas pu être traité",
          "Stripe va réessayer automatiquement. Pour éviter l'interruption de votre abonnement, mettez à jour votre moyen de paiement depuis « Mon abonnement ».",
        );
      break;
    }
    default:
      break;
  }

  const { error } = await db.from("billing_events").insert({ stripe_event_id: event.id, type: event.type, company_id: companyId, summary: { livemode: event.livemode } });
  // Conflit = traitement concurrent du même événement : sans conséquence (opérations idempotentes)
  if (error && error.code !== "23505") throw error;
  return true;
}

/**
 * Retour du paiement : relit la session Checkout chez Stripe et applique l'abonnement
 * sans attendre le webhook. La session doit appartenir à l'entreprise de l'utilisateur.
 */
export async function confirmCheckoutSession(sessionId: string, companyId: string): Promise<"ok" | "pending" | "invalid"> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return "invalid";
  try {
    const cs = await getStripe().checkout.sessions.retrieve(sessionId);
    if (cs.client_reference_id !== companyId || cs.mode !== "subscription") return "invalid";
    const subId = idOf(cs.subscription as string | { id: string } | null);
    if (cs.status !== "complete" || !subId) return "pending";
    await refreshSubscription(subId, companyId);
    return "ok";
  } catch (e) {
    logServerError("stripe checkout confirm", e);
    return "pending";
  }
}
