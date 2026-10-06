"use client";

import { useActionState, useRef, useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { sendMessage } from "@/app/actions/messages";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_BYTES } from "@/lib/constants";
import { uploadFiles } from "@/lib/direct-upload";
import type { ActionResult } from "@/lib/validation";

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [state, action] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    if (file) {
      const { uploaded, errors } = await uploadFiles("message", conversationId, [file]);
      if (errors.length) return { ok: false as const, error: errors.join(" ") };
      fd.set("attachmentPath", uploaded[0].path);
      fd.set("attachmentName", uploaded[0].name);
    }
    const r = await sendMessage(prev, fd);
    if (r.ok) {
      ref.current?.reset();
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    }
    return r;
  }, null);
  const fileError = file && (!(file.type in ALLOWED_DOCUMENT_TYPES) || file.size > MAX_DOCUMENT_BYTES) ? "Type de fichier non autorisé ou fichier de plus de 10 Mo." : null;
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
          <input ref={fileRef} type="file" accept={Object.keys(ALLOWED_DOCUMENT_TYPES).join(",")} className="max-w-48 text-xs" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <SubmitButton size="sm" pendingLabel="Envoi…" disabled={Boolean(fileError)}>
          <Send className="size-4" aria-hidden /> Envoyer
        </SubmitButton>
      </div>
      {fileError && <Notice tone="error">{fileError}</Notice>}
      {state && !state.ok && <Notice tone="error">{state.error}</Notice>}
    </form>
  );
}
