"use client";

import { useActionState } from "react";
import { saveVeillePreferences } from "@/app/actions/veille";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";

type Option = { value: string; label: string };
export type VeilleFormValues = { frequency: string; sectors: string[]; regions: string[]; types: string[]; keywords: string[]; consented: boolean };

const FREQUENCIES = [
  { value: "TWICE_WEEKLY", label: "Deux sélections par semaine", hint: "Le lundi et le vendredi, les opportunités les plus pertinentes." },
  { value: "DAILY", label: "Alertes quotidiennes", hint: "Chaque jour, uniquement s'il y a de nouvelles opportunités correspondant à vos critères." },
  { value: "NONE", label: "Aucune veille par e-mail", hint: "Votre compte reste actif. Les e-mails indispensables (sécurité, messages) continuent." },
];

function Group({ legend, name, options, selected }: { legend: string; name: string; options: Option[]; selected: string[] }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-navy">{legend}</legend>
      <div className="grid max-h-64 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
        {options.map((o) => (
          <Checkbox key={o.value} name={name} value={o.value} defaultChecked={selected.includes(o.value)} label={o.label} />
        ))}
      </div>
    </fieldset>
  );
}

export function VeilleForm({ v, frequencyHint, sectors, regions, types }: { v: VeilleFormValues; frequencyHint?: string; sectors: Option[]; regions: Option[]; types: Option[] }) {
  const [state, action] = useActionState(saveVeillePreferences, null);
  const initial = frequencyHint ?? v.frequency;
  return (
    <form action={action} className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-navy">Fréquence</legend>
        <div className="space-y-2">
          {FREQUENCIES.map((f) => (
            <label key={f.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm has-[:checked]:border-teal has-[:checked]:bg-teal-50">
              <input type="radio" name="frequency" value={f.value} defaultChecked={initial === f.value} className="mt-0.5 size-4 accent-teal" />
              <span>
                <span className="font-semibold text-navy">{f.label}</span>
                <span className="block text-xs text-slate-500">{f.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Group legend="Secteurs d'activité recherchés" name="sectors" options={sectors} selected={v.sectors} />
      <Group legend="Régions" name="regions" options={regions} selected={v.regions} />
      <Group legend="Types d'opportunités" name="types" options={types} selected={v.types} />
      <Field label="Mots-clés" name="keywords" hint="Séparés par des virgules, par exemple : cybersécurité, maintenance, nettoyage.">
        {(p) => <Input {...p} defaultValue={v.keywords.join(", ")} maxLength={600} />}
      </Field>
      {!v.consented && (
        <Checkbox
          name="consent"
          label="J'accepte de recevoir la veille LinkProB2B par e-mail (sélections d'opportunités et, si je les choisis, alertes quotidiennes)."
          hint="Facultatif. Vous pouvez vous désabonner à tout moment depuis chaque e-mail ou depuis cette page."
        />
      )}
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</Notice>}
      <SubmitButton>Enregistrer mes préférences</SubmitButton>
    </form>
  );
}
