"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { PLANS, formatEuros, priceTTC, yearlyMonthlyHT, yearlySavingHT, type PlanInfo } from "@/lib/billing/plans";

const LAUNCH_HIGHLIGHTS = [
  "Profil entreprise et annuaire",
  "Fiche synthèse de chaque appel d'offres",
  "Veille chaque matin, du lundi au vendredi",
  "Recherche d'opportunités et alertes e-mail",
  "Besoins publiés et réponses reçues, sans limite",
  "Favoris, recommandations et pipeline commercial",
  "Messagerie avec les entreprises",
];

type Props = {
  /** Phase gratuite en cours : tout est gratuit, offres payantes seulement annoncées */
  launch: boolean;
  /** Paiement en ligne réellement ouvert */
  paidOpen: boolean;
  /** Essai avec carte ouvert (lancement payant) : nombre de jours, sinon null */
  trialDays: number | null;
  className?: string;
};

/**
 * Offres (page Tarifs et accueil au lancement) : bascule mensuel / annuel animée, carte Pro mise en
 * avant avec un liseré lumineux, apparition en cascade. Les montants viennent de la description des
 * offres ; le navigateur ne transmet jamais de prix au paiement.
 */
export function PricingPlans({ launch, paidOpen, trialDays, className }: Props) {
  const [yearly, setYearly] = useState(false);
  return (
    <div className={className}>
      <div className="flex justify-center">
        <div role="radiogroup" aria-label="Périodicité de paiement" className="relative inline-grid grid-cols-2 rounded-full bg-white/90 p-1 text-sm font-semibold shadow-lg ring-1 ring-slate-200 backdrop-blur-none">
          <span
            aria-hidden
            className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-navy shadow-md transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
            style={{ transform: yearly ? "translateX(100%)" : "none" }}
          />
          {[false, true].map((y) => (
            <button
              key={String(y)}
              type="button"
              role="radio"
              aria-checked={yearly === y}
              onClick={() => setYearly(y)}
              className={cn("relative z-10 rounded-full px-3 py-2 text-[13px] whitespace-nowrap transition-colors duration-300 sm:px-5 sm:text-sm", yearly === y ? "text-white" : "text-slate-600 hover:text-navy")}
            >
              {y ? (
                <>
                  Annuel <span className={cn("ml-1 rounded-full px-1.5 py-0.5 text-[10px] whitespace-nowrap sm:text-[11px]", yearly ? "bg-teal text-navy" : "bg-teal-50 text-teal-800")}>2 mois offerts</span>
                </>
              ) : (
                "Mensuel"
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3 lg:gap-5">
        {PLANS.map((p, i) => (
          <PlanCard key={p.code} p={p} index={i} yearly={yearly} launch={launch} paidOpen={paidOpen} trialDays={trialDays} />
        ))}
      </div>
    </div>
  );
}

function PlanCard({ p, index, yearly, launch, paidOpen, trialDays }: { p: PlanInfo; index: number; yearly: boolean; launch: boolean; paidOpen: boolean; trialDays: number | null }) {
  const free = p.code === "FREE";
  const dark = Boolean(p.popular);
  const trialCta = Boolean(trialDays) && !free;
  const href = free || !paidOpen ? "/inscription" : trialCta ? `/inscription?offre=${p.code}&suite=${encodeURIComponent(`/essai?offre=${p.code}`)}` : `/dashboard/abonnement?offre=${p.code}`;
  const label = trialCta
    ? `Essayer ${trialDays} jours gratuits`
    : free && trialDays
      ? "Commencer avec l'offre Gratuite"
      : free || paidOpen
        ? p.cta
        : "Ouverture prochaine — commencer gratuitement";
  const monthly = yearly && !free ? yearlyMonthlyHT(p) : p.priceHT;
  const highlights = launch && free && !trialDays ? LAUNCH_HIGHLIGHTS : p.highlights;

  const body = (
    <div className={cn("relative flex h-full flex-col rounded-[1.4rem] p-7", dark ? "bg-navy text-white" : "bg-white text-navy")}>
      {dark && <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 size-56 rounded-full bg-teal/30 blur-3xl" />}
      <div className="flex items-center justify-between gap-3">
        <h3 className={cn("font-heading text-xl font-extrabold", dark ? "text-white" : "text-navy")}>{p.name}</h3>
        {dark && (
          <span className="inline-flex items-center gap-1 rounded-full bg-teal px-2.5 py-1 text-[11px] font-bold tracking-wide text-navy uppercase">
            <Sparkles className="size-3" aria-hidden /> {trialDays ? "Le plus choisi" : "Recommandé"}
          </span>
        )}
      </div>
      <p className={cn("mt-2 min-h-10 text-sm", dark ? "text-slate-300" : "text-slate-600")}>
        {launch && free && !trialDays ? "Toutes les fonctionnalités, gratuitement, pendant la phase de lancement." : p.tagline}
      </p>

      <div className="mt-6 flex items-end gap-1.5">
        <span key={`${p.code}-${yearly}`} className={cn("price-pop font-heading text-5xl leading-none font-extrabold tracking-tight", dark ? "text-white" : "text-navy")}>
          {formatEuros(monthly)}
        </span>
        {p.priceHT > 0 && <span className={cn("pb-1 text-sm font-medium", dark ? "text-slate-300" : "text-slate-500")}>HT / mois</span>}
      </div>
      <p className={cn("mt-2 text-xs", dark ? "text-slate-400" : "text-slate-500")}>
        {p.priceHT === 0
          ? "Sans carte bancaire, sans limite de durée"
          : trialDays
            ? `${trialDays} jours offerts, puis ${formatEuros(priceTTC(yearly ? p.yearlyPriceHT : p.priceHT))} TTC ${yearly ? "par an" : "par mois"} · sans engagement`
            : yearly
              ? `facturé ${formatEuros(p.yearlyPriceHT)} HT par an · soit ${formatEuros(priceTTC(p.yearlyPriceHT))} TTC`
              : `soit ${formatEuros(priceTTC(p.priceHT))} TTC (TVA 20 %) · sans engagement`}
      </p>

      {p.yearlyPriceHT > 0 && (
        <p
          className={cn("mt-4 rounded-xl px-3 py-2 text-sm transition-colors duration-300", dark ? "bg-white/10 text-teal-100" : "bg-teal-50 text-teal-900")}
          data-testid={`yearly-${p.code}`}
        >
          {yearly ? (
            <>
              <strong>{formatEuros(p.yearlyPriceHT)} HT / an</strong> : vous économisez {formatEuros(yearlySavingHT(p))} HT
            </>
          ) : (
            <>
              <strong>Ou {formatEuros(p.yearlyPriceHT)} HT / an</strong> : 2 mois offerts ({formatEuros(yearlySavingHT(p))} HT d&apos;économie)
            </>
          )}
        </p>
      )}
      {launch && !free && !trialDays && (
        <p className={cn("mt-3 rounded-xl px-3 py-2 text-sm font-medium", dark ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-700")}>Offre prévue : pas encore proposée à l&apos;achat.</p>
      )}

      <ul className="mt-6 flex-1 space-y-3 text-sm">
        {highlights.map((h) => (
          <li key={h} className="flex gap-3">
            <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full", dark ? "bg-teal text-navy" : "bg-teal-50 text-teal-700")}>
              <Check className="size-3.5" strokeWidth={3} aria-hidden />
            </span>
            <span className={dark ? "text-slate-100" : "text-slate-700"}>{h}</span>
          </li>
        ))}
      </ul>

      <Link
        href={href}
        className={cn(
          "group/cta mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-center font-semibold transition duration-200",
          dark
            ? "btn-shine bg-teal text-navy shadow-lg shadow-teal/30 hover:bg-teal-400"
            : free
              ? "border border-slate-300 bg-white text-navy hover:border-navy"
              : "bg-navy text-white hover:bg-navy-900",
        )}
      >
        {label}
        <ArrowRight className="size-4 transition-transform group-hover/cta:translate-x-1" aria-hidden />
      </Link>
    </div>
  );

  return (
    <div
      className={cn(
        "plan-card plan-in relative rounded-3xl transition duration-300 hover:-translate-y-1.5",
        dark && "order-first lg:order-none",
        dark ? "plan-glow p-[2px] shadow-2xl shadow-teal/20 lg:-my-4" : "shadow-sm ring-1 ring-slate-200 hover:shadow-xl",
      )}
      style={{ animationDelay: `${150 + index * 120}ms` }}
    >
      {body}
    </div>
  );
}
