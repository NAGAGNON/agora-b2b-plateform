"use client";

import { useActionState } from "react";
import { BellRing } from "lucide-react";
import { subscribeAlertLead } from "@/app/actions/alert-leads";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/notice";
import type { ActionResult } from "@/lib/validation";

/**
 * « Recevoir les marchés similaires » : seulement l'adresse e-mail, sans compte.
 * Case de consentement jamais pré-cochée ; l'alerte ne démarre qu'après confirmation par e-mail.
 */
export function AlertLeadForm({
  label,
  sector,
  department,
  region,
  opportunityId,
  path,
  title = "Recevoir les marchés similaires",
  compact = false,
}: {
  label: string;
  sector: string | null;
  department: string | null;
  region: string | null;
  opportunityId?: string | null;
  path: string;
  title?: string;
  compact?: boolean;
}) {
  const [state, action] = useActionState(subscribeAlertLead, null as ActionResult | null);
  const id = `lead-${opportunityId ?? path}`.replace(/[^a-z0-9-]/gi, "-");
  return (
    <div className={`rounded-2xl border border-teal/40 bg-teal-50 ${compact ? "p-4" : "p-5"}`} data-testid="alert-lead">
      <p className="flex items-center gap-2 font-heading text-lg font-bold text-navy">
        <BellRing className="size-5 text-teal-700" aria-hidden /> {title}
      </p>
      <p className="mt-1 text-sm text-slate-700">
        Les nouveaux marchés <strong>{label}</strong> par e-mail, chaque semaine. Gratuit, sans compte, désinscription en un clic.
      </p>
      {state?.ok ? (
        <Notice tone="success" className="mt-3">
          {state.message}
        </Notice>
      ) : (
        <form action={action} className="mt-3 space-y-2">
          <input type="hidden" name="sector" value={sector ?? ""} />
          <input type="hidden" name="department" value={department ?? ""} />
          <input type="hidden" name="region" value={region ?? ""} />
          <input type="hidden" name="opportunityId" value={opportunityId ?? ""} />
          <input type="hidden" name="path" value={path} />
          <input type="hidden" name="label" value={label} />
          <div className="hidden" aria-hidden>
            <label>
              Site web
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <label htmlFor={`${id}-email`} className="sr-only">
            Adresse e-mail professionnelle
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id={`${id}-email`} name="email" type="email" required autoComplete="email" placeholder="vous@entreprise.fr" className="min-w-0 flex-1 bg-white" />
            <SubmitButton pendingLabel="Envoi…">Recevoir les marchés</SubmitButton>
          </div>
          <label htmlFor={`${id}-consent`} className="flex cursor-pointer items-start gap-2 text-xs text-slate-600">
            <input id={`${id}-consent`} type="checkbox" name="consent" required className="mt-0.5 size-4 shrink-0 accent-teal" />
            <span>J&apos;accepte de recevoir ces opportunités par e-mail (une sélection par semaine au plus). Désinscription en un clic dans chaque e-mail.</span>
          </label>
          {state && !state.ok && (
            <p className="text-sm font-medium text-red-700" role="alert">
              {state.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
