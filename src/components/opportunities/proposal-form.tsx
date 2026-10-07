"use client";

import { useActionState, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { uploadFiles } from "@/lib/direct-upload";
import { submitProposal } from "@/app/actions/opportunities";
import { Field, Input, Textarea } from "@/components/ui/form";
import { FileUploader } from "@/components/ui/file-uploader";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/validation";
import { ActionError } from "@/components/billing/upgrade-prompt";

export type ProposalValues = {
  message?: string;
  proposal_text?: string | null;
  price_amount?: number | null;
  price_details?: string | null;
  lead_time?: string | null;
  valid_until?: string | null;
  additional_info?: string | null;
};

export function ProposalForm({ opportunityId, values = {} }: { opportunityId: string; values?: ProposalValues }) {
  const [files, setFiles] = useState<File[]>([]);
  const router = useRouter();
  const [state, dispatch] = useActionState<ActionResult<{ id: string }> | null, FormData>(async (prev, fd) => {
    const r = await submitProposal(prev, fd);
    if (!r.ok) return r;
    let suffix = "reponse=envoyee";
    if (files.length) {
      const { errors } = await uploadFiles("proposal", r.data!.id, files);
      if (errors.length) suffix += `&erreur=${encodeURIComponent(errors.join(" "))}`;
    }
    router.push(`/opportunites/${opportunityId}?${suffix}`);
    return r;
  }, null);
  const [pending, start] = useTransition();
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(() => dispatch(fd));
  }
  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <Field label="Message d'accompagnement" name="message" error={fe?.message} required hint="Présentez votre réponse en quelques lignes (10 caractères minimum).">
        {(p) => <Textarea {...p} defaultValue={values.message} rows={4} maxLength={5000} />}
      </Field>
      <Field label="Proposition détaillée" name="proposalText" error={fe?.proposalText} hint="Méthodologie, moyens, planning, conditions…">
        {(p) => <Textarea {...p} defaultValue={values.proposal_text ?? ""} rows={8} maxLength={20000} />}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Prix (€ HT)" name="priceAmount" error={fe?.priceAmount}>
          {(p) => <Input {...p} type="number" min={0} step="0.01" defaultValue={values.price_amount ?? ""} />}
        </Field>
        <Field label="Détail du prix" name="priceDetails" error={fe?.priceDetails}>
          {(p) => <Input {...p} defaultValue={values.price_details ?? ""} placeholder="ex. forfait annuel, hors déplacements" />}
        </Field>
        <Field label="Délai" name="leadTime" error={fe?.leadTime}>
          {(p) => <Input {...p} defaultValue={values.lead_time ?? ""} placeholder="ex. démarrage sous 3 semaines" />}
        </Field>
        <Field label="Offre valable jusqu'au" name="validUntil" error={fe?.validUntil}>
          {(p) => <Input {...p} type="date" defaultValue={values.valid_until ?? ""} />}
        </Field>
      </div>
      <Field label="Informations complémentaires" name="additionalInfo" error={fe?.additionalInfo}>
        {(p) => <Textarea {...p} defaultValue={values.additional_info ?? ""} rows={3} maxLength={4000} />}
      </Field>
      <div>
        <p className="mb-2 text-sm font-semibold text-navy">Pièces jointes</p>
        <FileUploader maxFiles={5} onChange={setFiles} label="Ajouter devis, références, attestations…" />
        {fe?.files && <p className="mt-1 text-sm text-red-600">{fe.files}</p>}
        <p className="mt-2 text-xs text-slate-500">Visibles uniquement par votre entreprise et le demandeur.</p>
      </div>
      <ActionError state={state} />
      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Envoi…" : "Envoyer ma réponse"}
      </Button>
    </form>
  );
}
