"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { confirmBoardDecisionFromEmail } from "@/app/actions/board";
import type { ActionResult } from "@/lib/validation";

/** Confirmation d'une réponse au comité depuis le lien de l'e-mail (avec commentaire facultatif). */
export function EmailDecisionForm({ token, label }: { token: string; label: string }) {
  const [state, dispatch] = useActionState<ActionResult | null, FormData>(confirmBoardDecisionFromEmail, null);
  if (state?.ok)
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-teal-50 p-5 ring-1 ring-teal-200">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-teal-700" aria-hidden />
        <div>
          <p className="font-semibold text-navy">{state.message}</p>
          <p className="mt-1 text-sm text-slate-600">Le comité en tiendra compte à sa prochaine réunion. Vous pouvez fermer cette page.</p>
        </div>
      </div>
    );
  return (
    <form action={dispatch} className="space-y-4">
      <input type="hidden" name="t" value={token} />
      <label className="block">
        <span className="text-sm font-medium text-navy">Votre commentaire (facultatif)</span>
        <textarea name="comment" rows={3} maxLength={2000} placeholder="Ex. : d'accord, mais commencez petit." className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:ring-2 focus:ring-teal/30 focus:outline-none" />
      </label>
      {state && !state.ok && <Notice tone="error">{state.error}</Notice>}
      <SubmitButton className="w-full sm:w-auto" pendingLabel="Enregistrement…">
        Confirmer : {label}
      </SubmitButton>
    </form>
  );
}
