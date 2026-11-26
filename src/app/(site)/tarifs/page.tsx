import Link from "next/link";
import { ArrowRight, ChevronDown, Lock, Radar, ShieldCheck, Zap } from "lucide-react";
import { freeLaunch } from "@/lib/billing/entitlements";
import { cardTrial } from "@/lib/billing/card-trial";
import { FOUNDER_PRICE_HT, founderOffer, founderOpen, founderSeatsTaken, seatsLeft } from "@/lib/billing/founder";
import { ComparisonTable } from "@/components/billing/comparison-table";
import { PricingPlans } from "@/components/billing/pricing-plans";
import { Testimonials } from "@/components/home/testimonials";
import { formatEuros } from "@/lib/billing/plans";
import { pageMetadata } from "@/lib/seo";
import { Notice } from "@/components/ui/notice";
import { stripeMode } from "@/lib/billing/stripe";
import { env } from "@/lib/env";
import { getPlatformStats } from "@/lib/queries/platform";
import { getSession } from "@/lib/auth";
import { LaunchFounderNote } from "@/components/dashboard/launch-founder-note";
import { CreditsPricing } from "@/components/billing/credits";
import { creditsEnabled } from "@/lib/billing/credits-switch";

export const metadata = pageMetadata({
  title: "Tarifs",
  description: "LinkProB2B Gratuit, Pro (29 € HT/mois ou 290 € HT/an) et Business (59 € HT/mois ou 590 € HT/an) : sans engagement en mensuel, 2 mois offerts en annuel.",
  path: "/tarifs",
});


/** Heure courante (hors rendu pur). */
const nowMs = () => Date.now();

export default async function PricingPage(props: PageProps<"/tarifs">) {
  // Offre par crédits : affichée au lancement ; l'équipe peut la voir avant avec ?offre=credits
  const preview = (await props.searchParams).offre === "credits" && Boolean((await getSession())?.isStaff);
  if (preview || (await creditsEnabled())) return <CreditsPricing />;
  // Paiement réel seulement en mode LIVE : sinon les offres payantes sont annoncées, pas vendues
  const paidOpen = stripeMode() === "live" || !env.isProduction;
  // Phase de lancement : toutes les fonctionnalités gratuites pour les inscrits ; offres payantes prévues
  const [launch, trial, offer, stats] = await Promise.all([
    freeLaunch(),
    cardTrial(),
    founderOffer().catch(() => null),
    getPlatformStats().catch(() => null),
  ]);
  const offerOpen = Boolean(offer && founderOpen(offer));
  const offerSeats = offer && offerOpen ? seatsLeft(offer, await founderSeatsTaken()) : 0;
  const intro = trial.enabled
    ? `Essayez Pro ou Business ${trial.days} jours, sans engagement : rien n'est débité avant la fin de l'essai.`
    : launch
      ? "Pendant la phase de lancement, toutes les fonctionnalités sont gratuites pour les inscrits. Les membres inscrits pendant cette période auront un tarif fondateur réservé quand les offres Pro et Business ouvriront."
      : "Commencez gratuitement. Passez à Pro quand vous voulez plus d'opportunités, d'alertes et d'outils commerciaux.";
  const chips = stats
    ? [
        stats.active > 0 && `${stats.active.toLocaleString("fr-FR")} opportunités ouvertes`,
        stats.new_7d > 0 && `+${stats.new_7d.toLocaleString("fr-FR")} en 7 jours`,
        stats.departments > 0 && `${stats.departments} départements couverts`,
      ].filter(Boolean)
    : [];

  return (
    <>
      {/* En-tête */}
      <section className="relative isolate overflow-hidden bg-navy-900 pt-16 pb-40 text-white sm:pt-20">
        <div aria-hidden className="bg-tech-grid absolute inset-0 -z-10 opacity-40" />
        <div aria-hidden className="absolute -top-40 left-1/4 -z-10 size-[34rem] animate-aurora rounded-full bg-teal/25 blur-3xl" />
        <div aria-hidden className="absolute -right-32 -bottom-40 -z-10 size-[30rem] animate-aurora rounded-full bg-electric/25 blur-3xl [animation-delay:-6s]" />
        <div className="container-page text-center">
          <p className="inline-flex animate-rise items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-teal ring-1 ring-white/15">
            <Zap className="size-4" aria-hidden /> Offres LinkProB2B
          </p>
          <h1 className="mx-auto mt-6 max-w-3xl animate-rise font-heading text-4xl leading-[1.05] font-extrabold text-white [animation-delay:120ms] sm:text-6xl">
            Trouvez plus de marchés. <span className="text-gradient">Répondez mieux.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl animate-rise text-lg text-slate-300 [animation-delay:240ms]">{intro}</p>
          {chips.length > 0 && (
            <ul className="mt-7 flex animate-rise flex-wrap justify-center gap-2 text-sm [animation-delay:360ms]" aria-label="La plateforme aujourd'hui">
              {chips.map((c) => (
                <li key={String(c)} className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-slate-200 ring-1 ring-white/10">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-teal" />
                  </span>
                  {c}
                </li>
              ))}
            </ul>
          )}
          {launch && (
            <div className="mx-auto mt-8 max-w-3xl text-left">
              <LaunchFounderNote userId={(await getSession())?.userId ?? null} now={nowMs()} />
            </div>
          )}
        </div>
      </section>

      {/* Offres (chevauchent l'en-tête) */}
      <section aria-label="Offres" className="container-page relative z-10 -mt-28">
        {!paidOpen && !launch && (
          <Notice tone="info" title="Offres payantes : ouverture prochaine" className="mx-auto mb-6 max-w-2xl">
            Le paiement en ligne est en cours de mise en service : les offres Pro et Business ne peuvent pas encore être souscrites. L&apos;offre Gratuite est
            disponible dès maintenant, sans carte bancaire.
          </Notice>
        )}
        {offerOpen && (
          <div className="mx-auto mb-8 flex max-w-3xl flex-col items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-xl ring-1 ring-teal/40 sm:flex-row" data-testid="pricing-launch">
            <div>
              <p className="text-lg font-bold text-navy">Offre de lancement : Pro à {formatEuros(FOUNDER_PRICE_HT)}/mois les 3 premiers mois</p>
              <p className="text-sm text-slate-600">
                {offerSeats} place{offerSeats > 1 ? "s" : ""} restante{offerSeats > 1 ? "s" : ""} · satisfait ou remboursé 30 jours
              </p>
            </div>
            <Link href="/offre-fondateur" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-navy px-5 py-3 font-semibold text-white hover:bg-navy-900">
              J&apos;en profite <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        )}
        <PricingPlans launch={launch} paidOpen={paidOpen} trialDays={trial.enabled ? trial.days : null} />
        <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-slate-600">
          <li className="inline-flex items-center gap-2">
            <ShieldCheck className="size-4 text-teal-700" aria-hidden /> Sans engagement en mensuel
          </li>
          <li className="inline-flex items-center gap-2">
            <Lock className="size-4 text-teal-700" aria-hidden /> Paiement sécurisé par Stripe
          </li>
          <li className="inline-flex items-center gap-2">
            <Radar className="size-4 text-teal-700" aria-hidden /> Sources officielles : BOAMP et TED
          </li>
        </ul>
      </section>


      <Testimonials />

      {/* Comparatif */}
      <section className="cv-auto container-page max-w-5xl pb-16 sm:pb-24" aria-labelledby="compare">
        <h2 id="compare" className="text-center font-heading text-3xl font-extrabold text-navy sm:text-4xl">
          Comparer les offres
        </h2>
        {launch && !trial.enabled && (
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
            Limites prévues après la phase de lancement. Aujourd&apos;hui, les inscrits ont accès à toutes les fonctionnalités, sans limite commerciale.
          </p>
        )}
        {/* Tableau détaillé replié : les cartes ci-dessus suffisent pour choisir */}
        <details className="group mt-6 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <summary className="cursor-pointer list-none px-5 py-4 text-center font-semibold text-teal-700 [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Afficher le tableau détaillé</span>
            <span className="hidden group-open:inline">Masquer le tableau détaillé</span>
          </summary>
          <div className="border-t border-slate-100 p-2 sm:p-4">
            <ComparisonTable />
          </div>
        </details>
      </section>

      {/* Questions fréquentes */}
      <section className="cv-auto container-page max-w-3xl pb-16 sm:pb-24" aria-labelledby="questions">
        <h2 id="questions" className="text-center font-heading text-3xl font-extrabold text-navy sm:text-4xl">
          Questions fréquentes
        </h2>
        <div className="mt-8 space-y-3">
          {[
            ...(trial.enabled
              ? [
                  {
                    q: `Comment fonctionne l'essai de ${trial.days} jours ?`,
                    a: `Vous enregistrez votre carte sur la page sécurisée de Stripe : rien n'est débité pendant ${trial.days} jours. Un e-mail vous prévient 3 jours avant la fin. Sans résiliation de votre part, l'abonnement démarre ensuite automatiquement.`,
                  },
                ]
              : []),
            {
              q: "Comment se passe le paiement ?",
              a: `${paidOpen ? "Le paiement est" : "Dès l'ouverture des offres payantes, le paiement sera"} mensuel ou annuel, par carte bancaire, sur la page sécurisée de notre prestataire Stripe. Vos coordonnées bancaires ne transitent jamais par LinkProB2B. Une facture est disponible dans « Mon abonnement ».`,
            },
            {
              q: "Puis-je résilier ou changer d'offre ?",
              a: "Oui, à tout moment depuis « Mon abonnement ». La résiliation prend effet à la fin de la période en cours ; votre entreprise repasse alors à l'offre Gratuite.",
            },
            {
              q: "Que deviennent mes données si je repasse à l'offre Gratuite ?",
              a: "Elles sont toutes conservées (besoins, favoris, alertes, pipeline). Seuls les nouveaux ajouts au-delà des limites de l'offre Gratuite sont bloqués.",
            },
            {
              q: "LinkProB2B garantit-il des contrats ?",
              a: "Non. LinkProB2B vous aide à identifier des opportunités et des partenaires ; l'obtention de contrats dépend de vos échanges et de vos offres. Les marchés publics affichés proviennent de sources officielles identifiées (BOAMP, TED).",
            },
          ].map(({ q, a }) => (
            <details key={q} className="faq-item group rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 open:ring-teal/40">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-navy [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown className="size-5 shrink-0 text-slate-400 transition-transform duration-300 group-open:rotate-180 group-open:text-teal-700" aria-hidden />
              </summary>
              <p className="faq-body px-5 pb-5 text-[15px] text-slate-600">{a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-slate-600">
          Voir les{" "}
          <Link href="/conditions-abonnement" className="font-semibold text-teal-700 underline">
            conditions d&apos;abonnement
          </Link>{" "}
          et les{" "}
          <Link href="/cgu" className="font-semibold text-teal-700 underline">
            conditions générales d&apos;utilisation
          </Link>
          .
        </p>
      </section>

      {/* Appel à l'action final */}
      <section className="cv-auto container-page pb-20">
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-navy via-navy-900 to-navy px-6 py-14 text-center text-white sm:px-12">
          <div aria-hidden className="absolute -top-24 left-1/3 -z-10 size-96 animate-aurora rounded-full bg-teal/30 blur-3xl" />
          <h2 className="mx-auto max-w-2xl font-heading text-3xl font-extrabold text-white sm:text-4xl">Votre prochain client publie peut-être son besoin aujourd&apos;hui.</h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-300">
            {trial.enabled ? `${trial.days} jours pour essayer, sans engagement.` : "Créez votre compte en une minute et recevez les opportunités de votre métier."}
          </p>
          <Link
            href={trial.enabled ? `/inscription?offre=PRO&suite=${encodeURIComponent("/essai?offre=PRO")}` : "/inscription"}
            className="btn-shine mt-8 inline-flex items-center gap-2 rounded-xl bg-teal px-7 py-4 font-semibold text-navy shadow-lg shadow-teal/30 transition hover:bg-teal-400"
          >
            {trial.enabled ? `Essayer ${trial.days} jours gratuits` : "Créer mon compte"} <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>
    </>
  );
}
