import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
import { handleStripeEvent } from "@/lib/billing/sync";
import { logServerError } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Webhook Stripe : https://<domaine>/api/stripe/webhook
 * Chaque requête est authentifiée par la signature Stripe (STRIPE_WEBHOOK_SECRET) ;
 * sans signature valide, rien n'est traité. Réponse 200 rapide, 500 en cas d'erreur
 * de traitement pour que Stripe réessaie (le traitement est idempotent).
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    logServerError("stripe webhook", new Error("STRIPE_WEBHOOK_SECRET ou STRIPE_SECRET_KEY absente"));
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 503 });
  }
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signature absente" }, { status: 400 });

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  try {
    const processed = await handleStripeEvent(event);
    return NextResponse.json({ received: true, processed });
  } catch (e) {
    logServerError(`stripe webhook ${event.type} ${event.id}`, e);
    return NextResponse.json({ error: "Traitement en échec" }, { status: 500 });
  }
}
