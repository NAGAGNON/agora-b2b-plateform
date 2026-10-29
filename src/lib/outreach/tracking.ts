import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/errors";
import { verifyRecipientToken } from "@/lib/outreach/token";

export type TrackType =
  | "OPEN"
  | "CLICK"
  | "LANDING_VIEW"
  | "OPPORTUNITY_VIEW"
  | "GATE_VIEW"
  | "GATE_SIGNUP_CLICK"
  | "GATE_LOGIN_CLICK"
  | "SIGNUP"
  | "LOGIN"
  | "OFFER_ACCESS"
  | "CONVERSION"
  | "UNSUBSCRIBE";

/** Colonne « première fois » de chaque étape sur le destinataire (entonnoir par entreprise). */
const FIRST_AT = {
  OPEN: "opened_at",
  CLICK: "clicked_at",
  LANDING_VIEW: "landing_viewed_at",
  OPPORTUNITY_VIEW: "opportunity_viewed_at",
  GATE_VIEW: "gate_viewed_at",
  GATE_SIGNUP_CLICK: "signup_clicked_at",
  GATE_LOGIN_CLICK: "login_clicked_at",
  SIGNUP: "signed_up_at",
  LOGIN: "logged_in_at",
  OFFER_ACCESS: "offer_accessed_at",
  CONVERSION: "converted_at",
  UNSUBSCRIBE: "unsubscribed_at",
} as const satisfies Record<TrackType, string>;

/**
 * Cookie du parcours « e-mail de prospection » : posé au clic depuis l'e-mail (jeton signé
 * du destinataire). Tant que le visiteur n'est pas connecté, les offres lui sont présentées
 * derrière la page d'accès « Créez votre compte » (contrôle côté serveur).
 */
export const OUTREACH_COOKIE = "lp_prospection";
export const OUTREACH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** Destinataire du parcours en cours (cookie signé), ou null. */
export async function outreachVisitor(cookieValue: string | undefined) {
  if (!cookieValue) return null;
  const r = await recipientFromToken(cookieValue);
  return r ? { ...r, token: cookieValue } : null;
}

/** Destinataire correspondant à un jeton signé (null si le jeton est invalide ou inconnu). */
export async function recipientFromToken(token: string) {
  const id = verifyRecipientToken(token);
  if (!id) return null;
  const db = createAdminClient();
  const { data } = await db.from("outreach_recipients").select("id, campaign_id, prospect_id, email, status, unsubscribed_at, sent_at, created_at").eq("id", id).maybeSingle();
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
    if (type === "CLICK" || type === "OPPORTUNITY_VIEW" || type === "LANDING_VIEW" || type === "GATE_VIEW") {
      await db.from("outreach_prospects").update({ last_clicked_at: now }).eq("id", recipient.prospect_id);
    }
  } catch (e) {
    logServerError("outreach track", e);
  }
}

/** Destinataire désigné par le paramètre « ref=o.<jeton> » (inscription / connexion depuis le parcours). */
export async function recipientFromReferral(ref: FormDataEntryValue | null) {
  if (typeof ref !== "string" || !ref.startsWith("o.")) return null;
  return recipientFromToken(ref.slice(2));
}

/** Durée pendant laquelle le lien reçu par e-mail vaut preuve de l'adresse (inscription sans confirmation). */
export const REFERRAL_TRUST_DAYS = 30;

/** Le lien a été envoyé il y a moins de 30 jours (un lien transféré ou ancien repasse par la confirmation). */
export function referralStillTrusted(r: { sent_at: string | null; created_at: string } | null, now = Date.now()): boolean {
  if (!r) return false;
  const at = new Date(r.sent_at ?? r.created_at).getTime();
  return Number.isFinite(at) && now - at <= REFERRAL_TRUST_DAYS * 86_400_000;
}

/** Inscription LinkProB2B arrivée depuis une sélection Outreach (paramètre « ref=o.<jeton> »). */
export async function trackSignupReferral(ref: FormDataEntryValue | null, userId: string | null) {
  await trackReferral(ref, "SIGNUP", userId);
}

/** Étape du parcours rattachée au paramètre « ref » (inscription, connexion). Jamais bloquant. */
export async function trackReferral(ref: FormDataEntryValue | null, type: "SIGNUP" | "LOGIN", userId: string | null) {
  try {
    const r = await recipientFromReferral(ref);
    if (r) await track(r, type, { userId: userId ?? undefined });
  } catch (e) {
    logServerError(`outreach ${type.toLowerCase()}`, e);
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

/**
 * Visite automatique plutôt qu'humaine : les messageries d'entreprise (Outlook Safe Links,
 * Proofpoint, Mimecast, antivirus…) ouvrent chaque lien pour le vérifier, souvent dans les
 * secondes qui suivent l'envoi. Ces passages ne sont pas comptés comme des clics.
 */
const SCANNER_UA = /bot|crawler|spider|preview|scanner|safelinks|barracuda|proofpoint|mimecast|symantec|forcepoint|trendmicro|sophos|fortiguard|cisco|ironport|python|curl|wget|go-http|java\/|okhttp|axios|phantom|lighthouse/i;

export function isAutomatedHit(req: Request, sentAt: string | null | undefined, now = Date.now()): boolean {
  if (req.method === "HEAD") return true;
  return isAutomatedVisit(req.headers, sentAt, now);
}

/**
 * Même règle pour une page affichée (en-têtes de la requête) : robot déclaré, ou passage moins de
 * 2 minutes après l'envoi. Mesure réelle : 235 des 260 premiers clics arrivaient entre 20 s et
 * 2 min après l'envoi (vérification des liens par les messageries), presque jamais suivis d'une
 * visite de la page d'inscription ; les visites humaines arrivent bien plus tard.
 */
export function isAutomatedVisit(h: Headers, sentAt: string | null | undefined, now = Date.now()): boolean {
  const ua = h.get("user-agent") ?? "";
  if (!ua || SCANNER_UA.test(ua)) return true;
  if (sentAt && now - new Date(sentAt).getTime() < AUTOMATED_WINDOW_MS) return true;
  return false;
}

export const AUTOMATED_WINDOW_MS = 120_000;
