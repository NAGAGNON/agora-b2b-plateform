import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";
import type { Session } from "@/lib/auth";
import { companyOfferState, founderOffer, founderOpen, founderSeatsTaken, seatsLeft, FOUNDER_PRICE_HT, ON_DEMAND_TRIAL_DAYS } from "@/lib/billing/founder";
import { formatEuros } from "@/lib/billing/plans";
import { buttonClasses } from "@/components/ui/button";
import { StartTrialForm } from "@/components/dashboard/billing-forms";

/**
 * Encart de passage à Pro, adapté à la situation du membre : essai gratuit s'il ne l'a pas encore
 * utilisé, sinon tarif fondateur (places restantes réelles) pendant l'offre, sinon page Tarifs.
 */
export async function UpgradeGate({ session, title, reason, suite, testId }: { session: Session | null; title: string; reason: React.ReactNode; suite: string; testId?: string }) {
  const offer = await founderOffer();
  const open = founderOpen(offer);
  const company = session?.activeCompany ?? null;
  const state = company ? await companyOfferState(company.company.id) : null;
  const left = open ? seatsLeft(offer, await founderSeatsTaken()) : 0;
  let action: React.ReactNode;
  if (open && company && state && !state.trialUsed && !state.paid) action = <StartTrialForm suite={suite} label={`Débloquer : essai Pro gratuit ${ON_DEMAND_TRIAL_DAYS} jours`} />;
  else if (open && !company)
    action = (
      <Link href={`/onboarding/entreprise?suite=${encodeURIComponent(suite)}`} className={buttonClasses({ full: true, size: "lg" })}>
        Créer mon profil et essayer Pro gratuitement
      </Link>
    );
  else if (open && left > 0)
    action = (
      <Link href="/offre-fondateur" className={buttonClasses({ full: true, size: "lg" })}>
        Passer à Pro pour {formatEuros(FOUNDER_PRICE_HT)} HT/mois, à vie
      </Link>
    );
  else
    action = (
      <Link href="/tarifs" className={buttonClasses({ full: true, size: "lg" })}>
        Voir l&apos;offre Pro
      </Link>
    );
  return (
    <section className="mx-auto max-w-xl rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-amber-50 to-white p-6 text-center shadow-sm sm:p-8" data-testid={testId}>
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <Lock className="size-6" aria-hidden />
      </span>
      <h2 className="mt-4 text-xl font-bold text-navy sm:text-2xl">{title}</h2>
      <div className="mt-2 text-slate-700">{reason}</div>
      <div className="mx-auto mt-6 max-w-sm">{action}</div>
      {open && left > 0 && (
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-800">
          <Sparkles className="size-4" aria-hidden /> Tarif fondateur : plus que {left} place{left > 1 ? "s" : ""}
        </p>
      )}
    </section>
  );
}
