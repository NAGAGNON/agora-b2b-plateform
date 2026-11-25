"use client";

import { useActionState, useState } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { sendContactMessage } from "@/app/actions/public";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";

/**
 * « Une question ? Contacter l'équipe » : un petit bouton, une fenêtre qui ne s'ouvre qu'au clic,
 * un seul champ (le message) pour un membre connecté. Le message arrive par e-mail à l'équipe.
 */
export function ContactTeam({ name, email, company, context, className }: { name?: string | null; email?: string | null; company?: string | null; context?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const page = usePathname();
  const known = Boolean(name && email);
  const [state, action] = useActionState(sendContactMessage, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="contact-team"
        className={cn(
          "group inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-navy shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-teal/50",
          className,
        )}
      >
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-teal" />
        </span>
        Une question ? Contacter l&apos;équipe
        <MessageCircle className="size-4 text-teal-700 transition group-hover:rotate-[-8deg]" aria-hidden />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Contacter l'équipe LinkProB2B" description="Écrivez-nous simplement : nous répondons généralement en quelques minutes, par e-mail.">
        {state?.ok ? (
          <div className="py-4 text-center" data-testid="contact-team-sent">
            <CheckCircle2 className="mx-auto size-10 animate-pop text-teal-700" aria-hidden />
            <p className="mt-3 font-semibold text-navy">Message envoyé</p>
            <p className="mt-1 text-sm text-slate-600">{state.message}</p>
          </div>
        ) : (
          <form action={action} className="space-y-4" noValidate>
            {state && !state.ok && !fe && <Notice tone="error">{state.error}</Notice>}
            {known ? (
              <>
                <input type="hidden" name="name" value={name!} />
                <input type="hidden" name="email" value={email!} />
                {company && <input type="hidden" name="company" value={company} />}
                <p className="text-xs text-slate-500">
                  Réponse envoyée à <strong className="text-navy">{email}</strong>
                </p>
              </>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nom" name="name" error={fe?.name} required>
                  {(p) => <Input {...p} autoComplete="name" />}
                </Field>
                <Field label="E-mail" name="email" error={fe?.email} required>
                  {(p) => <Input {...p} type="email" autoComplete="email" />}
                </Field>
              </div>
            )}
            <input type="hidden" name="subject" value={context ? `Question : ${context}`.slice(0, 200) : "Question depuis le site"} />
            <input type="hidden" name="page" value={page ?? ""} />
            <Field label="Votre message" name="message" error={fe?.message} required>
              {(p) => <Textarea {...p} rows={5} maxLength={5000} placeholder="Votre question, en quelques mots…" autoFocus />}
            </Field>
            <div className="hidden" aria-hidden>
              <label>
                Ne pas remplir <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <SubmitButton full>Envoyer mon message</SubmitButton>
          </form>
        )}
      </Modal>
    </>
  );
}
