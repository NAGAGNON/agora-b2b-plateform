"use client";

import { useActionState, useEffect, useRef } from "react";
import { createAlert } from "@/app/actions/engagement";
import { Field, Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { ALERT_FREQUENCY_LABELS, OPPORTUNITY_TYPE_LABELS, SECTORS, type AlertFrequency, type OpportunityType } from "@/lib/constants";

export function AlertForm({ departments, defaults }: { departments: { code: string; name: string }[]; defaults: { secteur?: string; departement?: string; type?: string; motscles?: string } }) {
  const [state, action] = useActionState(createAlert, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form ref={ref} action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Nom de l'alerte" name="name" error={fe?.name} required className="sm:col-span-2">
        {(p) => <Input {...p} maxLength={120} placeholder="ex. Maintenance dans le Finistère" />}
      </Field>
      <Field label="Secteur" name="sector" error={fe?.sector}>
        {(p) => (
          <Select {...p} defaultValue={defaults.secteur ?? ""}>
            <option value="">Tous</option>
            {SECTORS.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Département" name="departmentCode" error={fe?.departmentCode}>
        {(p) => (
          <Select {...p} defaultValue={defaults.departement ?? ""}>
            <option value="">Toute la France</option>
            {departments.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name} ({d.code})
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Type" name="type" error={fe?.type}>
        {(p) => (
          <Select {...p} defaultValue={defaults.type ?? ""}>
            <option value="">Tous les types</option>
            {(Object.keys(OPPORTUNITY_TYPE_LABELS) as OpportunityType[]).map((t) => (
              <option key={t} value={t}>
                {OPPORTUNITY_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Fréquence" name="frequency" error={fe?.frequency} required>
        {(p) => (
          <Select {...p} defaultValue="DAILY">
            {(Object.keys(ALERT_FREQUENCY_LABELS) as AlertFrequency[]).map((f) => (
              <option key={f} value={f}>
                {ALERT_FREQUENCY_LABELS[f]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Mots-clés" name="keywords" error={fe?.keywords} className="sm:col-span-2" hint="Recherche plein texte, ex. : compresseur OR hydraulique">
        {(p) => <Input {...p} defaultValue={defaults.motscles} maxLength={200} />}
      </Field>
      {state && <Notice tone={state.ok ? "success" : "error"} className="sm:col-span-2">{state.ok ? state.message : state.error}</Notice>}
      <div className="sm:col-span-2">
        <SubmitButton>Créer l&apos;alerte</SubmitButton>
      </div>
    </form>
  );
}
