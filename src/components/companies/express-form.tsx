"use client";

import { useActionState, useState } from "react";
import { createCompanyExpress } from "@/app/actions/company";
import { Field, Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { VisibilityOptIn } from "@/components/companies/visibility-opt-in";
import { Notice } from "@/components/ui/notice";
import { COMPANY_SIZE_LABELS, type CompanySize, type SectorOption } from "@/lib/constants";
import { SKILL_CATALOG } from "@/lib/skill-catalog";

type Place = { name: string; postal_code: string };

/** Profil express : 4 informations pour recevoir les offres qui vous correspondent (le reste se complète plus tard). */
export function ExpressCompanyForm({ sectors, places, next, defaultName, freeLaunch = true, baseLabel }: { sectors: SectorOption[]; places: Place[]; next?: string; defaultName?: string; freeLaunch?: boolean; baseLabel?: string | null }) {
  // React vide le formulaire après chaque envoi : on garde la saisie pour la réafficher en cas d'erreur
  const [last, setLast] = useState<{ n: number; v: Record<string, string>; skills: string[] }>({ n: 0, v: {}, skills: [] });
  const [sector, setSector] = useState("");
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof createCompanyExpress>> | null, fd: FormData) => {
    setLast((l) => ({ n: l.n + 1, v: Object.fromEntries([...fd.entries()].map(([k, x]) => [k, String(x)])), skills: fd.getAll("skill").map(String) }));
    return createCompanyExpress(prev, fd);
  }, null);
  const v = last.v;
  const catalog = SKILL_CATALOG[sector] ?? [];
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form key={last.n} action={action} className="space-y-5" noValidate data-testid="express-form">
      {next && <input type="hidden" name="suite" value={next} />}
      <Field label="Votre métier" name="sector" error={fe?.sector} required hint="Les offres et alertes seront choisies selon ce métier.">
        {(p) => (
          <Select {...p} value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="" disabled>
              Choisissez votre métier
            </option>
            {sectors.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {catalog.length > 0 && (
        <fieldset data-testid="skill-choices">
          <legend className="text-sm font-medium text-navy">Ce que vous faites</legend>
          <p className="mt-1 text-xs text-slate-500">Cochez une ou plusieurs cases : vous ne recevrez que les offres qui parlent de ces métiers.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {catalog.map((s) => (
              <label key={s.label} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-navy has-[:checked]:border-teal-500 has-[:checked]:bg-teal-50">
                <input type="checkbox" name="skill" value={s.label} defaultChecked={last.skills.includes(s.label)} className="mt-0.5 size-4 accent-teal-600" />
                <span>{s.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <Field
        label="Vos compétences"
        name="speciality"
        error={fe?.speciality}
        hint={catalog.length ? "Autre spécialité ? Écrivez-la, séparée par des virgules (ex. traduction anglais-français, réalité virtuelle)." : "Séparées par des virgules : ex. plomberie, traduction, graphisme, développement web. Chacune choisit les offres que vous recevrez."}
      >
        {(p) => <Input {...p} defaultValue={v.speciality} maxLength={300} />}
      </Field>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Ville" name="city" error={fe?.city} className="sm:col-span-2" required hint="Pour les offres proches de chez vous.">
          {(p) => (
            <>
              <Input {...p} defaultValue={v.city} list="express-places" autoComplete="address-level2" />
              <datalist id="express-places">
                {places.map((pl) => (
                  <option key={`${pl.name}-${pl.postal_code}`} value={pl.name}>
                    {pl.postal_code}
                  </option>
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Code postal" name="postalCode" error={fe?.postalCode}>
          {(p) => <Input {...p} defaultValue={v.postalCode} inputMode="numeric" maxLength={5} autoComplete="postal-code" />}
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nom de l'entreprise" name="name" error={fe?.name} required hint="Indépendant : votre nom ou votre nom commercial.">
          {(p) => <Input {...p} defaultValue={v.name ?? defaultName} maxLength={160} autoComplete="organization" />}
        </Field>
        <Field label="Taille" name="size" error={fe?.size}>
          {(p) => (
            <Select {...p} defaultValue={v.size ?? ""}>
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
      {state && !state.ok && <Notice tone="error">{state.error}</Notice>}
      <VisibilityOptIn freeLaunch={freeLaunch} baseLabel={baseLabel} />
      <SubmitButton size="lg" full pendingLabel="Création…">
        Voir les offres pour mon entreprise
      </SubmitButton>
    </form>
  );
}
