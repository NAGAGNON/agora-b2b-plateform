"use client";

import { useState, useTransition } from "react";
import { BellOff, BellRing } from "lucide-react";
import { setConversationEmails } from "@/app/actions/messages";

/** Couper ou rétablir les e-mails d'une seule conversation (les messages restent visibles sur le site). */
export function ConversationEmailToggle({ conversationId, initialMuted }: { conversationId: string; initialMuted: boolean }) {
  const [muted, setMuted] = useState(initialMuted);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        data-testid="conversation-email-toggle"
        aria-pressed={muted}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await setConversationEmails(conversationId, !muted);
            if (r.ok) setMuted(!muted);
            else setError(r.error);
          })
        }
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:text-navy hover:ring-teal disabled:opacity-60"
      >
        {muted ? <BellOff className="size-3.5" aria-hidden /> : <BellRing className="size-3.5" aria-hidden />}
        {muted ? "E-mails coupés pour cette conversation" : "Recevoir un e-mail à chaque message"}
      </button>
      {error && <span className="mt-1 text-xs text-rose-700">{error}</span>}
    </span>
  );
}
