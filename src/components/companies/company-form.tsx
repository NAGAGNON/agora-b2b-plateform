"use client";

import { useActionState } from "react";
import { createCompany, updateCompanyProfile } from "@/app/actions/company";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { COMPANY_KIND_LABELS, COMPANY_SIZE_LABELS, SECTORS, type CompanyKind, type CompanySize } from "@/lib/constants";

export type CompanyFormValues = {
  name?: string;
  kind?: CompanyKind;
  size?: CompanySize | null;
  city?: string | null;
  postal_code?: string | null;
  department_code?: string | null;
  siren?: string | null;
  website?: string | null;
  tagline?: string | null;
  description?: string | null;
  sectors?: string[];
  skills?: string[];
  intervention_zone?: string | null;
  intervention_radius_km?: number | null;
  certifications?: string[];
  references_text?: string | null;
  employees_range?: string | null;
  founded_year?: number | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  is_public?: boolean;
};

type Place = { name: string; postal_code: string; department_code: string };
type Dept = { code: string; name: string };

export function CompanyForm({ mode, values = {}, places, departments, next }: { mode: "create" | "edit"; values?: CompanyFormValues; places: Place[]; departments: Dept[]; next?: string }) {
  const [state, action] = useActionState(mode === "create" ? createCompany : updateCompanyProfile, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  const full = mode === "edit";
  return (
    <form action={action} className="space-y-8" noValidate encType="multipart/form-data">
      {next && <input type="hidden" name="suite" value={next} />}
      <fieldset className="space-y-5">
        <legend className="mb-1 text-lg font-bold text-navy">Identité</legend>
        <Field label="Nom de l'entreprise" name="name" error={fe?.name} required>
          {(p) => <Input {...p} defaultValue={values.name} maxLength={160} autoComplete="organization" />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Profil sur la plateforme" name="kind" error={fe?.kind} required>
            {(p) => (
              <Select {...p} defaultValue={values.kind ?? "BOTH"}>
                {(Object.keys(COMPANY_KIND_LABELS) as CompanyKind[]).map((k) => (
                  <option key={k} value={k}>
                    {COMPANY_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Taille" name="size" error={fe?.size}>
            {(p) => (
              <Select {...p} defaultValue={values.size ?? ""}>
                <option value="">Non précisée</option>
                {(Object.keys(COMPANY_SIZE_LABELS) as CompanySize[]).map((k) => (
                  <option key={k} value={k}>
                    {COMPANY_SIZE_LABELS[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Ville" name="city" error={fe?.city} className="sm:col-span-2" hint="Choisissez dans la liste pour activer la recherche par distance.">
            {(p) => (
              <>
                <Input {...p} defaultValue={values.city ?? ""} list="places-list" autoComplete="address-level2" />
                <datalist id="places-list">
                  {places.map((pl) => (
                    <option key={pl.name} value={pl.name}>
                      {pl.postal_code}
                    </option>
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Code postal" name="postalCode" error={fe?.postalCode}>
            {(p) => <Input {...p} defaultValue={values.postal_code ?? ""} inputMode="numeric" maxLength={5} autoComplete="postal-code" />}
          </Field>
        </div>
        {full && (
          <Field label="Département" name="departmentCode" error={fe?.departmentCode}>
            {(p) => (
              <Select {...p} defaultValue={values.department_code ?? ""}>
                <option value="">Déduit de la ville</option>
                {departments.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="SIREN" name="siren" error={fe?.siren} hint="Facultatif — 9 chiffres. Utile pour la vérification de l'entreprise.">
            {(p) => <Input {...p} defaultValue={values.siren ?? ""} inputMode="numeric" maxLength={11} />}
          </Field>
          <Field label="Site web" name="website" error={fe?.website}>
            {(p) => <Input {...p} defaultValue={values.website ?? ""} placeholder="www.exemple.fr" autoComplete="url" />}
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="mb-1 text-lg font-bold text-navy">Activité</legend>
        <Field label="Accroche" name="tagline" error={fe?.tagline} hint="Une phrase qui résume votre activité (160 caractères).">
          {(p) => <Input {...p} defaultValue={values.tagline ?? ""} maxLength={160} />}
        </Field>
        <Field label="Présentation" name="description" error={fe?.description}>
          {(p) => <Textarea {...p} defaultValue={values.description ?? ""} rows={6} maxLength={4000} />}
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-navy">Secteurs</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {SECTORS.map((s) => (
              <Checkbox key={s.slug} name="sectors" value={s.slug} defaultChecked={values.sectors?.includes(s.slug)} label={s.label} />
            ))}
          </div>
          {fe?.sectors && <p className="mt-1 text-sm text-red-600">{fe.sectors}</p>}
        </fieldset>
        <Field label="Compétences et prestations" name="skills" error={fe?.skills} hint="Séparées par des virgules, ex. : maintenance préventive, hydraulique, soudure TIG.">
          {(p) => <Textarea {...p} defaultValue={values.skills?.join(", ") ?? ""} rows={3} />}
        </Field>
      </fieldset>

      {full && (
        <>
          <fieldset className="space-y-5">
            <legend className="mb-1 text-lg font-bold text-navy">Zone et références</legend>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Zone d'intervention" name="interventionZone" error={fe?.interventionZone} className="sm:col-span-2">
                {(p) => <Input {...p} defaultValue={values.intervention_zone ?? ""} placeholder="ex. Finistère et Côtes-d'Armor" />}
              </Field>
              <Field label="Rayon (km)" name="interventionRadiusKm" error={fe?.interventionRadiusKm}>
                {(p) => <Input {...p} type="number" min={0} max={2000} defaultValue={values.intervention_radius_km ?? ""} />}
              </Field>
            </div>
            <Field label="Certifications" name="certifications" error={fe?.certifications} hint="Séparées par des virgules. N'indiquez que des certifications réellement détenues.">
              {(p) => <Input {...p} defaultValue={values.certifications?.join(", ") ?? ""} />}
            </Field>
            <Field label="Références" name="referencesText" error={fe?.referencesText} hint="Uniquement des références réelles, avec l'accord des clients concernés.">
              {(p) => <Textarea {...p} defaultValue={values.references_text ?? ""} rows={4} maxLength={3000} />}
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Effectif" name="employeesRange" error={fe?.employeesRange}>
                {(p) => <Input {...p} defaultValue={values.employees_range ?? ""} placeholder="ex. 10-19 salariés" maxLength={40} />}
              </Field>
              <Field label="Année de création" name="foundedYear" error={fe?.foundedYear}>
                {(p) => <Input {...p} type="number" min={1800} max={2100} defaultValue={values.founded_year ?? ""} />}
              </Field>
            </div>
          </fieldset>
          <fieldset className="space-y-5">
            <legend className="mb-1 text-lg font-bold text-navy">Contact public et visibilité</legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="E-mail de contact public" name="contactEmail" error={fe?.contactEmail} hint="Affiché aux membres connectés uniquement.">
                {(p) => <Input {...p} type="email" defaultValue={values.contact_email ?? ""} />}
              </Field>
              <Field label="Téléphone public" name="contactPhone" error={fe?.contactPhone} hint="Affiché aux membres connectés uniquement.">
                {(p) => <Input {...p} type="tel" defaultValue={values.contact_phone ?? ""} />}
              </Field>
            </div>
            <Field label="Logo" name="logo" error={fe?.logo} hint="PNG, JPEG ou WebP — 2 Mo maximum.">
              {(p) => <Input {...p} type="file" accept="image/png,image/jpeg,image/webp" className="h-auto py-2" />}
            </Field>
            <Checkbox name="isPublic" defaultChecked={values.is_public ?? true} label="Afficher mon entreprise dans l'annuaire public" hint="Décochez pour masquer votre profil de l'annuaire (vos publications restent visibles)." />
          </fieldset>
        </>
      )}
      {state && !state.ok && <Notice tone="error">{state.error}</Notice>}
      {state?.ok && <Notice tone="success">{state.message}</Notice>}
      <SubmitButton size="lg" className="w-full sm:w-auto" pendingLabel="Enregistrement…">
        {mode === "create" ? "Créer mon entreprise" : "Enregistrer le profil"}
      </SubmitButton>
    </form>
  );
}
