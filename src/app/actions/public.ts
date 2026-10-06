"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { logServerError } from "@/lib/errors";
import { contactSchema, parseForm, type ActionResult } from "@/lib/validation";

export async function sendContactMessage(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(contactSchema, fd);
  if (!parsed.success) {
    // Champ piège rempli : on répond comme un succès sans rien enregistrer.
    if (parsed.result.fieldErrors?.website) return { ok: true, message: "Merci, votre message a bien été envoyé." };
    return parsed.result;
  }
  if (!(await rateLimit("contact", 5, 3600))) return { ok: false, error: "Trop de messages envoyés. Réessayez plus tard." };
  const { name, email, company, subject, message } = parsed.data;
  const { error } = await createAdminClient().from("contact_messages").insert({ name, email, company: company ?? null, subject, message });
  if (error) {
    logServerError("contact", error);
    return { ok: false, error: "Le message n'a pas pu être envoyé. Réessayez plus tard." };
  }
  return { ok: true, message: "Merci, votre message a bien été envoyé. Nous vous répondrons par e-mail." };
}

/** Désabonnement d'une alerte via le lien unique présent dans les e-mails. */
export async function unsubscribeAlert(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const token = z.uuid().safeParse(fd.get("token"));
  if (!token.success) return { ok: false, error: "Lien invalide." };
  if (!(await rateLimit("unsubscribe", 30, 3600))) return { ok: false, error: "Trop de requêtes." };
  const { data, error } = await createAdminClient().from("alerts").update({ is_active: false }).eq("unsubscribe_token", token.data).select("name");
  if (error || !data?.length) return { ok: false, error: "Ce lien de désabonnement n'est plus valide." };
  return { ok: true, message: `Vous ne recevrez plus l'alerte « ${data[0].name} ».` };
}
