"use client";

import { useActionState, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { disableTotp, enrollTotp, verifyTotp } from "@/app/actions/mfa";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";

export function MfaManager({ verifiedFactorId }: { verifiedFactorId: string | null }) {
  const [enroll, setEnroll] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [state, action] = useActionState(verifyTotp, null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();
  if (verifiedFactorId && !enroll) {
    return (
      <div className="space-y-3">
        <Notice tone="success">
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4" aria-hidden /> Double authentification active.
          </span>
        </Notice>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            confirm("Désactiver la double authentification ?") &&
            start(async () => {
              const r = await disableTotp(verifiedFactorId);
              toast(r.ok ? (r.message ?? "OK") : r.error, r.ok ? "success" : "error");
              router.refresh();
            })
          }
        >
          Désactiver
        </Button>
      </div>
    );
  }
  if (state?.ok) return <Notice tone="success">{state.message}</Notice>;
  return (
    <div className="space-y-4">
      {!enroll ? (
        <>
          <p className="text-sm text-slate-600">Protégez votre compte avec un code à usage unique généré par une application d&apos;authentification (TOTP).</p>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await enrollTotp();
                if (r.ok && r.data) setEnroll(r.data);
                else setError(r.ok ? "Erreur" : r.error);
              })
            }
          >
            Activer la double authentification
          </Button>
          {error && <Notice tone="error">{error}</Notice>}
        </>
      ) : (
        <form action={action} className="space-y-4">
          <p className="text-sm text-slate-600">Scannez ce QR code avec votre application d&apos;authentification, puis saisissez le code affiché.</p>
          <Image src={enroll.qr} alt="QR code d'activation" width={180} height={180} unoptimized className="rounded-lg border border-slate-200 bg-white p-2" />
          <p className="text-xs break-all text-slate-500">
            Clé manuelle : <code>{enroll.secret}</code>
          </p>
          <input type="hidden" name="factorId" value={enroll.factorId} />
          <Field label="Code à 6 chiffres" name="code" required>
            {(p) => <Input {...p} inputMode="numeric" autoComplete="one-time-code" maxLength={6} />}
          </Field>
          {state && !state.ok && <Notice tone="error">{state.error}</Notice>}
          <SubmitButton>Vérifier et activer</SubmitButton>
        </form>
      )}
    </div>
  );
}

export function MfaChallengeForm({ factorId, next }: { factorId: string; next: string }) {
  const [state, action] = useActionState(verifyTotp, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="factorId" value={factorId} />
      <input type="hidden" name="suite" value={next} />
      <Field label="Code de votre application d'authentification" name="code" required>
        {(p) => <Input {...p} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus />}
      </Field>
      {state && !state.ok && <Notice tone="error">{state.error}</Notice>}
      <SubmitButton full size="lg">
        Vérifier
      </SubmitButton>
    </form>
  );
}
