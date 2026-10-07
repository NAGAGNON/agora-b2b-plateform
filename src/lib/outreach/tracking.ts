import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/errors";
import { verifyRecipientToken } from "@/lib/outreach/token";

export type TrackType = "OPEN" | "CLICK" | "LANDING_VIEW" | "OPPORTUNITY_VIEW" | "SIGNUP" | "CONVERSION" | "UNSUBSCRIBE";

const FIRST_AT: Record<TrackType, "opened_at" | "clicked_at" | "landing_viewed_at" | "opportunity_viewed_at" | "signed_up_at" | "converted_at" | "unsubscribed_at"> = {
  OPEN: "opened_at",
  CLICK: "clicked_at",
  LANDING_VIEW: "landing_viewed_at",
  OPPORTUNITY_VIEW: "opportunity_viewed_at",
  SIGNUP: "signed_up_at",
  CONVERSION: "converted_at",
  UNSUBSCRIBE: "unsubscribed_at",
};

/** Destinataire correspondant à un jeton signé (null si le jeton est invalide ou inconnu). */
export async function recipientFromToken(token: string) {
  const id = verifyRecipientToken(token);
  if (!id) return null;
  const db = createAdminClient();
  const { data } = await db.from("outreach_recipients").select("id, campaign_id, prospect_id, email, status, unsubscribed_at").eq("id", id).maybeSingle();
  return data;
}

/**
 * Enregistre une étape du parcours (journal + première date sur le destinataire).
 * Silencieux en cas d'erreur : le suivi ne doit jamais bloquer le visiteur.
 */
export async function track(recipient: { id: string; campaign_id: string; prospect_id: string }, type: TrackType, extra: { opportunityId?: string; userId?: string; meta?: Record<string, unknown> } = {}) {
  try {
    const db = createAdminClient();
    const now = new Date().toISOString();
    await db.from("outreach_events").insert({ recipient_id: recipient.id, campaign_id: recipient.campaign_id, type, opportunity_id: extra.opportunityId ?? null, user_id: extra.userId ?? null, meta: (extra.meta ?? {}) as never });
    const col = FIRST_AT[type];
    await db.from("outreach_recipients").update({ [col]: now, updated_at: now } as { opened_at: string; updated_at: string }).eq("id", recipient.id).is(col, null);
    // Un clic ou une visite vaut aussi ouverture (images souvent bloquées par les messageries).
    if (type !== "OPEN" && type !== "UNSUBSCRIBE") await db.from("outreach_recipients").update({ opened_at: now }).eq("id", recipient.id).is("opened_at", null);
    if (type === "CLICK" || type === "OPPORTUNITY_VIEW" || type === "LANDING_VIEW") {
      await db.from("outreach_prospects").update({ last_clicked_at: now }).eq("id", recipient.prospect_id);
    }
  } catch (e) {
    logServerError("outreach track", e);
  }
}

/** Inscription LinkProB2B arrivée depuis une sélection Outreach (paramètre « ref=o.<jeton> »). */
export async function trackSignupReferral(ref: FormDataEntryValue | null, userId: string | null) {
  if (typeof ref !== "string" || !ref.startsWith("o.")) return;
  try {
    const r = await recipientFromToken(ref.slice(2));
    if (r) await track(r, "SIGNUP", { userId: userId ?? undefined });
  } catch (e) {
    logServerError("outreach signup", e);
  }
}

/** Désinscription : liste d'exclusion globale (adresse + SIREN) et prospect « Ne plus contacter ». */
export async function unsubscribe(recipient: { id: string; campaign_id: string; prospect_id: string; email: string | null }) {
  const db = createAdminClient();
  const { data: p } = await db.from("outreach_prospects").select("email, siren").eq("id", recipient.prospect_id).maybeSingle();
  const emails = [...new Set([recipient.email, p?.email].filter((e): e is string => Boolean(e)).map((e) => e.toLowerCase()))];
  const rows = [...emails.map((value) => ({ kind: "EMAIL", value, reason: "UNSUBSCRIBE" })), ...(p?.siren ? [{ kind: "SIREN", value: p.siren, reason: "UNSUBSCRIBE" }] : [])];
  if (rows.length) await db.from("outreach_suppressions").upsert(rows, { onConflict: "kind,value", ignoreDuplicates: true });
  await db.from("outreach_prospects").update({ status: "DO_NOT_CONTACT", excluded_reason: "Désinscription demandée par le destinataire", updated_at: new Date().toISOString() }).eq("id", recipient.prospect_id);
  // Les envois encore en attente pour cette entreprise sont annulés.
  await db.from("outreach_recipients").update({ status: "SUPPRESSED" }).eq("prospect_id", recipient.prospect_id).in("status", ["PENDING", "QUEUED"]);
  await track(recipient, "UNSUBSCRIBE");
}
