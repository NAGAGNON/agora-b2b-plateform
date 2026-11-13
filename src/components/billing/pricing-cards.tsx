import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { PLANS, formatEuros, priceTTC, yearlyMonthlyHT, yearlySavingHT } from "@/lib/billing/plans";

const LAUNCH_HIGHLIGHTS = [
  "Profil entreprise et annuaire",
  "Fiche synthèse de chaque appel d'offres",
  "Veille chaque matin, du lundi au vendredi",
  "Recherche d'opportunités et alertes e-mail",
  "Besoins publiés et réponses reçues, sans limite",
  "Favoris, recommandations et pipeline commercial",
  "Messagerie avec les entreprises",
];

/**
 * Cartes des offres (page Tarifs, et accueil une fois le lancement payant ouvert).
 * - launch : phase gratuite en cours (tout est gratuit, offres payantes annoncées) ;
 * - trialDays : essai avec carte ouvert (lancement payant) → bouton « Essayer N jours gratuits ».
 */
export function PricingCards({ launch, paidOpen, trialDays, className }: { launch: boolean; paidOpen: boolean; trialDays: number | null; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-6 lg:grid-cols-3", className)}>
      {PLANS.map((p) => {
        const free = p.code === "FREE";
        const trialCta = trialDays && !free;
        const href = free || !paidOpen ? "/inscription" : trialCta ? `/inscription?offre=${p.code}&suite=${encodeURIComponent(`/essai?offre=${p.code}`)}` : `/dashboard/abonnement?offre=${p.code}`;
        const label = trialCta ? `Essayer ${trialDays} jours gratuits` : free && trialDays ? "Commencer avec l'offre Gratuite" : free || paidOpen ? p.cta : "Ouverture prochaine — commencer gratuitement";
        return (
          <div key={p.code} className={cn("reveal glow-card relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm", p.popular ? "border-teal ring-2 ring-teal" : "border-slate-200")}>
            {p.popular && (
              <Badge tone="navy" className="absolute -top-3 left-1/2 -translate-x-1/2 uppercase">
                {trialDays ? "Le plus choisi" : "Recommandé"}
              </Badge>
            )}
            <h3 className="text-xl font-bold text-navy">LinkProB2B {p.name}</h3>
            <p className="mt-1 min-h-10 text-sm text-slate-600">{launch && free && !trialDays ? "Toutes les fonctionnalités, gratuitement, pendant la phase de lancement." : p.tagline}</p>
            <p className="mt-4 font-heading text-4xl font-bold text-navy">
              {formatEuros(p.priceHT)}
              {p.priceHT > 0 && <span className="text-base font-medium text-slate-500"> HT / mois</span>}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {p.priceHT > 0
                ? trialDays
                  ? `${trialDays} jours offerts, puis ${formatEuros(priceTTC(p.priceHT))} TTC / mois · sans engagement`
                  : `soit ${formatEuros(priceTTC(p.priceHT))} TTC (TVA 20 %) · sans engagement`
                : "Sans carte bancaire, sans limite de durée"}
            </p>
            {p.yearlyPriceHT > 0 && (
              <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800" data-testid={`yearly-${p.code}`}>
                <strong>Ou {formatEuros(p.yearlyPriceHT)} HT / an</strong> : 2 mois offerts, soit {formatEuros(yearlyMonthlyHT(p))} HT par mois ({formatEuros(yearlySavingHT(p))} HT
                d&apos;économie)
              </p>
            )}
            {launch && !free && !trialDays && <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">Offre prévue : pas encore proposée à l&apos;achat.</p>}
            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {(launch && free && !trialDays ? LAUNCH_HIGHLIGHTS : p.highlights).map((h) => (
                <li key={h} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
            <ButtonLink
              href={href}
              variant={p.popular ? "primary" : free ? "outline" : "secondary"}
              full
              className="mt-6 h-auto min-h-11 py-2 text-center whitespace-normal"
            >
              {label}
            </ButtonLink>
          </div>
        );
      })}
    </div>
  );
}
