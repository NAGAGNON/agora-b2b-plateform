"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { contactNeedOwner } from "@/app/actions/need-contact";
import type { ActionResult } from "@/lib/validation";
import { Checkbox, Field, FieldError, Input, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";

type Values = { name: string; company: string; email: string; phone: string; message: string };
const EMPTY: Values = { name: "", company: "", email: "", phone: "", message: "" };

/**
 * Répondre à un besoin sans créer de compte : coordonnées + message, transmis à l'entreprise qui
 * l'a publié (accord explicite, case non cochée par défaut). La saisie est conservée en cas d'erreur.
 */
export function NeedContactForm({ opportunityId }: { opportunityId: string }) {
  const [values, setValues] = useState<Values>(EMPTY);
  // Nouveau rendu du formulaire à chaque essai : la saisie est remise depuis « values »
  const [attempt, setAttempt] = useState(0);
  const [state, action] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    setAttempt((a) => a + 1);
    setValues({
      name: String(fd.get("name") ?? ""),
      company: String(fd.get("company") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      message: String(fd.get("message") ?? ""),
    });
    return contactNeedOwner(prev, fd);
  }, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  if (state?.ok)
    return (
      <div className="space-y-3" data-testid="need-contact-sent">
        <Notice tone="success" title="Message envoyé">
          {state.message}
        </Notice>
        <p className="text-sm text-slate-600">
          Recevez aussi, gratuitement, les prochains besoins de votre métier par e-mail :{" "}
          <Link href={`/inscription?${new URLSearchParams({ email: values.email })}`} className="font-semibold text-teal-700 underline">
            créer mon compte
          </Link>
          .
        </p>
      </div>
    );

  return (
    <form action={action} className="space-y-4" noValidate key={attempt}>
      <input type="hidden" name="opportunityId" value={opportunityId} />
      {/* Champ piège anti-robot, invisible pour les visiteurs */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Site web
          <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom et prénom" name="name" error={fe?.name} required>
          {(f) => <Input {...f} autoComplete="name" maxLength={120} defaultValue={values.name} />}
        </Field>
        <Field label="Entreprise" name="company" error={fe?.company} required>
          {(f) => <Input {...f} autoComplete="organization" maxLength={160} defaultValue={values.company} />}
        </Field>
        <Field label="Adresse e-mail" name="email" error={fe?.email} required>
          {(f) => <Input {...f} type="email" autoComplete="email" inputMode="email" defaultValue={values.email} />}
        </Field>
        <Field label="Téléphone (facultatif)" name="phone" error={fe?.phone}>
          {(f) => <Input {...f} type="tel" autoComplete="tel" inputMode="tel" maxLength={30} defaultValue={values.phone} />}
        </Field>
      </div>
      <Field label="Votre message" name="message" error={fe?.message} required hint="Présentez votre entreprise, ce que vous proposez pour ce besoin et vos disponibilités.">
        {(f) => <Textarea {...f} rows={5} minLength={10} maxLength={2000} defaultValue={values.message} />}
      </Field>
      <div>
        <Checkbox
          name="consent"
          label="J'accepte que mon nom, mon entreprise, mes coordonnées et mon message soient transmis à l'entreprise qui a publié ce besoin, pour qu'elle me réponde."
          aria-invalid={Boolean(fe?.consent)}
        />
        <FieldError message={fe?.consent} />
      </div>
      {state && !state.ok && !fe && <Notice tone="error">{state.error}</Notice>}
      <SubmitButton full size="lg" pendingLabel="Envoi…">
        Envoyer mon message
      </SubmitButton>
      <p className="text-center text-xs text-slate-500">
        Sans création de compte. Vos coordonnées ne sont transmises qu&apos;à l&apos;entreprise auteure du besoin.{" "}
        <Link href="/confidentialite" className="underline">
          Confidentialité
        </Link>
      </p>
    </form>
  );
}
