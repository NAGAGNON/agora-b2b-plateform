"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, signIn, signUp, updatePassword } from "@/app/actions/auth";
import { Checkbox, Field, FieldError, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="suite" value={next ?? ""} />
      <Field label="Adresse e-mail professionnelle" name="email" error={fe?.email} required>
        {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" />}
      </Field>
      <Field label="Mot de passe" name="password" error={fe?.password} required>
        {(p) => <Input {...p} type="password" autoComplete="current-password" />}
      </Field>
      <div className="text-right">
        <Link href="/mot-de-passe-oublie" className="text-sm font-semibold text-teal-700 hover:underline">
          Mot de passe oublié ?
        </Link>
      </div>
      {state && !state.ok && !fe && <Notice tone="error">{state.error}</Notice>}
      <SubmitButton full size="lg" pendingLabel="Connexion…">
        Se connecter
      </SubmitButton>
    </form>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUp, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  if (state?.ok) return <Notice tone="success" title="Vérifiez votre boîte mail">{state.message}</Notice>;
  return (
    <form action={action} className="space-y-5" noValidate>
      <Field label="Nom et prénom" name="fullName" error={fe?.fullName} required>
        {(p) => <Input {...p} autoComplete="name" maxLength={120} />}
      </Field>
      <Field label="Adresse e-mail professionnelle" name="email" error={fe?.email} required>
        {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" />}
      </Field>
      <Field label="Mot de passe" name="password" error={fe?.password} required hint="10 caractères minimum, avec majuscule, minuscule et chiffre.">
        {(p) => <Input {...p} type="password" autoComplete="new-password" minLength={10} />}
      </Field>
      <div>
        <Checkbox
          name="terms"
          label={
            <>
              J&apos;accepte les{" "}
              <Link href="/cgu" target="_blank" className="font-semibold text-teal-700 underline">
                conditions d&apos;utilisation
              </Link>{" "}
              et j&apos;ai pris connaissance de la{" "}
              <Link href="/confidentialite" target="_blank" className="font-semibold text-teal-700 underline">
                politique de confidentialité
              </Link>
              .
            </>
          }
          aria-invalid={Boolean(fe?.terms)}
        />
        <FieldError message={fe?.terms} />
      </div>
      <Checkbox name="marketing" label="J'accepte de recevoir occasionnellement des informations sur le pilote LinkProB2B (facultatif)." />
      {state && !state.ok && !fe && <Notice tone="error">{state.error}</Notice>}
      <SubmitButton full size="lg" pendingLabel="Création du compte…">
        Créer mon compte
      </SubmitButton>
    </form>
  );
}

export function ResetRequestForm() {
  const [state, action] = useActionState(requestPasswordReset, null);
  if (state?.ok) return <Notice tone="success">{state.message}</Notice>;
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-5" noValidate>
      <Field label="Adresse e-mail" name="email" error={fe?.email} required>
        {(p) => <Input {...p} type="email" autoComplete="email" />}
      </Field>
      {state && !state.ok && !fe && <Notice tone="error">{state.error}</Notice>}
      <SubmitButton full size="lg">
        Recevoir le lien de réinitialisation
      </SubmitButton>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action] = useActionState(updatePassword, null);
  if (state?.ok)
    return (
      <Notice tone="success" title={state.message}>
        <Link href="/dashboard" className="font-semibold underline">
          Accéder à mon espace
        </Link>
      </Notice>
    );
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-5" noValidate>
      <Field label="Nouveau mot de passe" name="password" error={fe?.password} required hint="10 caractères minimum, avec majuscule, minuscule et chiffre.">
        {(p) => <Input {...p} type="password" autoComplete="new-password" />}
      </Field>
      <Field label="Confirmer le mot de passe" name="confirm" error={fe?.confirm} required>
        {(p) => <Input {...p} type="password" autoComplete="new-password" />}
      </Field>
      {state && !state.ok && !fe && <Notice tone="error">{state.error}</Notice>}
      <SubmitButton full size="lg">
        Enregistrer
      </SubmitButton>
    </form>
  );
}
