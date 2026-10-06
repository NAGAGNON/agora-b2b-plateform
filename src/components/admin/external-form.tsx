"use client";

import { useActionState } from "react";
import { createExternalOpportunity } from "@/app/actions/admin";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { SECTORS } from "@/lib/constants";

export function ExternalOpportunityForm({ sources, departments }: { sources: { id: string; name: string }[]; departments: { code: string; name: string }[] }) {
  const [state, action] = useActionState(createExternalOpportunity, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Source (approuvée)" name="sourceId" error={fe?.sourceId} required>
          {(p) => (
            <Select {...p} defaultValue="">
              <option value="" disabled>
                Choisir
              </option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Type" name="type" required>
          {(p) => (
            <Select {...p} defaultValue="EXTERNAL_OPPORTUNITY">
              <option value="EXTERNAL_OPPORTUNITY">Opportunité externe</option>
              <option value="PUBLIC_TENDER">Marché public</option>
            </Select>
          )}
        </Field>
      </div>
      <Field label="URL de l'annonce originale" name="originalUrl" error={fe?.originalUrl} required hint="Les candidatures se font sur ce site : il est affiché comme lien principal.">
        {(p) => <Input {...p} type="url" placeholder="https://…" />}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Référence à la source" name="externalId" error={fe?.externalId}>
          {(p) => <Input {...p} maxLength={120} />}
        </Field>
        <Field label="Date de publication sur la source" name="sourcePublishedAt" error={fe?.sourcePublishedAt}>
          {(p) => <Input {...p} type="date" />}
        </Field>
      </div>
      <Field label="Titre" name="title" error={fe?.title} required>
        {(p) => <Input {...p} maxLength={180} />}
      </Field>
      <Field label="Acheteur (tel qu'indiqué par la source)" name="externalBuyerName" error={fe?.externalBuyerName}>
        {(p) => <Input {...p} maxLength={200} />}
      </Field>
      <Field label="Accroche" name="summary" error={fe?.summary}>
        {(p) => <Input {...p} maxLength={400} />}
      </Field>
      <Field label="Résumé rédigé" name="description" error={fe?.description} required hint="Rédigez un résumé original : ne copiez pas l'intégralité du texte source (droits de réutilisation).">
        {(p) => <Textarea {...p} rows={5} maxLength={5000} />}
      </Field>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Secteur" name="sector" error={fe?.sector} required>
          {(p) => (
            <Select {...p} defaultValue="">
              <option value="" disabled>
                Choisir
              </option>
              {SECTORS.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Ville" name="city" error={fe?.city}>
          {(p) => <Input {...p} />}
        </Field>
        <Field label="Département" name="departmentCode" error={fe?.departmentCode}>
          {(p) => (
            <Select {...p} defaultValue="">
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name} ({d.code})
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Date limite (selon la source)" name="responseDeadline" error={fe?.responseDeadline}>
        {(p) => <Input {...p} type="date" />}
      </Field>
      {state && !state.ok && <Notice tone="error">{state.error}</Notice>}
      <SubmitButton>Référencer et publier</SubmitButton>
    </form>
  );
}
