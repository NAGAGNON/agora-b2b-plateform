"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { startApplicationGuide } from "@/app/actions/applications";
import { useToast } from "@/components/ui/toast";

/** Fiche d'un appel d'offres : ouvrir le guide de réponse (crée ou fait avancer la candidature). */
export function GuideButton({ opportunityId, started }: { opportunityId: string; started: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const cls =
    "btn-shine inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-navy to-navy-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-navy/20 transition hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50";
  if (started)
    return (
      <Link href="/dashboard/candidatures" className={cls}>
        <Trophy className="size-4" aria-hidden /> Continuer le guide pour gagner
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
          if (r.ok) router.push("/dashboard/candidatures");
          else toast(r.error, "error");
        })
      }
    >
      <Trophy className="size-4" aria-hidden /> Me guider pour le gagner
    </button>
  );
}
