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
  if (open && company && state && !state.trialUsed && !state.paid) action = <StartTrialForm suite={suite} label={`Essayer Pro ${ON_DEMAND_TRIAL_DAYS} jours gratuits`} hint={false} />;
  else if (open && !company)
    action = (
      <Link href={`/onboarding/entreprise?suite=${encodeURIComponent(suite)}`} className={buttonClasses({ full: true, size: "lg" })}>
        Essayer Pro gratuitement
      </Link>
    );
  else if (open && left > 0)
    action = (
      <Link href="/offre-fondateur" className={buttonClasses({ full: true, size: "lg" })}>
        Pro à {formatEuros(FOUNDER_PRICE_HT)}/mois à vie
      </Link>
    );
  else
    action = (
      <Link href="/tarifs" className={buttonClasses({ full: true, size: "lg" })}>
        Voir l&apos;offre Pro
      </Link>
    );
  return (
    <section className="relative mx-auto max-w-lg overflow-hidden rounded-3xl bg-navy text-center text-white shadow-[0_30px_70px_-25px_rgb(20_194_173/0.55)] ring-1 ring-white/10" data-testid={testId}>
      <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 size-72 -translate-x-1/2 animate-aurora rounded-full bg-teal/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-10 size-64 animate-aurora rounded-full bg-violet/30 blur-3xl [animation-delay:-8s]" />
      <div className="relative p-7 sm:p-9">
        <span className="inline-flex size-12 animate-float items-center justify-center rounded-2xl bg-gradient-to-br from-teal/40 to-violet/40 text-white ring-1 ring-white/15">
          <Lock className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 text-xl font-bold sm:text-2xl">{title}</h2>
        <div className="mt-2 text-white/80">{reason}</div>
        <div className="mx-auto mt-6 max-w-xs rounded-xl bg-white p-3 text-navy">{action}</div>
        {open && left > 0 && (
          <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-300">
            <Sparkles className="size-4" aria-hidden /> Tarif fondateur : {left} place{left > 1 ? "s" : ""} restante{left > 1 ? "s" : ""}
          </p>
        )}
      </div>
    </section>
  );
}
