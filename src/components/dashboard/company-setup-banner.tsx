import Link from "next/link";
import { ArrowRight, Building2, Sparkles } from "lucide-react";
import { CountUp } from "@/components/home/count-up";

/**
 * Bandeau des membres sans fiche entreprise : la fiche (métier, ville) est ce qui fait marcher le
 * site pour eux (offres triées, veille du matin, fiche synthèse, besoins). Chiffre réel uniquement.
 */
export function CompanySetupBanner({ openCount, suite }: { openCount: number; suite?: string }) {
  const href = `/onboarding/entreprise${suite ? `?suite=${encodeURIComponent(suite)}` : ""}`;
  return (
    <section
      aria-label="Créer la fiche de votre entreprise"
      className="relative mb-6 overflow-hidden rounded-2xl bg-navy text-white shadow-[0_24px_60px_-28px_rgb(20_194_173/0.6)] ring-1 ring-white/10"
      data-testid="company-setup-banner"
    >
      <div aria-hidden className="pointer-events-none absolute -top-16 -left-10 size-56 animate-aurora rounded-full bg-teal/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-10 -bottom-20 size-56 animate-aurora rounded-full bg-violet/30 blur-3xl [animation-delay:-7s]" />
      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <span className="inline-flex size-12 shrink-0 animate-float items-center justify-center rounded-2xl bg-gradient-to-br from-teal/50 to-violet/50 ring-1 ring-white/15">
          <Building2 className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold">
            Indiquez votre métier :{" "}
            {openCount > 0 ? (
              <>
                <span className="text-gradient">
                  <CountUp value={openCount} />
                </span>{" "}
                appels d&apos;offres seront triés pour vous
              </>
            ) : (
              "les appels d'offres seront triés pour vous"
            )}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-white/75">
            <Sparkles className="size-4 text-teal-300" aria-hidden /> 30 secondes · veille chaque matin · fiche synthèse de chaque appel d&apos;offres
          </p>
        </div>
        <Link
          href={href}
          className="btn-shine group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal to-cyan-400 px-5 py-3 font-bold text-navy shadow-lg transition hover:-translate-y-px"
        >
          Créer ma fiche entreprise <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
