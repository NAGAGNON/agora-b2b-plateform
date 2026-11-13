import Link from "next/link";
import { freeLaunch } from "@/lib/billing/entitlements";
import { PageHero } from "@/components/layout/page-hero";
import { buttonClasses } from "@/components/ui/button";
import { PricingCards } from "@/components/billing/pricing-cards";
import { cardTrial } from "@/lib/billing/card-trial";
import { FOUNDER_PRICE_HT, founderOffer, founderOpen, founderSeatsTaken, seatsLeft } from "@/lib/billing/founder";
import { ComparisonTable } from "@/components/billing/comparison-table";
import { formatEuros } from "@/lib/billing/plans";
import { pageMetadata } from "@/lib/seo";
import { Notice } from "@/components/ui/notice";
import { stripeMode } from "@/lib/billing/stripe";
import { env } from "@/lib/env";

export const metadata = pageMetadata({
  title: "Tarifs",
  description: "LinkProB2B Gratuit, Pro (29 € HT/mois ou 290 € HT/an) et Business (59 € HT/mois ou 590 € HT/an) : sans engagement en mensuel, 2 mois offerts en annuel.",
  path: "/tarifs",
});

export default async function PricingPage() {
  // Paiement réel seulement en mode LIVE : sinon les offres payantes sont annoncées, pas vendues
  const paidOpen = stripeMode() === "live" || !env.isProduction;
  // Phase de lancement : toutes les fonctionnalités gratuites pour les inscrits ; offres payantes prévues
  const launch = await freeLaunch();
  const trial = await cardTrial();
  const offer = await founderOffer().catch(() => null);
  const offerOpen = Boolean(offer && founderOpen(offer));
  const offerSeats = offer && offerOpen ? seatsLeft(offer, await founderSeatsTaken()) : 0;
  return (
    <>
    <PageHero
      eyebrow="Offres LinkProB2B"
      image="/images/illustrations/accord.webp"
      title="Tarifs"
      intro={
        trial.enabled
          ? `Essayez Pro ou Business ${trial.days} jours, sans engagement : rien n'est débité avant la fin de l'essai. L'offre Gratuite reste disponible, avec des limites.`
          : launch
          ? "Pendant la phase de lancement, toutes les fonctionnalités de LinkProB2B sont gratuites pour les inscrits. Les offres Pro et Business sont prévues pour plus tard."
          : "Commencez gratuitement. Passez à Pro lorsque vous avez besoin de davantage d'opportunités, d'alertes et d'outils commerciaux."
      }
    />
    <div className="container-page py-10 sm:py-14">

      {!paidOpen && !launch && (
        <Notice tone="info" title="Offres payantes : ouverture prochaine" className="mx-auto max-w-2xl">
          Le paiement en ligne est en cours de mise en service : les offres Pro et Business ne peuvent pas encore être souscrites. L&apos;offre Gratuite
          est disponible dès maintenant, sans carte bancaire.
        </Notice>
      )}

      {offerOpen && (
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-4 rounded-2xl bg-navy p-5 text-white sm:flex-row" data-testid="pricing-launch">
          <div>
            <p className="text-lg font-bold">Offre de lancement : Pro à {formatEuros(FOUNDER_PRICE_HT)}/mois à vie</p>
            <p className="text-sm text-white/80">
              {offerSeats} place{offerSeats > 1 ? "s" : ""} restante{offerSeats > 1 ? "s" : ""} · satisfait ou remboursé 30 jours
            </p>
          </div>
          <Link href="/offre-fondateur" className={buttonClasses({ className: "shrink-0" })}>
            J&apos;en profite
          </Link>
        </div>
      )}

      <PricingCards launch={launch} paidOpen={paidOpen} trialDays={trial.enabled ? trial.days : null} className="mt-10" />

      <section className="mx-auto mt-14 max-w-4xl" aria-labelledby="compare">
        <h2 id="compare" className="text-2xl font-bold">
          Comparer les offres
        </h2>
        {launch && (
          <p className="mt-2 text-sm text-slate-600">
            Limites prévues après la phase de lancement. Aujourd&apos;hui, les inscrits ont accès à toutes les fonctionnalités, sans limite commerciale.
          </p>
        )}
        <ComparisonTable />
      </section>

      <section className="prose-content mx-auto mt-14 max-w-3xl text-[15px] text-slate-700" aria-labelledby="questions">
        <h2 id="questions">Questions fréquentes</h2>
        <h3>Comment se passe le paiement ?</h3>
        <p>
          {paidOpen ? "Le paiement est" : "Dès l'ouverture des offres payantes, le paiement sera"} mensuel, par carte bancaire, sur la page sécurisée de notre prestataire Stripe. Vos coordonnées bancaires ne transitent jamais par
          LinkProB2B. Une facture est disponible chaque mois dans « Mon abonnement ».
        </p>
        <h3>Puis-je résilier ou changer d&apos;offre ?</h3>
        <p>
          Oui, à tout moment depuis « Mon abonnement ». La résiliation prend effet à la fin de la période déjà payée ; votre entreprise repasse alors à
          l&apos;offre Gratuite.
        </p>
        <h3>Que deviennent mes données si je repasse à l&apos;offre Gratuite ?</h3>
        <p>
          Elles sont toutes conservées (besoins, favoris, alertes, pipeline). Seuls les nouveaux ajouts au-delà des limites de l&apos;offre Gratuite sont
          bloqués.
        </p>
        <h3>LinkProB2B garantit-il des contrats ?</h3>
        <p>
          Non. LinkProB2B vous aide à identifier des opportunités et des partenaires ; l&apos;obtention de contrats dépend de vos échanges et de vos offres.
          Les marchés publics affichés proviennent de sources officielles identifiées (BOAMP, TED).
        </p>
        <p>
          Voir les <Link href="/conditions-abonnement">conditions d&apos;abonnement</Link> et les <Link href="/cgu">conditions générales d&apos;utilisation</Link>.
        </p>
      </section>
    </div>
    </>
  );
}
