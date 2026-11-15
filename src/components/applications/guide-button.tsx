"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { startDiscovery } from "@/app/actions/applications";
import { useToast } from "@/components/ui/toast";

/**
 * Fiche d'un appel d'offres : « En savoir plus » ouvre la fiche de candidature sur LinkProB2B en mode
 * découverte (conditions, pièces, notation, conseils, lien vers l'annonce officielle, retour à la
 * recherche) ; la personne décide ensuite si elle prépare sa candidature.
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
      <Sparkles className="size-5" aria-hidden /> {started ? "Reprendre où j'en étais" : "En savoir plus"}
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
          const r = await startDiscovery(opportunityId);
          if (r.ok) router.push(target);
          else toast(r.error, "error");
        })
      }
    >
      {label}
    </button>
  );
}
