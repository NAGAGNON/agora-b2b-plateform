import Link from "next/link";
import { Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ComparisonTable } from "@/components/billing/comparison-table";
import { PLANS, formatEuros, priceTTC } from "@/lib/billing/plans";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Tarifs",
  description: "LinkProB2B Gratuit, Pro (29 € HT/mois) et Business (59 € HT/mois) : sans engagement, résiliable à tout moment.",
  path: "/tarifs",
});

export default function PricingPage() {
  return (
    <div className="container-page py-10 sm:py-14">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">Tarifs</h1>
        <p className="mt-3 text-lg text-slate-600">
          Commencez gratuitement. Passez à Pro lorsque vous avez besoin de davantage d&apos;opportunités, d&apos;alertes et d&apos;outils commerciaux.
        </p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.code}
            className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${p.popular ? "border-teal ring-2 ring-teal" : "border-slate-200"}`}
          >
            {p.popular && (
              <Badge tone="navy" className="absolute -top-3 left-1/2 -translate-x-1/2 uppercase">
                Le plus populaire
              </Badge>
            )}
            <h2 className="text-xl font-bold">LinkProB2B {p.name}</h2>
            <p className="mt-1 min-h-10 text-sm text-slate-600">{p.tagline}</p>
            <p className="mt-4 font-heading text-4xl font-bold text-navy">
              {formatEuros(p.priceHT)}
              {p.priceHT > 0 && <span className="text-base font-medium text-slate-500"> HT / mois</span>}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {p.priceHT > 0 ? `soit ${formatEuros(priceTTC(p.priceHT))} TTC (TVA 20 %) · sans engagement` : "Sans carte bancaire, sans limite de durée"}
            </p>
            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {p.highlights.map((h) => (
                <li key={h} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
            <ButtonLink
              href={p.code === "FREE" ? "/inscription" : `/dashboard/abonnement?offre=${p.code}`}
              variant={p.popular ? "primary" : p.code === "FREE" ? "outline" : "secondary"}
              full
              className="mt-6 h-auto min-h-11 py-2 text-center whitespace-normal"
            >
              {p.cta}
            </ButtonLink>
          </div>
        ))}
      </div>

      <section className="mx-auto mt-14 max-w-4xl" aria-labelledby="compare">
        <h2 id="compare" className="text-2xl font-bold">
          Comparer les offres
        </h2>
        <ComparisonTable />
      </section>

      <section className="prose-content mx-auto mt-14 max-w-3xl text-[15px] text-slate-700" aria-labelledby="questions">
        <h2 id="questions">Questions fréquentes</h2>
        <h3>Comment se passe le paiement ?</h3>
        <p>
          Le paiement est mensuel, par carte bancaire, sur la page sécurisée de notre prestataire Stripe. Vos coordonnées bancaires ne transitent jamais par
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
  );
}
