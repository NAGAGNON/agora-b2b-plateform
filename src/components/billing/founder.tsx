import { BadgeCheck, CalendarClock, Check, Lock, ShieldCheck } from "lucide-react";
import { formatEuros, priceTTC } from "@/lib/billing/plans";
import { FOUNDER_PRICE_HT, REFUND_DAYS, REGULAR_PRICE_HT } from "@/lib/billing/founder";
import { formatDate } from "@/lib/format";

/** Ce qui fait gagner des clients (avant les outils) : ordre voulu. */
const PRO_GAINS = [
  "Les besoins des entreprises en avant-première, 48 h avant les autres",
  "Votre entreprise proposée en premier aux clients qui publient un besoin",
  "Alertes illimitées : tous vos métiers, toutes vos zones, chaque matin",
  "Historique complet des acheteurs publics : anticipez leurs renouvellements",
  "Recherches illimitées sur toute la France",
  "Pipeline commercial, favoris illimités et statistiques",
];
const FREE_KEPT = ["Les offres et besoins publiés (15 recherches par semaine)", "1 alerte par e-mail (3 offres par envoi)", "Publier un besoin", "Répondre aux besoins des entreprises"];

/** Contenu de la page de l'offre fondateur (le bouton de paiement est fourni par la page). */
export function FounderOfferView({
  firstName,
  founder = true,
  endsAt,
  seatsLeft,
  action,
  note,
}: {
  firstName: string | null;
  /** Inscrit avant le lancement : message de remerciement */
  founder?: boolean;
  endsAt: string | null;
  seatsLeft: number | null;
  action: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <div className="bg-gradient-to-b from-amber-50/60 to-transparent">
      <div className="container-page py-10 sm:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
            <BadgeCheck className="size-4" aria-hidden /> {founder ? "Membre fondateur" : "Offre de lancement"}
          </span>
          <h1 className="mt-4 text-3xl leading-tight font-bold text-navy sm:text-4xl">
            {founder ? `${firstName ? `${firstName}, merci` : "Merci"} d'avoir fait partie des premiers.` : "Pro à moitié prix, à vie, pour les premiers abonnés."}
          </h1>
          <p className="mt-4 text-lg text-slate-700">
            {founder ? "Pour vous remercier, l'offre" : "Pendant le lancement, l'offre"} <strong>Pro</strong> est à <strong>moitié prix, à vie</strong> : {formatEuros(FOUNDER_PRICE_HT)} HT par mois au lieu de{" "}
            {formatEuros(REGULAR_PRICE_HT)}, tant que votre abonnement reste actif.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-[1.1fr_1fr]">
          <section aria-labelledby="founder-pro" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 id="founder-pro" className="text-lg font-bold text-navy">
              Ce que Pro vous apporte
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
              {PRO_GAINS.map((h) => (
                <li key={h} className="flex gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden /> {h}
                </li>
              ))}
            </ul>
            <h3 className="mt-6 text-sm font-bold text-navy">Et si vous ne souscrivez pas ?</h3>
            <p className="mt-1 text-sm text-slate-600">Vous gardez gratuitement l&apos;essentiel :</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
              {FREE_KEPT.map((h) => (
                <li key={h} className="flex gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden /> {h}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="founder-price" className="rounded-2xl border-2 border-amber-300 bg-white p-6 shadow-md">
            <h2 id="founder-price" className="text-sm font-semibold tracking-wide text-amber-800 uppercase">
              Tarif fondateur
            </h2>
            <p className="mt-3 flex items-baseline gap-3">
              <span className="text-4xl font-extrabold text-navy">{formatEuros(FOUNDER_PRICE_HT)}</span>
              <span className="text-slate-600">HT / mois</span>
            </p>
            <p className="mt-1 text-sm text-slate-500">
              <span className="line-through">{formatEuros(REGULAR_PRICE_HT)} HT</span> · soit {formatEuros(priceTTC(FOUNDER_PRICE_HT))} TTC par mois
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-700">
              <li className="flex gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden /> Prix garanti à vie, tant que l&apos;abonnement reste actif
              </li>
              <li className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden /> Sans engagement : résiliable en un clic, à tout moment
              </li>
              <li className="flex gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden /> Satisfait ou remboursé pendant {REFUND_DAYS} jours
              </li>
              <li className="flex gap-2.5">
                <Lock className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden /> Paiement sécurisé : carte bancaire, Apple Pay, Google Pay ou prélèvement
              </li>
              {(endsAt || seatsLeft != null) && (
                <li className="flex gap-2.5 font-semibold text-amber-800">
                  <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {[seatsLeft != null ? `Plus que ${seatsLeft} place${seatsLeft > 1 ? "s" : ""} à ce tarif` : null, endsAt ? `jusqu'au ${formatDate(endsAt)}` : null].filter(Boolean).join(", ")}
                </li>
              )}
            </ul>
            <div className="mt-6">{action}</div>
            {note && <div className="mt-4 text-sm text-slate-600">{note}</div>}
          </section>
        </div>

        <section aria-labelledby="founder-faq" className="mx-auto mt-12 max-w-3xl">
          <h2 id="founder-faq" className="text-lg font-bold text-navy">
            Questions fréquentes
          </h2>
          <dl className="mt-4 space-y-4 text-sm">
            {[
              ["« À vie », c'est-à-dire ?", `Tant que votre abonnement reste actif, vous payez ${formatEuros(FOUNDER_PRICE_HT)} HT par mois, même si le prix de Pro augmente. Si vous résiliez, le tarif fondateur n'est plus disponible ensuite.`],
              ["Et si Pro ne me convient pas ?", `Vous êtes remboursé intégralement si vous le demandez dans les ${REFUND_DAYS} jours suivant votre souscription, sans justification : un simple message depuis la page Contact.`],
              ["Puis-je arrêter quand je veux ?", "Oui, sans engagement. La résiliation se fait en un clic dans « Mon abonnement » ; Pro reste actif jusqu'à la fin du mois payé."],
              ["Que se passe-t-il si je ne prends pas l'offre ?", "Vous gardez l'offre Gratuite, sans rien payer : les offres et besoins publiés (15 recherches par semaine), une alerte sur votre métier, la publication et la réponse aux besoins."],
              [
                "Pourquoi cette offre ?",
                founder
                  ? "Parce que vous avez fait confiance à LinkProB2B dès le début. Vos retours ont façonné le site : nous voulons vous en remercier durablement."
                  : "Pour remercier les premiers abonnés qui nous font confiance : le tarif est réservé à un petit nombre de places.",
              ],
            ].map(([q, a]) => (
              <div key={q} className="rounded-xl border border-slate-200 bg-white p-4">
                <dt className="font-semibold text-navy">{q}</dt>
                <dd className="mt-1 text-slate-600">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
