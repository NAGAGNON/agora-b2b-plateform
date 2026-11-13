"use client";

import { useActionState, useEffect, useRef } from "react";
import { createAlert } from "@/app/actions/engagement";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { ALERT_FREQUENCY_LABELS, COMPANY_SIZE_LABELS, OPPORTUNITY_TYPE_LABELS, type CompanySize, type SectorOption, type AlertFrequency, type OpportunityType } from "@/lib/constants";
import { ActionError } from "@/components/billing/upgrade-prompt";
import { REGIONS, regionBySlug } from "@/lib/geo";
import { Chip, ChipGroup } from "@/components/ui/filters";
import { Target } from "lucide-react";

export function AlertForm({ departments, places, sectors, defaults }: { departments: { code: string; name: string }[]; places: { name: string; slug: string; department_code: string }[]; sectors: SectorOption[]; defaults: { secteur?: string; region?: string; departement?: string; type?: string; motscles?: string; lieu?: string; rayon?: string } }) {
  const [state, action] = useActionState(createAlert, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form ref={ref} action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Nom de l'alerte" name="name" error={fe?.name} required className="sm:col-span-2">
        {(p) => <Input {...p} maxLength={120} placeholder="ex. Informatique en Île-de-France" />}
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
      <Field label="Région" name="region" error={fe?.region}>
        {(p) => (
          <Select {...p} defaultValue={regionBySlug(defaults.region ?? "")?.name ?? ""}>
            <option value="">France entière</option>
            {REGIONS.map((r) => (
              <option key={r.slug} value={r.name}>
                {r.name}
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
      <details className="group/precise rounded-2xl border border-teal/30 bg-gradient-to-br from-teal-50/60 to-sky/60 sm:col-span-2" open={Boolean(fe?.extraDepartments || fe?.cpvPrefixes || fe?.minBudget)}>
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4 select-none [&::-webkit-details-marker]:hidden">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-teal-700 ring-1 ring-teal/30" aria-hidden>
            <Target className="size-5" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold text-navy">Alerte précise (facultatif)</span>
            <span className="block text-sm text-slate-600">Plusieurs métiers et départements, mots à exclure, acheteurs ciblés, budget, délai pour répondre…</span>
          </span>
          <span className="text-sm font-semibold text-teal-700 group-open/precise:hidden">Ajouter des critères</span>
          <span className="hidden text-sm font-semibold text-slate-500 group-open/precise:inline">Masquer</span>
        </summary>
        <div className="grid gap-4 border-t border-teal/20 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium text-navy">Autres métiers à inclure</p>
            <ChipGroup label="Autres métiers">
              {sectors.map((s) => (
                <Chip key={s.slug} type="checkbox" name="extraSectors" value={s.slug} checked={false}>
                  {s.label}
                </Chip>
              ))}
            </ChipGroup>
          </div>
          <Field label="Autres départements" name="extraDepartments" error={fe?.extraDepartments} hint="Codes séparés par des virgules, ex. : 69, 38, 42">
            {(p) => <Input {...p} maxLength={120} placeholder="69, 38, 42" />}
          </Field>
          <Field label="Mots à exclure" name="excludeKeywords" error={fe?.excludeKeywords} hint="Les offres contenant ces mots ne vous seront pas envoyées, ex. : nettoyage OR gardiennage">
            {(p) => <Input {...p} maxLength={200} />}
          </Field>
          <Field label="Acheteurs ciblés" name="buyerTerms" error={fe?.buyerTerms} hint="Seulement ces acheteurs, séparés par des virgules, ex. : SNCF, EDF, Ville de Lyon">
            {(p) => <Input {...p} maxLength={300} />}
          </Field>
          <Field label="Budget minimum (€ HT)" name="minBudget" error={fe?.minBudget} hint="Les offres sans budget publié restent proposées.">
            {(p) => <Input {...p} inputMode="numeric" maxLength={15} placeholder="ex. 20000" />}
          </Field>
          <Field label="Temps minimum pour répondre" name="minDaysLeft" error={fe?.minDaysLeft} hint="Ignorer les offres qui se terminent trop tôt.">
            {(p) => (
              <Select {...p} defaultValue="">
                <option value="">Peu importe</option>
                {[7, 14, 21, 30].map((d) => (
                  <option key={d} value={d}>
                    Au moins {d} jours
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Codes CPV (experts)" name="cpvPrefixes" error={fe?.cpvPrefixes} hint="Début des codes de la nomenclature des marchés publics, ex. : 72 (informatique), 4521 (bâtiment)">
            {(p) => <Input {...p} maxLength={120} placeholder="72, 4521" />}
          </Field>
        </div>
      </details>
      {state?.ok && <Notice tone="success" className="sm:col-span-2">{state.message}</Notice>}
      <ActionError state={state} className="sm:col-span-2" />
      <div className="sm:col-span-2">
        <SubmitButton>Créer l&apos;alerte</SubmitButton>
      </div>
    </form>
  );
}
