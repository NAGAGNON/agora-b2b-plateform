"use client";

import { useActionState, useState, type ComponentProps } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { requestPasswordReset, resendConfirmation, signIn, signUp, updatePassword } from "@/app/actions/auth";
import { Checkbox, Field, FieldError, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { LegalNote } from "@/components/legal-note";

export function SignInForm({ next, referral }: { next?: string; referral?: string }) {
  const [state, action] = useActionState(signIn, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="suite" value={next ?? ""} />
      {referral && <input type="hidden" name="ref" value={referral} />}
      <Field label="Adresse e-mail professionnelle" name="email" error={fe?.email} required>
        {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" />}
      </Field>
      <Field label="Mot de passe" name="password" error={fe?.password} required>
        {(p) => <PasswordInput {...p} autoComplete="current-password" />}
      </Field>
      <div className="text-right">
        <Link href="/mot-de-passe-oublie" className="text-sm font-semibold text-teal-700 hover:underline">
          Mot de passe oublié ?
        </Link>
      </div>
      {state && !state.ok && !fe && <Notice tone="error">{state.error}</Notice>}
      {state && !state.ok && /pas encore confirmée/.test(state.error) && <ResendConfirmation />}
      <SubmitButton full size="lg" pendingLabel="Connexion…">
        Se connecter
      </SubmitButton>
      <LegalNote />
    </form>
  );
}

/** Mot de passe avec bouton « Afficher » (moins d'erreurs de saisie, surtout sur mobile). */
function PasswordInput(props: ComponentProps<"input">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={shown ? "text" : "password"} className="pr-12" />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 hover:text-navy"
        aria-label={shown ? "Masquer la saisie" : "Afficher la saisie"}
        aria-pressed={shown}
      >
        {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

/** Nouveau lien d'activation (e-mail perdu, lien expiré, courrier indésirable). */
export function ResendConfirmation({ email = "" }: { email?: string }) {
  const [state, action] = useActionState(resendConfirmation, null);
  if (state?.ok) return <Notice tone="success">{state.message}</Notice>;
  return (
    <form action={action} className="rounded-xl border border-slate-200 bg-canvas p-4" noValidate>
      <p className="text-sm font-semibold text-navy">E-mail d&apos;activation non reçu ?</p>
      <p className="mt-1 text-sm text-slate-600">Vérifiez vos courriers indésirables, ou recevez un nouveau lien.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input name="email" type="email" defaultValue={email} aria-label="Adresse e-mail" autoComplete="email" required className="sm:flex-1" />
        <SubmitButton variant="outline" pendingLabel="Envoi…">
          Renvoyer le lien
        </SubmitButton>
      </div>
      {state && !state.ok && <p className="mt-2 text-sm text-red-700">{state.error}</p>}
    </form>
  );
}

/** Règles du mot de passe vérifiées pendant la saisie (moins d'échecs à l'envoi). */
function PasswordRules({ value }: { value: string }) {
  const rules = [
    { ok: value.length >= 10, label: "10 caractères" },
    { ok: /[A-Z]/.test(value), label: "une majuscule" },
    { ok: /[a-z]/.test(value), label: "une minuscule" },
    { ok: /[0-9]/.test(value), label: "un chiffre" },
  ];
  return (
    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-live="polite">
      {rules.map((r) => (
        <li key={r.label} className={`flex items-center gap-1 ${r.ok ? "font-semibold text-teal-700" : "text-slate-500"}`}>
          <Check className={`size-3.5 ${r.ok ? "" : "opacity-30"}`} aria-hidden />
          {r.label}
          <span className="sr-only">{r.ok ? " : respecté" : " : à compléter"}</span>
        </li>
      ))}
    </ul>
  );
}

type SignUpValues = { fullName: string; email: string; password: string; terms: boolean; marketing: boolean };

export function SignUpForm({ referral, next, defaultEmail }: { referral?: string; next?: string; defaultEmail?: string }) {
  // Saisie conservée si l'inscription est refusée (sinon le formulaire est vidé après l'envoi)
  const [values, setValues] = useState<SignUpValues>({ fullName: "", email: defaultEmail ?? "", password: "", terms: false, marketing: false });
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof signUp>> | null, fd: FormData) => {
    const submitted = {
      fullName: String(fd.get("fullName") ?? ""),
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
      terms: fd.get("terms") === "on",
      marketing: fd.get("marketing") === "on",
    };
    const result = await signUp(prev, fd);
    setValues(!result.ok && result.fieldErrors?.password ? { ...submitted, password: "" } : submitted);
    return result;
  }, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  const [password, setPassword] = useState(values.password);
  if (state?.ok)
    return (
      <div className="space-y-4">
        <Notice tone="success" title="Vérifiez votre boîte mail">
          {state.message}
        </Notice>
        <ResendConfirmation email={values.email} />
      </div>
    );
  return (
    <form action={action} className="space-y-5" noValidate>
      {referral && <input type="hidden" name="ref" value={referral} />}
      {next && <input type="hidden" name="suite" value={next} />}
      <Field label="Nom et prénom" name="fullName" error={fe?.fullName} required>
        {(p) => <Input {...p} autoComplete="name" maxLength={120} defaultValue={values.fullName} />}
      </Field>
      <Field label="Adresse e-mail professionnelle" name="email" error={fe?.email} required>
        {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" defaultValue={values.email} />}
      </Field>
      <div>
        <Field label="Mot de passe" name="password" error={fe?.password} required>
          {(p) => <PasswordInput {...p} autoComplete="new-password" minLength={10} defaultValue={values.password} onChange={(e) => setPassword(e.currentTarget.value)} />}
        </Field>
        <PasswordRules value={password} />
      </div>
      <div>
        <Checkbox
          name="terms"
          defaultChecked={values.terms}
          label={
            <>
              J&apos;ai lu et j&apos;accepte les{" "}
              <Link href="/cgu" target="_blank" className="font-semibold text-teal-700 underline">
                Conditions Générales d&apos;Utilisation
              </Link>{" "}
              et j&apos;ai pris connaissance de la{" "}
              <Link href="/confidentialite" target="_blank" className="font-semibold text-teal-700 underline">
                Politique de confidentialité
              </Link>
              .
            </>
          }
          aria-invalid={Boolean(fe?.terms)}
        />
        <FieldError message={fe?.terms} />
      </div>
      <Checkbox
        name="marketing"
        defaultChecked={values.marketing}
        label="J'accepte de recevoir la veille LinkProB2B par e-mail, deux fois par semaine (facultatif)."
      />
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
