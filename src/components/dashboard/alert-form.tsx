"use client";

import { useActionState, useEffect, useRef } from "react";
import { createAlert } from "@/app/actions/engagement";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { ALERT_FREQUENCY_LABELS, COMPANY_SIZE_LABELS, OPPORTUNITY_TYPE_LABELS, type CompanySize, type SectorOption, type AlertFrequency, type OpportunityType } from "@/lib/constants";

export function AlertForm({ departments, places, sectors, defaults }: { departments: { code: string; name: string }[]; places: { name: string; slug: string; department_code: string }[]; sectors: SectorOption[]; defaults: { secteur?: string; departement?: string; type?: string; motscles?: string; lieu?: string; rayon?: string } }) {
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
            {sectors.map((s) => (
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
      <Field label="Autour de la ville" name="placeSlug" error={fe?.placeSlug} hint="Remplace le département : recherche par distance.">
        {(p) => (
          <Select {...p} defaultValue={defaults.lieu ?? ""}>
            <option value="">— Aucune —</option>
            {places.map((pl) => (
              <option key={pl.slug} value={pl.slug}>
                {pl.name} ({pl.department_code})
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Rayon" name="radiusKm" error={fe?.radiusKm}>
        {(p) => (
          <Select {...p} defaultValue={defaults.rayon ?? "50"}>
            {[10, 25, 50, 100, 150, 200].map((r) => (
              <option key={r} value={r}>
                {r} km
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
      <Field label="Compétences" name="skills" error={fe?.skills} hint="Séparées par des virgules, ex. : hydraulique, automatisme">
        {(p) => <Input {...p} maxLength={300} />}
      </Field>
      <Field label="Taille d'entreprise ciblée" name="companySize" error={fe?.companySize} hint="Opportunités réservées à une taille donnée.">
        {(p) => (
          <Select {...p} defaultValue="">
            <option value="">Toutes</option>
            {(Object.keys(COMPANY_SIZE_LABELS) as CompanySize[]).map((k) => (
              <option key={k} value={k}>
                {COMPANY_SIZE_LABELS[k]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Mots-clés" name="keywords" error={fe?.keywords} className="sm:col-span-2" hint="Recherche plein texte, ex. : compresseur OR hydraulique">
        {(p) => <Input {...p} defaultValue={defaults.motscles} maxLength={200} />}
      </Field>
      <div className="sm:col-span-2">
        <Checkbox name="includeExternal" defaultChecked label="Inclure les opportunités externes (marchés publics BOAMP, TED…)" hint="Décochez pour ne recevoir que les demandes publiées directement sur LinkProB2B." />
      </div>
      {state && <Notice tone={state.ok ? "success" : "error"} className="sm:col-span-2">{state.ok ? state.message : state.error}</Notice>}
      <div className="sm:col-span-2">
        <SubmitButton>Créer l&apos;alerte</SubmitButton>
      </div>
    </form>
  );
}
