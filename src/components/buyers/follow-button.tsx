"use client";

import { useActionState } from "react";
import { BellRing, CheckCircle2 } from "lucide-react";
import { followBuyerAction } from "@/app/actions/buyers";
import { SubmitButton } from "@/components/ui/submit-button";

/** Bouton « Suivre cet acheteur » (membre connecté) : alerte sur ses nouveaux appels d'offres. */
export function FollowBuyerButton({ slug, following }: { slug: string; following: boolean }) {
  const [state, action] = useActionState(followBuyerAction, null);
  if (following || state?.ok)
    return (
      <p className="inline-flex items-center gap-2 rounded-lg bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-800 ring-1 ring-teal/30" data-testid="buyer-followed">
        <CheckCircle2 className="size-4" aria-hidden /> Vous suivez cet acheteur
      </p>
    );
  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <SubmitButton pendingLabel="Activation…">
        <BellRing className="size-4" aria-hidden /> Suivre cet acheteur
      </SubmitButton>
      {state && !state.ok && <p className="mt-1 text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
