import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatEuros } from "@/lib/billing/plans";
import { FOUNDER_PRICE_HT, LAUNCH_TRIAL_DAYS, REFUND_DAYS, REGULAR_PRICE_HT, founderOffer, founderOpen, founderSeatsTaken, seatsLeft, type FounderOffer } from "@/lib/billing/founder";
import { flushEmailsAfterResponse } from "@/lib/email/flush";
import { logServerError } from "@/lib/errors";

export type FounderStep = "ANNONCE" | "RAPPEL" | "FIN_ESSAI" | "DERNIER";

const DAY = 86_400_000;
const dateFr = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(new Date(iso));

type Ctx = { firstName: string | null; hasCompany: boolean; seatsLeft: number; offer: Pick<FounderOffer, "launchedAt" | "endsAt"> };

/**
 * E-mails de l'offre de lancement, envoyés aux membres inscrits avant le lancement :
 *  ANNONCE (jour 1) : Pro offert 30 jours, sans carte ; tarif fondateur à vie, places limitées.
 *  RAPPEL (7 jours avant la fin de l'essai) ; FIN_ESSAI (essai terminé) ; DERNIER (2 jours avant la fin de l'offre).
 */
export function founderEmail(step: FounderStep, c: Ctx) {
  const hello = c.firstName ? `Bonjour ${c.firstName},` : "Bonjour,";
  const price = `${formatEuros(FOUNDER_PRICE_HT)} HT par mois au lieu de ${formatEuros(REGULAR_PRICE_HT)}, à vie`;
  const seats = c.seatsLeft > 0 ? `Seulement ${c.seatsLeft} place${c.seatsLeft > 1 ? "s" : ""} à ce tarif.` : "";
  const end = c.offer.endsAt ? dateFr(c.offer.endsAt) : null;
  const guarantee = `Sans engagement, et satisfait ou remboursé pendant ${REFUND_DAYS} jours.`;
  if (step === "ANNONCE")
    return {
      subject: c.firstName ? `${c.firstName}, Pro vous est offert pendant ${LAUNCH_TRIAL_DAYS} jours` : `Pro vous est offert pendant ${LAUNCH_TRIAL_DAYS} jours`,
      title: `Merci d'avoir fait partie des premiers : Pro offert ${LAUNCH_TRIAL_DAYS} jours`,
      paragraphs: [
        hello,
        "Vous faites partie des toutes premières personnes à avoir rejoint LinkProB2B. Pour vous remercier, nous vous offrons l'offre Pro pendant 30 jours, sans carte bancaire et sans rien à faire.",
        c.hasCompany
          ? "C'est déjà activé sur votre compte : les besoins des entreprises en avant-première (48 h avant les autres), des alertes sur tous vos métiers et toutes vos zones, et votre entreprise proposée en priorité aux clients qui publient un besoin."
          : "Pour l'activer, créez votre profil d'entreprise en 30 secondes : vous recevez alors les besoins des entreprises en avant-première (48 h avant les autres), des alertes sur tous vos métiers et toutes vos zones, et votre entreprise est proposée en priorité aux clients.",
        `Et si Pro vous plaît, gardez-le au tarif fondateur : ${price}. ${seats}`.trim(),
        guarantee,
      ],
      cta: c.hasCompany ? "Découvrir mon offre" : "Activer mon essai Pro",
    };
  if (step === "RAPPEL")
    return {
      subject: "Votre essai Pro se termine dans 7 jours",
      title: "Plus que 7 jours d'essai Pro",
      paragraphs: [
        hello,
        "Votre essai Pro se termine dans 7 jours. Ensuite, votre compte repasse à l'offre Gratuite : une seule alerte, un nombre limité de recherches, et les besoins des entreprises 48 h après les membres Pro.",
        `Pour garder tout ce que vous avez aujourd'hui : ${price}. ${seats}`.trim(),
        guarantee,
      ],
      cta: "Garder Pro au tarif fondateur",
    };
  if (step === "FIN_ESSAI")
    return {
      subject: `Votre essai Pro est terminé : gardez-le à ${formatEuros(FOUNDER_PRICE_HT)} HT par mois`,
      title: "Votre essai Pro est terminé",
      paragraphs: [
        hello,
        "Votre essai Pro de 30 jours est terminé : votre compte est repassé à l'offre Gratuite.",
        `Vous pouvez encore réactiver Pro au tarif fondateur, ${price}${end ? `, jusqu'au ${end}` : ""}. ${seats}`.trim(),
        guarantee,
      ],
      cta: "Réactiver Pro au tarif fondateur",
    };
  return {
    subject: `Dernier rappel : le tarif fondateur se termine le ${end ?? "bientôt"}`,
    title: "Dernier rappel : le tarif fondateur se termine",
    paragraphs: [
      hello,
      `Le tarif fondateur (${price}) se termine le ${end ?? "bientôt"}. Après cette date, Pro sera à ${formatEuros(REGULAR_PRICE_HT)} HT par mois. ${seats}`.trim(),
      guarantee,
      "C'est notre dernier message à ce sujet : merci encore de nous avoir fait confiance dès le début.",
    ],
    cta: "Profiter du tarif fondateur",
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
      payload: { type: "founder", title: m.title, paragraphs: m.paragraphs, link: withCompany.has(u.id) ? "/offre-fondateur" : "/onboarding/entreprise?suite=%2Foffre-fondateur", cta: m.cta },
    });
    if (error) logServerError("founder email", error);
    else queued++;
  }
  if (queued) flushEmailsAfterResponse();
  return { step, queued };
}
