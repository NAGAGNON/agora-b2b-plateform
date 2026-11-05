"use server";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { logServerError } from "@/lib/errors";
import { flushEmailsAfterResponse } from "@/lib/email/flush";
import { OUTREACH_COOKIE, outreachVisitor, track } from "@/lib/outreach/tracking";
import { needContactSchema, parseForm, type ActionResult } from "@/lib/validation";

const SENT = "Votre message a été transmis à l'entreprise. Elle vous répondra directement par e-mail.";

/**
 * Réponse à un besoin publié sur LinkProB2B, sans création de compte : le message et les
 * coordonnées (transmises avec l'accord explicite de l'expéditeur) sont envoyés par e-mail à
 * l'auteur du besoin, qui répond directement. Anti-robot (champ piège), limitation de débit,
 * un seul envoi par adresse et par besoin sur 24 h.
 */
export async function contactNeedOwner(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(needContactSchema, fd);
  if (!parsed.success) {
    // Champ piège rempli : réponse identique à un succès, rien n'est enregistré ni envoyé
    if (parsed.result.fieldErrors?.website) return { ok: true, message: SENT };
    return parsed.result;
  }
  const d = parsed.data;
  if (!(await rateLimit("need-contact", 5, 3600))) return { ok: false, error: "Trop de messages envoyés. Réessayez dans une heure." };

  const db = createAdminClient();
  const { data: o } = await db
    .from("opportunities")
    .select("id, title, status, origin, is_demo, response_deadline, created_by")
    .eq("id", d.opportunityId)
    .maybeSingle();
  const open = o && o.status === "PUBLISHED" && o.origin === "INTERNAL" && !o.is_demo && (!o.response_deadline || new Date(o.response_deadline).getTime() > Date.now());
  if (!o || !open) return { ok: false, error: "Ce besoin n'est plus ouvert aux réponses." };

  const { count: already } = await db
    .from("need_contacts")
    .select("id", { count: "exact", head: true })
    .eq("opportunity_id", o.id)
    .eq("email", d.email)
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if (already) return { ok: true, message: SENT };

  const { data: owner } = o.created_by ? await db.from("users").select("id, email").eq("id", o.created_by).maybeSingle() : { data: null };
  if (!owner?.email) {
    logServerError("need contact", new Error(`Besoin ${o.id} sans auteur joignable`));
    return { ok: false, error: "Le message n'a pas pu être transmis. Réessayez plus tard." };
  }

  const visitor = await outreachVisitor((await cookies()).get(OUTREACH_COOKIE)?.value);
  const { error } = await db.from("need_contacts").insert({
    opportunity_id: o.id,
    name: d.name,
    company: d.company,
    email: d.email,
    phone: d.phone ?? null,
    message: d.message,
    outreach_recipient_id: visitor?.id ?? null,
  });
  if (error) {
    logServerError("need contact", error);
    return { ok: false, error: "Le message n'a pas pu être transmis. Réessayez plus tard." };
  }

  const contact = [`${d.name} — ${d.company}`, `E-mail : ${d.email}`, d.phone ? `Téléphone : ${d.phone}` : null].filter(Boolean).join(" · ");
  await db.from("email_outbox").insert({
    user_id: owner.id,
    to_email: owner.email,
    template: "need_contact",
    subject: `Nouveau message pour votre besoin : ${o.title.slice(0, 80)}`,
    payload: {
      type: "need_contact",
      title: "Un professionnel répond à votre besoin",
      paragraphs: [
        `Votre besoin « ${o.title} » a reçu un message.`,
        `« ${d.message} »`,
        contact,
        `Répondez-lui directement par e-mail à ${d.email}${d.phone ? ` ou par téléphone au ${d.phone}` : ""}.`,
      ],
      link: `/dashboard/opportunites/${o.id}`,
    },
  });
  if (visitor) await track(visitor, "CONVERSION", { opportunityId: o.id, meta: { kind: "need_contact" } });
  flushEmailsAfterResponse();
  return { ok: true, message: SENT };
}
