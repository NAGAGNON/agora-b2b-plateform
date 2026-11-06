import Link from "next/link";
import { Clock, Sparkles, TrendingUp } from "lucide-react";
import type { CompanyOfferState, MarketPulse } from "@/lib/billing/founder";
import { FOUNDER_PRICE_HT, ON_DEMAND_TRIAL_DAYS, REFUND_DAYS, daysLeft } from "@/lib/billing/founder";
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
 * Encart de l'espace membre pendant l'offre de lancement, selon la situation : sans entreprise,
 * essai à démarrer, essai en cours (jours restants), essai terminé. Chiffres réels uniquement.
 */
export function LaunchCard({ state, pulse, seatsLeft, endsAt, now }: LaunchCardProps) {
  if (state?.paid) return null;
  const seats = seatsLeft > 0 ? `Plus que ${seatsLeft} place${seatsLeft > 1 ? "s" : ""} au tarif fondateur` : null;
  const pulseLine =
    pulse && pulse.france > 0 ? (
      <p className="mt-2 flex items-start gap-2 text-sm text-slate-700">
        <TrendingUp className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden />
        <span>
          Ces 30 derniers jours : <strong>{nf.format(pulse.france)} offres</strong> de votre métier publiées en France
          {pulse.departmentCode ? (
            <>
              , dont <strong>{nf.format(pulse.department)}</strong> dans votre département ({pulse.departmentCode})
            </>
          ) : null}
          .
        </span>
      </p>
    ) : null;

  let title: string;
  let text: React.ReactNode;
  let action: React.ReactNode;
  if (!state) {
    title = `Pro offert : ${ON_DEMAND_TRIAL_DAYS} jours gratuits, sans carte`;
    text = "Créez le profil de votre entreprise (30 secondes) pour activer votre essai : alertes illimitées, besoins des entreprises en avant-première, recherches sans limite.";
    action = (
      <Link href="/onboarding/entreprise?suite=%2Fdashboard" className={buttonClasses({ className: "shrink-0" })}>
        Activer mon essai
      </Link>
    );
  } else if (state.trialActive) {
    const d = daysLeft(state.trialEndsAt, now);
    title = `Pro est activé : il vous reste ${d} jour${d > 1 ? "s" : ""} d'essai`;
    text = `Profitez-en : alertes sur tous vos métiers et toutes vos zones, besoins des entreprises 48 h avant les autres, recherches illimitées. Gardez Pro à ${formatEuros(FOUNDER_PRICE_HT)} HT/mois, à vie.`;
    action = (
      <Link href="/offre-fondateur" className={buttonClasses({ className: "shrink-0" })}>
        Garder Pro
      </Link>
    );
  } else if (!state.trialUsed) {
    title = `Essayez Pro gratuitement pendant ${ON_DEMAND_TRIAL_DAYS} jours`;
    text = "Sans carte bancaire, sans engagement, aucun prélèvement à la fin : alertes illimitées, besoins en avant-première, recherches sans limite.";
    action = (
      <div className="w-full shrink-0 sm:w-72">
        <StartTrialForm suite="/dashboard" label="Activer mon essai Pro" />
      </div>
    );
  } else {
    title = `Votre essai Pro est terminé : gardez-le à ${formatEuros(FOUNDER_PRICE_HT)} HT/mois, à vie`;
    text = `Votre compte est repassé à l'offre Gratuite (1 alerte, recherches limitées, besoins 48 h après les membres Pro). Sans engagement, satisfait ou remboursé ${REFUND_DAYS} jours.`;
    action = (
      <Link href="/offre-fondateur" className={buttonClasses({ className: "shrink-0" })}>
        Réactiver Pro
      </Link>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-white p-4 sm:p-5" data-testid="launch-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            {state?.trialActive ? <Clock className="size-5" aria-hidden /> : <Sparkles className="size-5" aria-hidden />}
          </span>
          <div>
            <p className="font-bold text-navy">{title}</p>
            <p className="mt-0.5 text-sm text-slate-600">{text}</p>
            {pulseLine}
            {(seats || endsAt) && (
              <p className="mt-2 text-xs font-semibold text-amber-800">
                {[seats, endsAt ? `offre de lancement jusqu'au ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(new Date(endsAt))}` : null].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        {action}
      </div>
    </div>
  );
}

