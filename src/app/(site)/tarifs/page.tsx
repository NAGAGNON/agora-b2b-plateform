import Link from "next/link";
import { freeLaunch } from "@/lib/billing/entitlements";
import { PageHero } from "@/components/layout/page-hero";
import { Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ComparisonTable } from "@/components/billing/comparison-table";
import { PLANS, formatEuros, priceTTC, yearlyMonthlyHT, yearlySavingHT } from "@/lib/billing/plans";
import { pageMetadata } from "@/lib/seo";
import { Notice } from "@/components/ui/notice";
import { stripeMode } from "@/lib/billing/stripe";
import { env } from "@/lib/env";

export const metadata = pageMetadata({
  title: "Tarifs",
  description: "LinkProB2B Gratuit, Pro (59 € HT/mois ou 590 € HT/an) et Business (99 € HT/mois ou 990 € HT/an) : sans engagement en mensuel, 2 mois offerts en annuel.",
  path: "/tarifs",
});

const LAUNCH_HIGHLIGHTS = [
  "Profil entreprise et annuaire",
  "Recherche d'opportunités et alertes e-mail",
  "Besoins publiés et réponses reçues, sans limite",
  "Favoris, recommandations et pipeline commercial",
  "Messagerie avec les entreprises",
];

export default async function PricingPage() {
  // Paiement réel seulement en mode LIVE : sinon les offres payantes sont annoncées, pas vendues
  const paidOpen = stripeMode() === "live" || !env.isProduction;
  // Phase de lancement : toutes les fonctionnalités gratuites pour les inscrits ; offres payantes prévues
  const launch = await freeLaunch();
  return (
    <>
    <PageHero
      eyebrow="Offres LinkProB2B"
      image="/images/illustrations/accord.webp"
      title="Tarifs"
      intro={
        launch
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

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.code}
            className={`reveal glow-card relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${p.popular ? "border-teal ring-2 ring-teal" : "border-slate-200"}`}
          >
            {p.popular && (
              <Badge tone="navy" className="absolute -top-3 left-1/2 -translate-x-1/2 uppercase">
                Recommandé
              </Badge>
            )}
            <h2 className="text-xl font-bold">LinkProB2B {p.name}</h2>
            <p className="mt-1 min-h-10 text-sm text-slate-600">{launch && p.code === "FREE" ? "Toutes les fonctionnalités, gratuitement, pendant la phase de lancement." : p.tagline}</p>
            <p className="mt-4 font-heading text-4xl font-bold text-navy">
              {formatEuros(p.priceHT)}
              {p.priceHT > 0 && <span className="text-base font-medium text-slate-500"> HT / mois</span>}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {p.priceHT > 0 ? `soit ${formatEuros(priceTTC(p.priceHT))} TTC (TVA 20 %) · sans engagement` : "Sans carte bancaire, sans limite de durée"}
            </p>
            {p.yearlyPriceHT > 0 && (
              <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800" data-testid={`yearly-${p.code}`}>
                <strong>Ou {formatEuros(p.yearlyPriceHT)} HT / an</strong> : 2 mois offerts, soit {formatEuros(yearlyMonthlyHT(p))} HT par mois
                ({formatEuros(yearlySavingHT(p))} HT d&apos;économie)
              </p>
            )}
            {launch && p.code !== "FREE" && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">Offre prévue : pas encore proposée à l&apos;achat.</p>
            )}
            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {(launch && p.code === "FREE" ? LAUNCH_HIGHLIGHTS : p.highlights).map((h) => (
                <li key={h} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
            <ButtonLink
              href={p.code === "FREE" || !paidOpen ? "/inscription" : `/dashboard/abonnement?offre=${p.code}`}
              variant={p.popular ? "primary" : p.code === "FREE" ? "outline" : "secondary"}
              full
              className="mt-6 h-auto min-h-11 py-2 text-center whitespace-normal"
            >
              {p.code === "FREE" || paidOpen ? p.cta : "Ouverture prochaine — commencer gratuitement"}
            </ButtonLink>
          </div>
        ))}
      </div>

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
