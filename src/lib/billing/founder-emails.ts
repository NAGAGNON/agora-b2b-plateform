import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatEuros } from "@/lib/billing/plans";
import { FOUNDER_PRICE_HT, LAUNCH_TRIAL_DAYS, REFUND_DAYS, REGULAR_PRICE_HT, founderOffer, founderOpen, founderSeatsTaken, seatsLeft, type FounderOffer } from "@/lib/billing/founder";
import { flushEmailsAfterResponse } from "@/lib/email/flush";
import { logServerError } from "@/lib/errors";
import type { OfferEmail } from "@/lib/email/offer-template";

export type FounderStep = "ANNONCE" | "RAPPEL" | "FIN_ESSAI" | "DERNIER";

const DAY = 86_400_000;
const dateFr = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(new Date(iso));

type Ctx = { firstName: string | null; hasCompany: boolean; seatsLeft: number; offer: Pick<FounderOffer, "launchedAt" | "endsAt"> };

/**
 * E-mails de l'offre de lancement, envoyés aux membres inscrits avant le lancement. Courts : un titre,
 * deux lignes, le prix, trois avantages, un bouton.
 *  ANNONCE (jour 1) · RAPPEL (7 jours avant la fin de l'essai) · FIN_ESSAI · DERNIER (2 jours avant la fin).
 */
export function founderEmail(step: FounderStep, c: Ctx): OfferEmail {
  const end = c.offer.endsAt ? dateFr(c.offer.endsAt) : null;
  const seats = c.seatsLeft > 0 ? `${c.seatsLeft} place${c.seatsLeft > 1 ? "s" : ""} restante${c.seatsLeft > 1 ? "s" : ""}` : "à vie";
  const price = { now: `${formatEuros(FOUNDER_PRICE_HT)} HT/mois`, before: `${formatEuros(REGULAR_PRICE_HT)}`, detail: c.seatsLeft > 0 ? `à vie · ${seats}` : "à vie" };
  const benefits = ["Chaque appel d'offres résumé en 30 secondes", "Les besoins des entreprises 48 h avant les autres", "Votre entreprise proposée en premier aux clients", "Alertes et recherches illimitées, partout en France"];
  const foot = `Sans engagement · arrêt en un clic · remboursé sous ${REFUND_DAYS} jours si besoin`;
  const hi = c.firstName ? `${c.firstName}, ` : "";
  if (step === "ANNONCE")
    return {
      subject: `${hi}Pro vous est offert pendant ${LAUNCH_TRIAL_DAYS} jours`.replace(/^./, (x) => x.toUpperCase()),
      kicker: "Merci d'être parmi les premiers",
      title: `Pro vous est offert ${LAUNCH_TRIAL_DAYS} jours`,
      intro: c.hasCompany
        ? "C'est déjà activé sur votre compte. Sans carte, sans engagement, rien à faire."
        : "Créez votre profil d'entreprise en 30 secondes pour l'activer. Sans carte, sans engagement.",
      benefits,
      price,
      cta: c.hasCompany ? "Découvrir Pro" : "Activer mon essai",
      foot,
    };
  if (step === "RAPPEL")
    return {
      subject: "Plus que 7 jours d'essai Pro",
      kicker: "Votre essai Pro",
      title: "Plus que 7 jours de Pro",
      intro: "Ensuite, votre compte repasse en Gratuit : 1 alerte et des recherches limitées. Gardez tout au tarif fondateur.",
      benefits,
      price,
      cta: "Garder Pro",
      foot,
    };
  if (step === "FIN_ESSAI")
    return {
      subject: `Votre essai est terminé : gardez Pro à ${formatEuros(FOUNDER_PRICE_HT)}`,
      kicker: "Votre essai Pro",
      title: "Votre essai Pro est terminé",
      intro: `Réactivez Pro au tarif fondateur${end ? `, jusqu'au ${end}` : ""}.`,
      benefits,
      price,
      cta: "Réactiver Pro",
      foot,
    };
  return {
    subject: `Dernier rappel : le tarif fondateur se termine le ${end ?? "bientôt"}`,
    kicker: "Dernier rappel",
    title: `Tarif fondateur : fin le ${end ?? "bientôt"}`,
    intro: `Ensuite, Pro sera à ${formatEuros(REGULAR_PRICE_HT)} HT/mois. C'est notre dernier message à ce sujet.`,
    benefits,
    price,
    cta: "Profiter du tarif fondateur",
    foot,
  };
}

/** Étape due (une seule à la fois) selon le temps écoulé depuis le lancement. */
export function dueStep(offer: FounderOffer, now = Date.now()): FounderStep | null {
  if (!founderOpen(offer, now) || !offer.launchedAt) return null;
  const since = now - new Date(offer.launchedAt).getTime();
  const left = offer.endsAt ? new Date(offer.endsAt).getTime() - now : Infinity;
  if (left <= 2 * DAY) return "DERNIER";
  if (since >= LAUNCH_TRIAL_DAYS * DAY) return "FIN_ESSAI";
  if (since >= (LAUNCH_TRIAL_DAYS - 7) * DAY) return "RAPPEL";
  return "ANNONCE";
}

/**
 * Passage quotidien pendant l'offre : e-mail de l'étape du jour aux membres inscrits avant le
 * lancement (actifs, e-mails acceptés, pas encore abonnés), jamais deux fois la même étape.
 * Sans offre lancée : ne fait rien.
 */
export async function processFounderCampaign(db = createAdminClient(), now = Date.now()) {
  const offer = await founderOffer(db);
  const step = dueStep(offer, now);
  if (!step) return { skipped: "Offre de lancement non lancée ou terminée" };
  const left = seatsLeft(offer, await founderSeatsTaken(db));
  if (left <= 0 && step !== "ANNONCE") return { skipped: "Plus de places au tarif fondateur" };
  const { data: users } = await db.from("users").select("id, email, full_name, status, notify_email").eq("status", "ACTIVE").lt("created_at", offer.launchedAt!);
  const { data: sent } = await db.from("founder_offer_sends").select("user_id").eq("step", step);
  const done = new Set((sent ?? []).map((s) => s.user_id));
  const { data: members } = await db.from("company_members").select("user_id, company:companies(plan_code)");
  const withCompany = new Set((members ?? []).map((m) => m.user_id));
  const paying = new Set((members ?? []).filter((m) => ["PRO", "BUSINESS"].includes((Array.isArray(m.company) ? m.company[0] : m.company)?.plan_code ?? "")).map((m) => m.user_id));
  let queued = 0;
  for (const u of users ?? []) {
    if (!u.notify_email || done.has(u.id) || paying.has(u.id)) continue;
    const { error: claim } = await db.from("founder_offer_sends").insert({ user_id: u.id, step });
    if (claim) continue; // déjà envoyé (passage simultané)
    const m = founderEmail(step, { firstName: u.full_name?.trim().split(/\s+/)[0] || null, hasCompany: withCompany.has(u.id), seatsLeft: left, offer });
    const { error } = await db.from("email_outbox").insert({
      user_id: u.id,
      to_email: u.email,
      template: "founder",
      subject: m.subject,
      payload: { type: "founder", offer: m, link: withCompany.has(u.id) ? "/offre-fondateur" : "/onboarding/entreprise?suite=%2Foffre-fondateur" } as never,
    });
    if (error) logServerError("founder email", error);
    else queued++;
  }
  if (queued) flushEmailsAfterResponse();
  return { step, queued };
}
