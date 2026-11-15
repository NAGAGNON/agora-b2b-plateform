"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, Search } from "lucide-react";
import { goBackToSearch } from "@/components/applications/return-point";

/** Candidature : continuer ses recherches (retour exact), annonce officielle, liste des candidatures. */
export function CandidatureNav({ opportunityId, hasSource, dark = false }: { opportunityId: string; hasSource: boolean; dark?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => goBackToSearch()}
        className={`btn-shine inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-md transition hover:-translate-y-0.5 active:scale-[0.98] ${dark ? "bg-gradient-to-r from-teal to-electric text-navy" : "bg-navy text-white hover:bg-navy/90"}`}
        data-testid="continue-search"
      >
        <Search className="size-4" aria-hidden /> Continuer mes recherches
      </button>
      {hasSource && (
        <a
          href={`/go/${opportunityId}`}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-navy ring-1 ring-slate-300 transition hover:-translate-y-0.5 hover:ring-teal"
        >
          <ExternalLink className="size-4" aria-hidden /> Voir l&apos;annonce officielle
        </a>
      )}
      <Link href="/dashboard/candidatures" className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${dark ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-slate-600 hover:bg-slate-100"}`}>
        <ArrowLeft className="size-4" aria-hidden /> Toutes mes candidatures
      </Link>
    </div>
  );
}
