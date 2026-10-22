"use client";

import { useActionState } from "react";
import { sendVeilleTest, setSuiviEnabled, setVeilleEnabled, testVeilleSmtp } from "@/app/actions/veille-admin";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { adminInput } from "@/components/admin/admin-filter";

const KINDS = [
  ["LAUNCH", "Lancement"],
  ["MONDAY", "Lundi"],
  ["FRIDAY", "Vendredi"],
  ["DAILY", "Alerte quotidienne"],
] as const;

export function VeilleTestForm({ defaultTo, kind, user }: { defaultTo: string; kind: string; user: string }) {
  const [state, action] = useActionState(sendVeilleTest, null);
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-navy">Adresse de contrôle</span>
          <input name="to" type="email" required defaultValue={defaultTo} className={adminInput} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-navy">Édition</span>
          <select name="kind" defaultValue={kind} className={adminInput}>
            {KINDS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <input type="hidden" name="user" value={user} />
        <SubmitButton pendingLabel="Envoi…">Envoyer un e-mail test</SubmitButton>
      </div>
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</Notice>}
    </form>
  );
}

export function VeilleEnableForm({ enabled }: { enabled: boolean }) {
  const [state, action] = useActionState(setVeilleEnabled, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
      <SubmitButton variant={enabled ? "outline" : "primary"} pendingLabel="Enregistrement…">
        {enabled ? "Suspendre les envois automatiques" : "Activer les envois automatiques"}
      </SubmitButton>
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</Notice>}
    </form>
  );
}

export function VeilleSmtpTest() {
  const [state, action] = useActionState(testVeilleSmtp, null);
  return (
    <form action={action} className="space-y-2">
      <SubmitButton variant="outline" size="sm" pendingLabel="Connexion…">
        Tester la connexion au serveur d&apos;envoi
      </SubmitButton>
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</Notice>}
    </form>
  );
}

export function SuiviEnableForm({ enabled }: { enabled: boolean }) {
  const [state, action] = useActionState(setSuiviEnabled, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
      <SubmitButton variant={enabled ? "outline" : "primary"} pendingLabel="Enregistrement…">
        {enabled ? "Suspendre le suivi des inscrits" : "Activer le suivi des inscrits"}
      </SubmitButton>
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</Notice>}
    </form>
  );
}
