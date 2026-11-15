import Link from "next/link";
import { Sparkles } from "lucide-react";

/**
 * Fiche d'un appel d'offres : « En savoir plus » ouvre la fiche de candidature en simple consultation
 * (rien n'est enregistré). L'offre n'entre dans « Mes candidatures » que si la personne le choisit.
 */
export function GuideButton({ opportunityId, started, signedIn = true, hasCompany = true }: { opportunityId: string; started: boolean; signedIn?: boolean; hasCompany?: boolean }) {
  const href = !signedIn
    ? `/inscription?suite=${encodeURIComponent(`/opportunites/${opportunityId}`)}`
    : !hasCompany
      ? "/onboarding/entreprise"
      : `/dashboard/candidatures/${opportunityId}`;
  return (
    <Link
      href={href}
      className="btn-shine inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal to-electric px-4 py-3.5 font-semibold text-navy shadow-lg shadow-teal/25 transition hover:-translate-y-0.5 active:scale-[0.98]"
    >
      <Sparkles className="size-5" aria-hidden /> {started ? "Reprendre où j'en étais" : "En savoir plus"}
    </Link>
  );
}
