"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { submitTestimonial } from "@/app/actions/testimonials";
import type { ActionResult } from "@/lib/validation";
import { Checkbox, Field, FieldError, Input, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";

type Initial = { authorName: string; authorRole: string; companyName: string; quote: string; rating: number | null; consent: boolean };

/** Formulaire d'avis : publication seulement si la case (non cochée par défaut) est cochée. */
export function TestimonialForm({ initial }: { initial: Initial }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(submitTestimonial, null);
  const [rating, setRating] = useState(initial.rating ?? 0);
  const [hover, setHover] = useState(0);
  const shown = hover || rating;
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  if (state?.ok)
    return (
      <Notice tone="success" title="Avis enregistré">
        {state.message}
      </Notice>
    );
  return (
    <form action={action} className="space-y-5" noValidate>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-navy">Votre note</legend>
        <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer p-0.5" onMouseEnter={() => setHover(n)}>
              <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="peer sr-only" aria-label={`${n} étoile${n > 1 ? "s" : ""} sur 5`} />
              <Star className={`size-9 transition peer-focus-visible:rounded peer-focus-visible:ring-4 peer-focus-visible:ring-teal/30 ${n <= shown ? "fill-teal text-teal" : "text-slate-300"}`} aria-hidden />
            </label>
          ))}
          {shown > 0 && <span className="ml-2 text-sm font-semibold text-slate-600">{["", "Décevant", "Moyen", "Bien", "Très bien", "Excellent"][shown]}</span>}
        </div>
        <FieldError message={fe?.rating} />
      </fieldset>
      <Field label="Votre avis (facultatif)" name="quote" error={fe?.quote} hint="En une ou deux phrases : ce que LinkProB2B vous apporte, ou ce qui vous manque.">
        {(f) => <Textarea {...f} rows={4} maxLength={600} defaultValue={initial.quote} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom et prénom" name="authorName" error={fe?.authorName} required>
          {(f) => <Input {...f} autoComplete="name" maxLength={120} defaultValue={initial.authorName} />}
        </Field>
        <Field label="Fonction (facultatif)" name="authorRole" error={fe?.authorRole}>
          {(f) => <Input {...f} autoComplete="organization-title" maxLength={120} defaultValue={initial.authorRole} placeholder="Ex. : gérant, responsable commercial" />}
        </Field>
      </div>
      <Field label="Entreprise (facultatif)" name="companyName" error={fe?.companyName}>
        {(f) => <Input {...f} autoComplete="organization" maxLength={160} defaultValue={initial.companyName} />}
      </Field>
      <div>
        <Checkbox
          name="consent"
          defaultChecked={initial.consent}
          label="J'accepte que mon avis soit affiché sur LinkProB2B avec mon nom, ma fonction et le nom de mon entreprise. Sans cette case, il reste privé."
        />
        <FieldError message={fe?.consent} />
      </div>
      {state && !state.ok && !fe && <Notice tone="error">{state.error}</Notice>}
      <SubmitButton full size="lg" pendingLabel="Envoi…">
        Envoyer mon avis
      </SubmitButton>
    </form>
  );
}
