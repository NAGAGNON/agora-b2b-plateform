"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { MessageSquareText, Send } from "lucide-react";
import { contactCompany } from "@/app/actions/messages";
import type { ActionResult } from "@/lib/validation";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";

/**
 * « Envoyer un message » à une entreprise de l'annuaire. La fenêtre ne s'ouvre qu'au clic (ou quand
 * on arrive depuis le bouton d'une carte de l'annuaire). Le message part dans la messagerie du site
 * et l'entreprise est prévenue ; la suite de l'échange se fait dans « Messages ».
 */
export function MessageCompanyButton({
  companyId,
  companyName,
  slug,
  signedIn,
  hasCompany,
  conversationId,
  autoOpen = false,
  className,
}: {
  companyId: string;
  companyName: string;
  slug: string;
  signedIn: boolean;
  hasCompany: boolean;
  conversationId?: string | null;
  autoOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(autoOpen && signedIn && !conversationId);
  const [draft, setDraft] = useState("");
  const [state, action] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    setDraft(String(fd.get("body") ?? ""));
    return contactCompany(prev, fd);
  }, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  const style = cn(
    "btn-shine inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 px-5 text-sm font-bold text-white shadow-lg transition duration-300 hover:-translate-y-px hover:shadow-xl active:scale-95",
    className,
  );

  if (!signedIn) {
    return (
      <Link href={`/inscription?suite=${encodeURIComponent(`/entreprises/${slug}?message=1`)}`} className={style} data-testid="message-company">
        <MessageSquareText className="size-4" aria-hidden /> Envoyer un message
      </Link>
    );
  }
  if (conversationId) {
    return (
      <Link href={`/dashboard/messages/${conversationId}`} className={style} data-testid="message-company">
        <MessageSquareText className="size-4" aria-hidden /> Reprendre la conversation
      </Link>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={style} data-testid="message-company">
        <MessageSquareText className="size-4" aria-hidden /> Envoyer un message
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Écrire à ${companyName}`} description="Votre message arrive dans sa messagerie LinkProB2B et l'entreprise est prévenue par e-mail.">
        {!hasCompany ? (
          <div className="space-y-4">
            <Notice tone="info">Pour écrire aux autres entreprises, créez d&apos;abord le profil de votre entreprise : c&apos;est lui qui apparaît comme expéditeur.</Notice>
            <Link href="/dashboard/entreprise" className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-navy px-5 text-sm font-bold text-white">
              Créer le profil de mon entreprise
            </Link>
          </div>
        ) : (
          <form action={action} className="space-y-3" data-testid="message-company-form">
            <input type="hidden" name="targetCompanyId" value={companyId} />
            {state && !state.ok && !fe?.body && <Notice tone="error">{state.error}</Notice>}
            <label htmlFor="company-message" className="text-sm font-semibold text-navy">
              Votre message
            </label>
            <Textarea
              id="company-message"
              name="body"
              rows={6}
              maxLength={5000}
              defaultValue={draft}
              aria-invalid={Boolean(fe?.body)}
              placeholder="Bonjour, nous sommes… Nous aimerions échanger avec vous au sujet de… (besoin, partenariat, sous-traitance, devis)."
            />
            {fe?.body && <p className="text-sm text-rose-700">{fe.body}</p>}
            <SubmitButton pendingLabel="Envoi…" className="w-full">
              <Send className="size-4" aria-hidden /> Envoyer mon message
            </SubmitButton>
            <p className="text-xs text-slate-500">La suite de l&apos;échange se fait dans votre messagerie (menu « Messages »).</p>
          </form>
        )}
      </Modal>
    </>
  );
}
