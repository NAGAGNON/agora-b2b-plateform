"use client";

import { useActionState, useState } from "react";
import { CalendarCheck2, Globe2, Send } from "lucide-react";
import { saveServiceOffer } from "@/app/actions/service-offers";
import type { ActionResult } from "@/lib/validation";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";

export type ServiceOfferValues = {
  id?: string;
  title?: string;
  description?: string;
  sector_slug?: string | null;
  department_code?: string | null;
  city?: string | null;
  nationwide?: boolean;
  available_from?: string | null;
  available_until?: string | null;
  capacity?: string | null;
  from_opportunity_id?: string | null;
};

/**
 * Annoncer (ou modifier) une disponibilité : ce que l'entreprise peut faire, où, quand et avec quels
 * moyens. La saisie est conservée en cas d'erreur.
 */
export function ServiceOfferForm({
  initial = {},
  sectors,
  departments,
}: {
  initial?: ServiceOfferValues;
  sectors: { slug: string; label: string }[];
  departments: { code: string; name: string }[];
}) {
  const [values, setValues] = useState<ServiceOfferValues>(initial);
  const [nationwide, setNationwide] = useState(Boolean(initial.nationwide));
  const [attempt, setAttempt] = useState(0);
  const [state, action] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    setAttempt((a) => a + 1);
    setValues({
      ...values,
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? ""),
      sector_slug: String(fd.get("sector_slug") ?? ""),
      department_code: String(fd.get("department_code") ?? ""),
      city: String(fd.get("city") ?? ""),
      available_from: String(fd.get("available_from") ?? ""),
      available_until: String(fd.get("available_until") ?? ""),
      capacity: String(fd.get("capacity") ?? ""),
    });
    return saveServiceOffer(prev, fd);
  }, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  const editing = Boolean(initial.id);

  return (
    <form action={action} className="space-y-6" noValidate key={attempt} data-testid="service-offer-form">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      {values.from_opportunity_id && <input type="hidden" name="from_opportunity_id" value={values.from_opportunity_id} />}
      {state && !state.ok && <Notice tone="error">{state.error}</Notice>}

      <Field label="Ce que vous proposez" name="title" required error={fe?.title} hint="En une phrase, ex. « Électricien disponible pour vos chantiers à Brest »">
        {(p) => <Input {...p} defaultValue={values.title ?? ""} maxLength={140} placeholder="Ex. Équipe de peintres disponible en décembre" />}
      </Field>

      <Field label="Ce que vous pouvez faire" name="description" required error={fe?.description} hint="Vos travaux ou services, le type de clients, ce qui vous distingue. Pas de téléphone ni d'e-mail : on vous écrit par la messagerie.">
        {(p) => <Textarea {...p} rows={6} defaultValue={values.description ?? ""} maxLength={3000} placeholder="Ex. Peinture intérieure et extérieure, ravalement, petits travaux de plâtrerie. Nous travaillons pour des entreprises, des syndics et des collectivités." />}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Votre métier" name="sector_slug" error={fe?.sector_slug}>
          {(p) => (
            <Select {...p} defaultValue={values.sector_slug ?? ""}>
              <option value="">Choisir…</option>
              {sectors.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Moyens disponibles (facultatif)" name="capacity" error={fe?.capacity} hint="Ex. « 2 équipes », « 5 téléconseillers », « 1 camion-grue »">
          {(p) => <Input {...p} defaultValue={values.capacity ?? ""} maxLength={140} />}
        </Field>
      </div>

      <fieldset className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:p-5">
        <legend className="sr-only">Où intervenez-vous ?</legend>
        <p className="flex items-center gap-2 font-semibold text-navy">
          <Globe2 className="size-4 text-teal-700" aria-hidden /> Où intervenez-vous ?
        </p>
        <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-700">
          <input type="checkbox" name="nationwide" checked={nationwide} onChange={(e) => setNationwide(e.target.checked)} className="size-4 rounded border-slate-300 text-teal focus:ring-teal" />
          Partout en France
        </label>
        {!nationwide && (
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Field label="Département" name="department_code" required error={fe?.department_code}>
              {(p) => (
                <Select {...p} defaultValue={values.department_code ?? ""}>
                  <option value="">Choisir…</option>
                  {departments.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.code} · {d.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Ville (facultatif)" name="city" error={fe?.city}>
              {(p) => <Input {...p} defaultValue={values.city ?? ""} maxLength={120} />}
            </Field>
          </div>
        )}
      </fieldset>

      <fieldset className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:p-5">
        <legend className="sr-only">Quand êtes-vous disponible ?</legend>
        <p className="flex items-center gap-2 font-semibold text-navy">
          <CalendarCheck2 className="size-4 text-teal-700" aria-hidden /> Quand êtes-vous disponible ?
        </p>
        <p className="mt-1 text-xs text-slate-500">Laissez vide pour « dès maintenant » et « jusqu&apos;à nouvel ordre » (en ligne 60 jours, prolongeable).</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field label="À partir du" name="available_from" error={fe?.available_from}>
            {(p) => <Input {...p} type="date" defaultValue={values.available_from ?? ""} />}
          </Field>
          <Field label="Jusqu'au" name="available_until" error={fe?.available_until}>
            {(p) => <Input {...p} type="date" defaultValue={values.available_until ?? ""} />}
          </Field>
        </div>
      </fieldset>

      <SubmitButton pendingLabel={editing ? "Enregistrement…" : "Publication…"} className="w-full sm:w-auto">
        <Send className="size-4" aria-hidden /> {editing ? "Enregistrer les modifications" : "Publier ma disponibilité"}
      </SubmitButton>
      {!editing && <p className="text-xs text-slate-500">Votre disponibilité est en ligne tout de suite. Les entreprises qui cherchent un prestataire vous écrivent par la messagerie : vous êtes prévenu par e-mail.</p>}
    </form>
  );
}
