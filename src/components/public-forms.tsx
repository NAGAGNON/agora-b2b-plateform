"use client";

import { useActionState } from "react";
import { sendContactMessage, unsubscribeAlert } from "@/app/actions/public";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";

export function ContactForm({ defaultSubject, reference }: { defaultSubject?: string; reference?: string }) {
  const [state, action] = useActionState(sendContactMessage, null);
  if (state?.ok) return <Notice tone="success">{state.message}</Notice>;
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nom" name="name" error={fe?.name} required>
          {(p) => <Input {...p} autoComplete="name" />}
        </Field>
        <Field label="E-mail" name="email" error={fe?.email} required>
          {(p) => <Input {...p} type="email" autoComplete="email" />}
        </Field>
      </div>
      <Field label="Entreprise" name="company" error={fe?.company}>
        {(p) => <Input {...p} autoComplete="organization" />}
      </Field>
      <Field label="Objet" name="subject" error={fe?.subject} required>
        {(p) => (
          <Select {...p} defaultValue={defaultSubject ?? ""}>
            <option value="" disabled>
              Choisir un objet
            </option>
            <option value="Inscrire mon entreprise">Inscrire mon entreprise</option>
            <option value="Question sur la plateforme">Question sur la plateforme</option>
            <option value="Signalement d'un contenu">Signalement d&apos;un contenu</option>
            <option value="Demande de retrait ou de rectification">Demande de retrait ou de rectification</option>
            <option value="Données personnelles (RGPD)">Données personnelles (RGPD)</option>
            <option value="Partenariat / source de données">Partenariat / source de données</option>
            <option value="Vérification de mon entreprise">Vérification de mon entreprise</option>
            <option value="Autre">Autre</option>
          </Select>
        )}
      </Field>
      <Field label="Message" name="message" error={fe?.message} required>
        {(p) => <Textarea {...p} rows={6} maxLength={5000} defaultValue={reference ? `Référence de l'élément concerné : ${reference}\n\n` : undefined} />}
      </Field>
      <div className="hidden" aria-hidden>
        <label>
          Ne pas remplir <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <p className="text-xs text-slate-500">
        Vos coordonnées servent uniquement à répondre à votre message. Voir la politique de confidentialité.
      </p>
      {state && !state.ok && !fe && <Notice tone="error">{state.error}</Notice>}
      <SubmitButton>Envoyer</SubmitButton>
    </form>
  );
}

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, action] = useActionState(unsubscribeAlert, null);
  if (state) return <Notice tone={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</Notice>;
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <SubmitButton>Confirmer le désabonnement</SubmitButton>
    </form>
  );
}
