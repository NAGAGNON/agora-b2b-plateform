import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatEuros } from "@/lib/billing/plans";
import { FOUNDER_PRICE_HT, LAUNCH_TRIAL_DAYS, REFUND_DAYS, REGULAR_PRICE_HT, founderOffer, founderOpen, founderSeatsTaken, seatsLeft, type FounderOffer } from "@/lib/billing/founder";
import { flushEmailsAfterResponse } from "@/lib/email/flush";
import { logServerError } from "@/lib/errors";
import type { OfferEmail } from "@/lib/email/offer-template";
import { loadBuyerProfiles } from "@/lib/buyer-profiles";

export type FounderStep = "ANNONCE" | "RAPPEL" | "FIN_ESSAI" | "DERNIER";

const DAY = 86_400_000;
const dateFr = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(new Date(iso));

/** Ce que le membre a réellement fait sur le site (e-mails personnalisés), absent pour un membre inactif. */
export type FounderProfile = {
  level: "CHAUD" | "TIEDE" | "FROID";
  views: number;
  sources: number;
  favorites: number;
  sector: string | null;
  openInSector: number;
  /** Membre pionnier : Pro déjà offert jusqu'à cette date */
  pioneerUntil?: string | null;
};

type Ctx = { firstName: string | null; hasCompany: boolean; seatsLeft: number; offer: Pick<FounderOffer, "launchedAt" | "endsAt">; profile?: FounderProfile | null };

const nf = (n: number) => n.toLocaleString("fr-FR");

/** Phrase sur l'activité réelle du membre (« vous avez consulté 141 marchés informatique… »). */
function usageLine(p: FounderProfile | null | undefined): string | null {
  if (!p || p.views + p.sources + p.favorites === 0) return null;
  const sector = p.sector ? ` ${p.sector.toLowerCase()}` : "";
  const did = [
    p.views ? `consulté ${nf(p.views)} marché${p.views > 1 ? "s" : ""}${sector}` : null,
    p.sources ? `ouvert ${nf(p.sources)} avis officiel${p.sources > 1 ? "s" : ""}` : null,
    p.favorites ? `mis ${nf(p.favorites)} offre${p.favorites > 1 ? "s" : ""} de côté` : null,
  ].filter(Boolean);
  const open = p.sector && p.openInSector ? ` En ce moment, ${nf(p.openInSector)} marchés${sector} sont ouverts.` : "";
  return `Depuis votre inscription, vous avez ${did.join(", ").replace(/, ([^,]*)$/, " et $1")}.${open}`;
}

/** Avantages dans l'ordre qui parle le plus au membre (ce qu'il fait déjà sur le site). */
function benefitsFor(p: FounderProfile | null | undefined, base: string[]): string[] {
  if (!p) return base;
  const list = [...base];
  if (p.favorites > 0) list.splice(1, 0, `Le pipeline pour suivre vos ${nf(p.favorites)} offres repérées jusqu'à la réponse`);
  if (p.sector) list.splice(p.favorites > 0 ? 2 : 1, 0, `Les nouveaux marchés ${p.sector.toLowerCase()} chaque matin, sans limite`);
  return list.slice(0, 4);
}

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
  const p = c.profile ?? null;
  const usage = usageLine(p);
  const mine = benefitsFor(p, benefits);
  const pioneer = p?.pioneerUntil && new Date(p.pioneerUntil).getTime() > Date.now() ? dateFr(p.pioneerUntil) : null;
  const top = p?.level === "CHAUD";
  const withUsage = (text: string) => (usage ? `${usage} ${text}` : text);
  if (step === "ANNONCE") {
    if (pioneer)
      return {
        subject: `${hi}votre tarif fondateur est réservé`.replace(/^./, (x) => x.toUpperCase()),
        kicker: "Membre pionnier",
        title: "Votre tarif fondateur est réservé",
        intro: withUsage(`Votre Pro offert continue jusqu'au ${pioneer}. Ensuite, gardez-le à vie au tarif fondateur, réservé aux tout premiers membres.`),
        benefits: mine,
        price,
        cta: "Garder Pro au tarif fondateur",
        foot,
      };
    return {
      subject: top && p?.sector && p.openInSector
        ? `${hi}${nf(p.openInSector)} marchés ${p.sector.toLowerCase()} vous attendent : Pro offert ${LAUNCH_TRIAL_DAYS} jours`.replace(/^./, (x) => x.toUpperCase())
        : `${hi}Pro vous est offert pendant ${LAUNCH_TRIAL_DAYS} jours`.replace(/^./, (x) => x.toUpperCase()),
      kicker: top ? "Vous êtes parmi nos membres les plus actifs" : "Merci d'être parmi les premiers",
      title: `Pro vous est offert ${LAUNCH_TRIAL_DAYS} jours`,
      intro: withUsage(
        c.hasCompany
          ? "Pro est déjà activé sur votre compte. Sans carte, sans engagement, rien à faire."
          : "Créez votre profil d'entreprise en 30 secondes pour l'activer. Sans carte, sans engagement.",
      ),
      benefits: mine,
      price,
      cta: c.hasCompany ? "Découvrir Pro" : "Activer mon essai",
      foot,
    };
  }
  if (step === "RAPPEL")
    return {
      subject: "Plus que 7 jours d'essai Pro",
      kicker: "Votre essai Pro",
      title: "Plus que 7 jours de Pro",
      intro: withUsage("Ensuite, votre compte repasse en Gratuit : 1 alerte et des recherches limitées. Gardez tout au tarif fondateur."),
      benefits: mine,
      price,
      cta: "Garder Pro",
      foot,
    };
  if (step === "FIN_ESSAI")
    return {
      subject: `Votre essai est terminé : gardez Pro à ${formatEuros(FOUNDER_PRICE_HT)}`,
      kicker: "Votre essai Pro",
      title: "Votre essai Pro est terminé",
      intro: withUsage(`Réactivez Pro au tarif fondateur${end ? `, jusqu'au ${end}` : ""}.`),
      benefits: mine,
      price,
      cta: "Réactiver Pro",
      foot,
    };
  return {
    subject: `Dernier rappel : le tarif fondateur se termine le ${end ?? "bientôt"}`,
    kicker: "Dernier rappel",
    title: `Tarif fondateur : fin le ${end ?? "bientôt"}`,
    intro: `Ensuite, Pro sera à ${formatEuros(REGULAR_PRICE_HT)} HT/mois. C'est notre dernier message à ce sujet.`,
    benefits: mine,
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
  // Activité réelle de chaque membre (e-mail personnalisé) et récompense « pionnier » éventuelle
  const pending = (users ?? []).filter((u) => u.notify_email && !done.has(u.id) && !paying.has(u.id)).map((u) => u.id);
  const profiles = new Map((await loadBuyerProfiles(db, pending).catch(() => [])).map((p) => [p.userId, p]));
  const { data: pioneers } = pending.length ? await db.from("pioneer_rewards").select("user_id, pro_until").in("user_id", pending) : { data: [] };
  const pioneerUntil = new Map((pioneers ?? []).map((x) => [x.user_id, x.pro_until]));
  let queued = 0;
  for (const u of users ?? []) {
    if (!u.notify_email || done.has(u.id) || paying.has(u.id)) continue;
    const { error: claim } = await db.from("founder_offer_sends").insert({ user_id: u.id, step });
    if (claim) continue; // déjà envoyé (passage simultané)
    const bp = profiles.get(u.id);
    const profile: FounderProfile | null = bp
      ? { level: bp.level, views: bp.signals.views, sources: bp.signals.sources, favorites: bp.signals.favorites, sector: bp.topSector, openInSector: bp.openInSector, pioneerUntil: pioneerUntil.get(u.id) ?? null }
      : null;
    const m = founderEmail(step, { firstName: u.full_name?.trim().split(/\s+/)[0] || null, hasCompany: withCompany.has(u.id), seatsLeft: left, offer, profile });
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
