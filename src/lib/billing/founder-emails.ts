import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatEuros } from "@/lib/billing/plans";
import { FOUNDER_PRICE_HT, REGULAR_PRICE_HT, founderOffer, founderOpen, type FounderOffer } from "@/lib/billing/founder";
import { flushEmailsAfterResponse } from "@/lib/email/flush";
import { logServerError } from "@/lib/errors";

export type FounderStep = "ANNONCE" | "RAPPEL" | "DERNIER";

const DAY = 86_400_000;
const dateFr = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(new Date(iso));

/** Contenu des e-mails de l'offre fondateur (annonce, rappel à J+7, dernier rappel 2 jours avant la fin). */
export function founderEmail(step: FounderStep, firstName: string | null, offer: Pick<FounderOffer, "launchedAt" | "endsAt">) {
  const hello = firstName ? `Bonjour ${firstName},` : "Bonjour,";
  const price = `${formatEuros(FOUNDER_PRICE_HT)} HT par mois au lieu de ${formatEuros(REGULAR_PRICE_HT)}`;
  const until = offer.endsAt ? ` jusqu'au ${dateFr(offer.endsAt)}` : "";
  const keep = "Sans engagement. Et si vous ne souscrivez pas, rien ne change : vous gardez gratuitement l'accès aux offres, votre alerte et les besoins publiés.";
  if (step === "ANNONCE")
    return {
      subject: `${firstName ? `${firstName}, une` : "Une"} offre réservée aux premiers membres de LinkProB2B`,
      title: "Merci d'avoir fait partie des premiers",
      paragraphs: [
        hello,
        "Vous faites partie des toutes premières personnes à avoir rejoint LinkProB2B. Merci : vos visites et vos retours nous ont aidés à construire le site tel qu'il est aujourd'hui.",
        `Pour vous remercier, l'offre Pro est à moitié prix, à vie : ${price}, tant que votre abonnement reste actif.`,
        "Avec Pro : alertes illimitées sur vos métiers et vos zones, recommandations « pour votre entreprise », pipeline commercial pour suivre vos réponses, besoins illimités et statistiques.",
        keep,
        `Ce tarif est réservé aux membres inscrits avant son lancement, et proposé${until}.`,
      ],
    };
  if (step === "RAPPEL")
    return {
      subject: `Votre tarif fondateur vous attend : Pro à ${formatEuros(FOUNDER_PRICE_HT)} HT par mois`,
      title: "Votre tarif fondateur vous attend",
      paragraphs: [
        hello,
        `Petit rappel : en tant que membre fondateur, vous pouvez passer à l'offre Pro pour ${price}, et garder ce prix à vie.`,
        "Les membres Pro reçoivent toutes les offres de leurs métiers, dans toutes leurs zones, et suivent leurs réponses au même endroit.",
        keep,
        `Offre proposée${until}.`,
      ],
    };
  return {
    subject: `Dernier rappel : votre tarif fondateur se termine le ${offer.endsAt ? dateFr(offer.endsAt) : "bientôt"}`,
    title: "Dernier rappel : le tarif fondateur se termine",
    paragraphs: [
      hello,
      `Le tarif fondateur (${price}, à vie) se termine le ${offer.endsAt ? dateFr(offer.endsAt) : "bientôt"}. Après cette date, l'offre Pro sera à ${formatEuros(REGULAR_PRICE_HT)} HT par mois.`,
      keep,
      "C'est le dernier message à ce sujet : merci encore de nous avoir fait confiance dès le début.",
    ],
  };
}

/** Étape due aujourd'hui (une seule à la fois, dans l'ordre). */
export function dueStep(offer: FounderOffer, now = Date.now()): FounderStep | null {
  if (!founderOpen(offer, now) || !offer.launchedAt) return null;
  const since = now - new Date(offer.launchedAt).getTime();
  const left = offer.endsAt ? new Date(offer.endsAt).getTime() - now : Infinity;
  if (left <= 2 * DAY) return "DERNIER";
  if (since >= 7 * DAY) return "RAPPEL";
  return "ANNONCE";
}

/**
 * Passage quotidien pendant l'offre : e-mail de l'étape du jour aux fondateurs (comptes créés avant le
 * lancement, actifs, e-mails acceptés, entreprise encore à l'offre Gratuite), jamais deux fois la même étape.
 * Sans offre lancée : ne fait rien.
 */
export async function processFounderCampaign(db = createAdminClient(), now = Date.now()) {
  const offer = await founderOffer(db);
  const step = dueStep(offer, now);
  if (!step) return { skipped: "Offre fondateur non lancée ou terminée" };
  const { data: users } = await db.from("users").select("id, email, full_name, status, notify_email, created_at").eq("status", "ACTIVE").lt("created_at", offer.launchedAt!);
  const { data: sent } = await db.from("founder_offer_sends").select("user_id").eq("step", step);
  const done = new Set((sent ?? []).map((s) => s.user_id));
  const { data: members } = await db.from("company_members").select("user_id, company:companies(plan_code)");
  const paying = new Set((members ?? []).filter((m) => (Array.isArray(m.company) ? m.company[0] : m.company)?.plan_code !== "FREE").map((m) => m.user_id));
  let queued = 0;
  for (const u of users ?? []) {
    if (!u.notify_email || done.has(u.id) || paying.has(u.id)) continue;
    const { error: claim } = await db.from("founder_offer_sends").insert({ user_id: u.id, step });
    if (claim) continue; // déjà envoyé (passage simultané)
    const m = founderEmail(step, u.full_name?.trim().split(/\s+/)[0] || null, offer);
    const { error } = await db.from("email_outbox").insert({
      user_id: u.id,
      to_email: u.email,
      template: "founder",
      subject: m.subject,
      payload: { type: "founder", title: m.title, paragraphs: m.paragraphs, link: "/offre-fondateur" },
    });
    if (error) logServerError("founder email", error);
    else queued++;
  }
  if (queued) flushEmailsAfterResponse();
  return { step, queued };
}
