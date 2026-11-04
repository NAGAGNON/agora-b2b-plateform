"use client";

import { useActionState, useState } from "react";
import { createCompanyExpress } from "@/app/actions/company";
import { Field, Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { COMPANY_SIZE_LABELS, type CompanySize, type SectorOption } from "@/lib/constants";

type Place = { name: string; postal_code: string };

/** Profil express : 4 informations pour recevoir les offres qui vous correspondent (le reste se complète plus tard). */
export function ExpressCompanyForm({ sectors, places, next, defaultName }: { sectors: SectorOption[]; places: Place[]; next?: string; defaultName?: string }) {
  // React vide le formulaire après chaque envoi : on garde la saisie pour la réafficher en cas d'erreur
  const [last, setLast] = useState<{ n: number; v: Record<string, string> }>({ n: 0, v: {} });
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof createCompanyExpress>> | null, fd: FormData) => {
    setLast((l) => ({ n: l.n + 1, v: Object.fromEntries([...fd.entries()].map(([k, x]) => [k, String(x)])) }));
    return createCompanyExpress(prev, fd);
  }, null);
  const v = last.v;
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form key={last.n} action={action} className="space-y-5" noValidate data-testid="express-form">
      {next && <input type="hidden" name="suite" value={next} />}
      <Field label="Votre métier" name="sector" error={fe?.sector} required hint="Les offres et alertes seront choisies selon ce métier.">
        {(p) => (
          <Select {...p} defaultValue={v.sector ?? ""}>
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
      <Field label="Vos compétences" name="speciality" error={fe?.speciality} hint="Facultatif mais conseillé, séparées par des virgules : ex. plomberie, électricité, nettoyage de bureaux, développement web. Chacune affine les offres proposées.">
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
      <SubmitButton size="lg" full pendingLabel="Création…">
        Voir les offres pour mon entreprise
      </SubmitButton>
    </form>
  );
}
