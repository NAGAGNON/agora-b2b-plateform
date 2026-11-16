"use client";

import { Check, HelpCircle, X } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { decideBoardDecision, convokeBoard } from "@/app/actions/board";

/** Réponse du fondateur à une décision : commentaire facultatif + valider / refuser / plus d'infos. */
export function DecisionActions({ id }: { id: string }) {
  return (
    <ActionForm action={decideBoardDecision} hidden={{ id }} className="space-y-3">
      <textarea
        name="comment"
        rows={2}
        maxLength={2000}
        placeholder="Votre commentaire pour le comité (facultatif)"
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal focus:ring-2 focus:ring-teal/30 focus:outline-none"
      />
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        <SubmitButton name="verdict" value="VALIDEE" variant="primary" size="sm" pendingLabel="…">
          <Check className="size-4" aria-hidden /> Valider
        </SubmitButton>
        <SubmitButton name="verdict" value="REFUSEE" variant="outline" size="sm" pendingLabel="…">
          <X className="size-4" aria-hidden /> Refuser
        </SubmitButton>
        <SubmitButton name="verdict" value="PLUS_INFO" variant="ghost" size="sm" pendingLabel="…">
          <HelpCircle className="size-4" aria-hidden /> Plus d&apos;infos
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Convoquer le comité maintenant, sur un sujet donné. */
export function ConvokeForm() {
  return (
    <ActionForm action={convokeBoard} hidden={{}} className="flex flex-col gap-2 sm:flex-row">
      <input
        name="reason"
        required
        minLength={5}
        maxLength={500}
        placeholder="Sujet : ex. « Pourquoi si peu de retours cette semaine ? »"
        className="h-11 min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/50 focus:border-teal focus:outline-none"
      />
      <SubmitButton variant="primary" pendingLabel="Réunion en cours (1 à 2 min)…">
        Réunir le comité
      </SubmitButton>
    </ActionForm>
  );
}
