"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { upsertSource } from "@/app/actions/admin";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { SOURCE_STATUS_LABELS, type SourceStatus } from "@/lib/constants";

export type SourceValues = {
  id?: string;
  name?: string;
  base_url?: string | null;
  description?: string | null;
  license?: string | null;
  terms_url?: string | null;
  status?: SourceStatus;
  import_method?: string;
  notes?: string | null;
};

export function SourceForm({ v = {}, onDone }: { v?: SourceValues; onDone?: () => void }) {
  const [state, action] = useActionState(upsertSource, null);
  const [status, setStatus] = useState<SourceStatus>(v.status ?? "DRAFT");
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      onDone?.();
      router.refresh();
    }
  }, [state, onDone, router]);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-4">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom" name="name" error={fe?.name} required>
          {(p) => <Input {...p} defaultValue={v.name} />}
        </Field>
        <Field label="Site" name="baseUrl" error={fe?.baseUrl}>
          {(p) => <Input {...p} defaultValue={v.base_url ?? ""} />}
        </Field>
      </div>
      <Field label="Description" name="description">
        {(p) => <Textarea {...p} rows={2} defaultValue={v.description ?? ""} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Licence / conditions de réutilisation" name="license">
          {(p) => <Input {...p} defaultValue={v.license ?? ""} />}
        </Field>
        <Field label="URL des conditions" name="termsUrl" error={fe?.termsUrl}>
          {(p) => <Input {...p} defaultValue={v.terms_url ?? ""} />}
        </Field>
        <Field label="Statut" name="status">
          {(p) => (
            <Select {...p} value={status} onChange={(e) => setStatus(e.target.value as SourceStatus)}>
              {(Object.keys(SOURCE_STATUS_LABELS) as SourceStatus[]).map((s) => (
                <option key={s} value={s}>
                  {SOURCE_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Mode d'intégration" name="importMethod">
          {(p) => (
            <Select {...p} defaultValue={v.import_method ?? "MANUAL"}>
              <option value="MANUAL">Saisie manuelle</option>
              <option value="API">API officielle</option>
              <option value="FEED">Flux autorisé</option>
              <option value="PARTNER">Partenariat</option>
            </Select>
          )}
        </Field>
      </div>
      <Field label="Notes internes (analyse juridique, contacts…)" name="notes">
        {(p) => <Textarea {...p} rows={3} defaultValue={v.notes ?? ""} />}
      </Field>
      {status === "APPROVED" && (
        <Checkbox
          name="legalConfirmed"
          label="Je confirme que les conditions de réutilisation de cette source ont été validées juridiquement et techniquement."
          hint="Action journalisée avec votre identité et la date."
        />
      )}
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</Notice>}
      <SubmitButton>Enregistrer</SubmitButton>
    </form>
  );
}
