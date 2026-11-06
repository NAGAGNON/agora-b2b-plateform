import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { CompanyOfferState, MarketPulse } from "@/lib/billing/founder";
import { FOUNDER_PRICE_HT, ON_DEMAND_TRIAL_DAYS, daysLeft } from "@/lib/billing/founder";
import { formatEuros } from "@/lib/billing/plans";
import { buttonClasses } from "@/components/ui/button";
import { StartTrialForm } from "@/components/dashboard/billing-forms";

const nf = new Intl.NumberFormat("fr-FR");

export type LaunchCardProps = {
  state: CompanyOfferState | null; // null : pas encore d'entreprise
  pulse: MarketPulse | null;
  seatsLeft: number;
  endsAt: string | null;
  now: number;
};

/**
 * Encart de l'espace membre pendant l'offre de lancement : une phrase, un bouton.
 * Essai en cours (avec barre des jours restants), essai à démarrer, essai terminé, sans entreprise.
 */
export function LaunchCard({ state, pulse, seatsLeft, now }: LaunchCardProps) {
  if (state?.paid) return null;
  const price = `${formatEuros(FOUNDER_PRICE_HT)}/mois à vie`;
  const seats = seatsLeft > 0 ? `${seatsLeft} place${seatsLeft > 1 ? "s" : ""} au tarif fondateur` : null;
  const market = pulse && pulse.france > 0 ? `${nf.format(pulse.france)} offres de votre métier ce mois-ci` : null;

  let title: string;
  let sub: string | null;
  let action: React.ReactNode;
  let progress: number | null = null;
  if (!state) {
    title = `Pro offert ${ON_DEMAND_TRIAL_DAYS} jours`;
    sub = "Créez votre profil en 30 secondes pour l'activer.";
    action = (
      <Link href="/onboarding/entreprise?suite=%2Fdashboard" className={buttonClasses({ size: "sm", className: "shrink-0" })}>
        Activer
      </Link>
    );
  } else if (state.trialActive) {
    const d = daysLeft(state.trialEndsAt, now);
    title = `Pro activé · ${d} jour${d > 1 ? "s" : ""} restant${d > 1 ? "s" : ""}`;
    sub = `Gardez-le à ${price}.`;
    progress = Math.max(4, Math.min(100, (d / 30) * 100));
    action = (
      <Link href="/offre-fondateur" className={buttonClasses({ size: "sm", className: "shrink-0" })}>
        Garder Pro
      </Link>
    );
  } else if (!state.trialUsed) {
    title = `Essayez Pro ${ON_DEMAND_TRIAL_DAYS} jours, gratuitement`;
    sub = "Sans carte, sans engagement.";
    action = (
      <div className="w-full shrink-0 sm:w-60">
        <StartTrialForm suite="/dashboard" label="Essayer Pro" hint={false} />
      </div>
    );
  } else {
    title = "Votre essai Pro est terminé";
    sub = `Réactivez-le à ${price}.`;
    action = (
      <Link href="/offre-fondateur" className={buttonClasses({ size: "sm", className: "shrink-0" })}>
        Réactiver Pro
      </Link>
    );
  }

  const meta = [market, seats].filter(Boolean).join(" · ");
  return (
    <div className="mb-6 overflow-hidden rounded-2xl bg-navy text-white shadow-sm" data-testid="launch-card">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-amber-300">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-bold">{title}</p>
            {sub && <p className="text-sm text-white/80">{sub}</p>}
            {meta && <p className="mt-0.5 text-xs text-teal-300">{meta}</p>}
          </div>
        </div>
        {action}
      </div>
      {progress !== null && (
        <div className="h-1.5 bg-white/10" aria-hidden>
          <div className="h-full bg-teal-400" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
