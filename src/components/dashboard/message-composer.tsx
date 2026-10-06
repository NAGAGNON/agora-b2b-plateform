"use client";

import { useActionState, useEffect, useRef } from "react";
import { Paperclip, Send } from "lucide-react";
import { sendMessage } from "@/app/actions/messages";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { ALLOWED_DOCUMENT_TYPES } from "@/lib/constants";

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const [state, action] = useActionState(sendMessage, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2 border-t border-slate-200 bg-white p-4">
      <input type="hidden" name="conversationId" value={conversationId} />
      <label htmlFor="body" className="sr-only">
        Votre message
      </label>
      <textarea
        id="body"
        name="body"
        rows={3}
        required
        maxLength={5000}
        placeholder="Écrire un message…"
        className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-[15px] focus:border-teal focus:ring-2 focus:ring-teal/30 focus:outline-none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ref.current?.requestSubmit();
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-slate-600 hover:text-navy">
          <Paperclip className="size-4" aria-hidden />
          <span>Pièce jointe</span>
          <input type="file" name="attachment" accept={Object.keys(ALLOWED_DOCUMENT_TYPES).join(",")} className="max-w-48 text-xs" />
        </label>
        <SubmitButton size="sm" pendingLabel="Envoi…">
          <Send className="size-4" aria-hidden /> Envoyer
        </SubmitButton>
      </div>
      {state && !state.ok && <Notice tone="error">{state.error}</Notice>}
    </form>
  );
}
