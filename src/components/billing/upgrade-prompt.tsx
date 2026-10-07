import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Notice } from "@/components/ui/notice";
import type { ActionResult } from "@/lib/validation";

/**
 * Encart discret affiché quand une limite de l'offre est atteinte (aucune fenêtre
 * surgissante) : explique la limite et propose de comparer les offres.
 */
export function UpgradePrompt({ message, className }: { message: string; className?: string }) {
  return (
    <div role="status" className={`flex gap-3 rounded-xl border border-teal/40 bg-teal-50 p-4 text-sm text-navy ${className ?? ""}`}>
      <Sparkles className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden />
      <div className="min-w-0">
        <p>{message}</p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/dashboard/abonnement" className="font-semibold text-teal-700 underline">
            Découvrir LinkProB2B Pro
          </Link>
          <Link href="/tarifs" className="text-slate-600 underline">
            Comparer les offres
          </Link>
        </p>
      </div>
    </div>
  );
}

/** Erreur d'action : encart de mise à niveau si une limite d'offre est en cause, sinon message d'erreur. */
export function ActionError({ state, className, title }: { state: ActionResult<unknown> | null | undefined; className?: string; title?: string }) {
  if (!state || state.ok) return null;
  if (state.upgrade) return <UpgradePrompt message={state.error} className={className} />;
  return (
    <Notice tone="error" className={className} title={title}>
      {state.error}
    </Notice>
  );
}
