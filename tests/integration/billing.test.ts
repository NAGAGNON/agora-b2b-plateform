/**
 * Abonnements : webhooks Stripe signés (vraie vérification de signature), idempotence,
 * cycle Gratuit → Pro → Business → relance → résiliation → Gratuit, limites appliquées
 * en base, données conservées au retour à l'offre Gratuite. Les appels sortants vers
 * l'API Stripe (relecture d'un abonnement) sont simulés : aucun accès réseau.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { admin, cleanup, company, days, RUN, user } from "./helpers";

process.env.STRIPE_SECRET_KEY = "sk_test_integration";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_integration_secret";
process.env.STRIPE_PRO_PRICE_ID = "price_it_pro";
process.env.STRIPE_BUSINESS_PRICE_ID = "price_it_business";

const { POST } = await import("@/app/api/stripe/webhook/route");
const { getStripe, stripeMode } = await import("@/lib/billing/stripe");
const { confirmCheckoutSession } = await import("@/lib/billing/sync");

const stripe = new Stripe("sk_test_integration");
const now = Math.floor(Date.now() / 1000);
let seq = 0;

function subscription(over: { id: string; companyId: string; price: string; status?: string; cancel?: boolean; amount?: number }) {
  return {
    id: over.id,
    object: "subscription",
    customer: `cus_${RUN}`,
    status: over.status ?? "active",
    cancel_at_period_end: over.cancel ?? false,
    cancel_at: null,
    canceled_at: null,
    ended_at: over.status === "canceled" ? now : null,
    start_date: now,
    latest_invoice: null,
    metadata: { company_id: over.companyId },
    items: {
      object: "list",
      data: [
        {
          id: `si_${over.id}`,
          current_period_start: now,
          current_period_end: now + 30 * 86400,
          price: { id: over.price, unit_amount: over.amount ?? 2900, currency: "eur", recurring: { interval: "month" } },
        },
      ],
    },
  };
}

async function send(type: string, object: unknown, id = `evt_${RUN}_${++seq}`) {
  const payload = JSON.stringify({ id, object: "event", type, livemode: false, created: now, data: { object } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
  const res = await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": header } }));
  return { status: res.status, body: await res.json() };
}

const planOf = async (id: string) => (await admin.from("companies").select("plan_code").eq("id", id).single()).data?.plan_code;

let owner: Awaited<ReturnType<typeof user>>;
let other: Awaited<ReturnType<typeof user>>;
let coId: string;
let otherCo: string;
const subId = `sub_${RUN}`;
const opps: string[] = [];

beforeAll(async () => {
  owner = await user("abonne");
  other = await user("acheteur-factu");
  coId = await company(owner.client, "Abonnée");
  otherCo = await company(other.client, "Acheteur facturation");
  // Opportunités ouvertes d'une autre entreprise (pour les demandes de contact)
  const rows = Array.from({ length: 7 }, (_, i) => ({
    company_id: otherCo, type: "QUOTE_REQUEST" as const, status: "PUBLISHED" as const, title: `IT ${RUN} besoin ${i}`,
    description: "Description de test suffisamment longue.", sector_slug: "maintenance-industrielle", city: "Brest", response_deadline: days(20), published_at: new Date().toISOString(),
  }));
  const { data, error } = await admin.from("opportunities").insert(rows).select("id");
  if (error) throw error;
  opps.push(...data.map((d) => d.id));
});

afterAll(async () => {
  await admin.from("billing_events").delete().like("stripe_event_id", `evt_${RUN}%`);
  await cleanup();
});

describe("webhook Stripe : sécurité", () => {
  it("refuse une requête sans signature", async () => {
    const res = await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "{}" }));
    expect(res.status).toBe(400);
  });

  it("refuse une signature invalide ou un contenu modifié", async () => {
    const payload = JSON.stringify({ id: "evt_x", type: "customer.subscription.created", data: { object: subscription({ id: subId, companyId: coId, price: "price_it_pro" }) } });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_autre" });
    const res = await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": header } }));
    expect(res.status).toBe(400);
    const good = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
    const res2 = await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload.replace("price_it_pro", "price_it_business"), headers: { "stripe-signature": good } }));
    expect(res2.status).toBe(400);
    expect(await planOf(coId)).toBe("FREE");
  });

  it("interdit à un utilisateur de modifier lui-même son offre", async () => {
    const { error } = await owner.client.from("companies").update({ plan_code: "BUSINESS" } as never).eq("id", coId);
    expect(error).not.toBeNull();
    expect(await planOf(coId)).toBe("FREE");
  });

  it("détecte le mode test à partir de la clé", () => {
    expect(stripeMode()).toBe("test");
  });
});

describe("offre Gratuite : limites appliquées côté serveur", () => {
  it("1 besoin actif", async () => {
    const mk = (n: number) =>
      owner.client.from("opportunities").insert({ company_id: coId, type: "NEED", status: "DRAFT", title: `IT ${RUN} mon besoin ${n}`, description: "Description de test suffisamment longue.", sector_slug: "maintenance-industrielle", city: "Brest" }).select("id").single();
    const a = await mk(1);
    const b = await mk(2);
    expect((await owner.client.from("opportunities").update({ status: "PENDING_REVIEW" }).eq("id", a.data!.id)).error).toBeNull();
    const { error } = await owner.client.from("opportunities").update({ status: "PENDING_REVIEW" }).eq("id", b.data!.id);
    expect(error?.hint).toBe("PLAN_LIMIT:active_needs");
  });

  it("10 favoris et 1 alerte", async () => {
    for (const id of opps.slice(0, 7)) expect((await owner.client.from("favorites").insert({ user_id: owner.id, opportunity_id: id })).error).toBeNull();
    const { data: cos } = await admin.from("companies").select("id").neq("id", coId).limit(4);
    for (const c of (cos ?? []).slice(0, 3)) await owner.client.from("favorites").insert({ user_id: owner.id, company_id: c.id });
    const { count } = await admin.from("favorites").select("id", { count: "exact", head: true }).eq("user_id", owner.id);
    if ((count ?? 0) >= 10) {
      const extra = (cos ?? [])[3];
      const { error } = await owner.client.from("favorites").insert({ user_id: owner.id, company_id: extra?.id ?? otherCo });
      expect(error?.hint).toBe("PLAN_LIMIT:favorites");
    }
    const alert = (n: number) => owner.client.from("alerts").insert({ user_id: owner.id, name: `IT ${RUN} alerte ${n}`, frequency: "DAILY" });
    expect((await alert(1)).error).toBeNull();
    expect((await alert(2)).error?.hint).toBe("PLAN_LIMIT:alerts");
  });

  it("pipeline réservé à Pro, sans bloquer une manifestation d'intérêt", async () => {
    const { error } = await owner.client.from("pipeline_items").insert({ company_id: coId, opportunity_id: opps[0], stage: "QUALIFIED" });
    expect(error?.hint).toBe("PLAN_LIMIT:pipeline");
  });

  it("5 demandes de contact par mois ; renvoyer une demande existante reste possible", async () => {
    for (const id of opps.slice(0, 5)) expect((await owner.client.rpc("express_interest", { p_opportunity_id: id, p_company_id: coId })).error).toBeNull();
    expect((await owner.client.rpc("express_interest", { p_opportunity_id: opps[0], p_company_id: coId, p_message: "Précision" })).error).toBeNull();
    const { error } = await owner.client.rpc("express_interest", { p_opportunity_id: opps[5], p_company_id: coId });
    expect(error?.hint).toBe("PLAN_LIMIT:contact_requests_month");
  });

  it("expose l'utilisation de l'offre aux seuls membres", async () => {
    const { data } = await owner.client.rpc("company_usage", { p_company_id: coId });
    expect(data).toMatchObject({ plan: "FREE", active_needs: 1, contact_requests_month: 5, alerts: 1 });
    const { error } = await other.client.rpc("company_usage", { p_company_id: coId });
    expect(error?.code).toBe("42501");
  });
});

describe("cycle d'abonnement piloté par les webhooks", () => {
  it("prix inconnu : aucun droit accordé", async () => {
    const r = await send("customer.subscription.created", subscription({ id: `sub_${RUN}_x`, companyId: coId, price: "price_inconnu" }));
    expect(r.status).toBe(200);
    expect(await planOf(coId)).toBe("FREE");
  });

  it("Gratuit → Pro à l'activation, notification et e-mail aux administrateurs", async () => {
    const r = await send("customer.subscription.created", subscription({ id: subId, companyId: coId, price: "price_it_pro" }), `evt_${RUN}_created`);
    expect(r).toEqual({ status: 200, body: { received: true, processed: true } });
    expect(await planOf(coId)).toBe("PRO");
    const { data: n } = await admin.from("notifications").select("type").eq("user_id", owner.id).eq("type", "subscription_activated");
    expect(n?.length).toBe(1);
    const { data: mail } = await admin.from("email_outbox").select("subject").eq("to_email", owner.email).like("subject", "Bienvenue sur LinkProB2B Pro%");
    expect(mail?.length).toBe(1);
    const { data: c } = await admin.from("companies").select("stripe_customer_id").eq("id", coId).single();
    expect(c?.stripe_customer_id).toBe(`cus_${RUN}`);
  });

  it("idempotence : un événement rejoué n'est appliqué qu'une fois", async () => {
    const r = await send("customer.subscription.created", subscription({ id: subId, companyId: coId, price: "price_it_pro" }), `evt_${RUN}_created`);
    expect(r.body).toEqual({ received: true, processed: false });
    const { data: n } = await admin.from("notifications").select("type").eq("user_id", owner.id).eq("type", "subscription_activated");
    expect(n?.length).toBe(1);
  });

  it("Pro : limites levées", async () => {
    expect((await owner.client.from("alerts").insert({ user_id: owner.id, name: `IT ${RUN} alerte pro`, frequency: "DAILY" })).error).toBeNull();
    expect((await owner.client.from("pipeline_items").insert({ company_id: coId, opportunity_id: opps[0], stage: "QUALIFIED" })).error).toBeNull();
    expect((await owner.client.rpc("express_interest", { p_opportunity_id: opps[5], p_company_id: coId })).error).toBeNull();
  });

  it("Pro → Business (changement de formule)", async () => {
    await send("customer.subscription.updated", subscription({ id: subId, companyId: coId, price: "price_it_business", amount: 5900 }));
    expect(await planOf(coId)).toBe("BUSINESS");
  });

  it("paiement échoué : accès conservé pendant les relances, facture et alerte enregistrées", async () => {
    vi.spyOn(getStripe().subscriptions, "retrieve").mockResolvedValue(subscription({ id: subId, companyId: coId, price: "price_it_business", status: "past_due", amount: 5900 }) as never);
    const invoice = {
      id: `in_${RUN}_1`, object: "invoice", customer: `cus_${RUN}`, number: "IT-0001", status: "open", amount_due: 7080, amount_paid: 0, currency: "eur",
      billing_reason: "subscription_cycle", period_start: now, period_end: now, hosted_invoice_url: "https://invoice.stripe.com/i/test", invoice_pdf: null,
      lines: { data: [] }, parent: { subscription_details: { subscription: subId, metadata: { company_id: coId } } },
    };
    const r = await send("invoice.payment_failed", invoice);
    expect(r.status).toBe(200);
    expect(await planOf(coId)).toBe("BUSINESS");
    const { data: sub } = await admin.from("subscriptions").select("status").eq("stripe_subscription_id", subId).single();
    expect(sub?.status).toBe("past_due");
    const { data: inv } = await owner.client.from("invoices").select("status, amount_due_cents").eq("stripe_invoice_id", `in_${RUN}_1`).single();
    expect(inv).toEqual({ status: "open", amount_due_cents: 7080 });
    const { data: n } = await admin.from("notifications").select("title").eq("user_id", owner.id).eq("type", "payment_failed");
    expect(n?.[0]?.title).toBe("Votre paiement n'a pas pu être traité");
  });

  it("paiement réussi : abonnement de nouveau actif", async () => {
    vi.spyOn(getStripe().subscriptions, "retrieve").mockResolvedValue(subscription({ id: subId, companyId: coId, price: "price_it_business", amount: 5900 }) as never);
    const r = await send("invoice.paid", {
      id: `in_${RUN}_1`, object: "invoice", customer: `cus_${RUN}`, number: "IT-0001", status: "paid", amount_due: 7080, amount_paid: 7080, currency: "eur",
      billing_reason: "subscription_cycle", period_start: now, period_end: now, hosted_invoice_url: null, invoice_pdf: "https://pay.stripe.com/invoice/test/pdf",
      lines: { data: [] }, parent: { subscription_details: { subscription: subId, metadata: { company_id: coId } } },
    });
    expect(r.status).toBe(200);
    const { data: sub } = await admin.from("subscriptions").select("status").eq("stripe_subscription_id", subId).single();
    expect(sub?.status).toBe("active");
    const { data: n } = await admin.from("notifications").select("type").eq("user_id", owner.id).eq("type", "payment_succeeded");
    expect(n?.length).toBe(1);
  });

  it("résiliation programmée puis fin d'abonnement : retour au Gratuit, données conservées", async () => {
    await send("customer.subscription.updated", subscription({ id: subId, companyId: coId, price: "price_it_business", cancel: true, amount: 5900 }));
    expect(await planOf(coId)).toBe("BUSINESS");
    const { data: n } = await admin.from("notifications").select("type").eq("user_id", owner.id).eq("type", "subscription_cancel_scheduled");
    expect(n?.length).toBe(1);

    const before = await admin.from("alerts").select("id", { count: "exact", head: true }).eq("user_id", owner.id);
    await send("customer.subscription.deleted", subscription({ id: subId, companyId: coId, price: "price_it_business", status: "canceled", amount: 5900 }));
    expect(await planOf(coId)).toBe("FREE");
    const after = await admin.from("alerts").select("id", { count: "exact", head: true }).eq("user_id", owner.id);
    expect(after.count).toBe(before.count);
    expect((await admin.from("pipeline_items").select("id").eq("company_id", coId)).data?.length).toBe(2); // ajout manuel + suivi automatique de l'intérêt
    // Nouveaux ajouts au-delà des limites bloqués
    expect((await owner.client.from("alerts").insert({ user_id: owner.id, name: `IT ${RUN} alerte 3`, frequency: "DAILY" })).error?.hint).toBe("PLAN_LIMIT:alerts");
    const { data: end } = await admin.from("notifications").select("type").eq("user_id", owner.id).eq("type", "subscription_ended");
    expect(end?.length).toBe(1);
  });

  it("checkout.session.completed : relit l'abonnement chez Stripe et l'applique", async () => {
    const spy = vi.spyOn(getStripe().subscriptions, "retrieve").mockResolvedValue(subscription({ id: `sub_${RUN}_2`, companyId: coId, price: "price_it_pro" }) as never);
    const r = await send("checkout.session.completed", { id: `cs_${RUN}`, object: "checkout.session", mode: "subscription", subscription: `sub_${RUN}_2`, client_reference_id: coId, metadata: { company_id: coId } });
    expect(r.status).toBe(200);
    expect(spy).toHaveBeenCalledWith(`sub_${RUN}_2`);
    expect(await planOf(coId)).toBe("PRO");
  });

  it("retour de paiement : une session d'une autre entreprise est refusée", async () => {
    vi.spyOn(getStripe().checkout.sessions, "retrieve").mockResolvedValue({ id: "cs_test_x", client_reference_id: otherCo, mode: "subscription", status: "complete", subscription: "sub_y" } as never);
    expect(await confirmCheckoutSession("cs_test_x", coId)).toBe("invalid");
    expect(await confirmCheckoutSession("pas-un-id", coId)).toBe("invalid");
  });

  it("indicateurs d'abonnement réservés aux administrateurs", async () => {
    const { error } = await owner.client.rpc("admin_billing_stats");
    expect(error).not.toBeNull();
    const boss = await user("admin-factu", "ADMIN");
    const { data, error: e2 } = await boss.client.rpc("admin_billing_stats");
    expect(e2).toBeNull();
    expect((data as Record<string, number>).mrr_cents).toBeGreaterThanOrEqual(2900);
  });
});
