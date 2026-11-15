"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { startApplicationGuide } from "@/app/actions/applications";
import { useToast } from "@/components/ui/toast";

/**
 * Fiche d'un appel d'offres : « Ça m'intéresse » ouvre la candidature sur LinkProB2B (conditions,
 * pièces, notation, conseils, étapes à cocher, lien vers l'annonce officielle et retour à la recherche).
 */
export function GuideButton({ opportunityId, started, signedIn = true, hasCompany = true }: { opportunityId: string; started: boolean; signedIn?: boolean; hasCompany?: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const target = `/dashboard/candidatures/${opportunityId}`;
  const cls =
    "btn-shine inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal to-electric px-4 py-3.5 font-semibold text-navy shadow-lg shadow-teal/25 transition hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50";
  const label = (
    <>
      <Trophy className="size-5" aria-hidden /> {started ? "Continuer ma candidature" : "Ça m'intéresse : préparer ma candidature"}
    </>
  );
  if (!signedIn)
    return (
      <Link href={`/inscription?suite=${encodeURIComponent(`/opportunites/${opportunityId}`)}`} className={cls}>
        {label}
      </Link>
    );
  if (!hasCompany)
    return (
      <Link href="/onboarding/entreprise" className={cls}>
        {label}
      </Link>
    );
  if (started)
    return (
      <Link href={target} className={cls}>
        {label}
      </Link>
    );
  return (
    <button
      type="button"
      disabled={pending}
      className={cls}
      onClick={() =>
        start(async () => {
          const r = await startApplicationGuide(opportunityId);
          if (r.ok) router.push(target);
          else toast(r.error, "error");
        })
      }
    >
      {label}
    </button>
  );
}
