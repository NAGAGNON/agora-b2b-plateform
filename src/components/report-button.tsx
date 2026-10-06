"use client";

import { useActionState, useState } from "react";
import { Flag } from "lucide-react";
import { createReport } from "@/app/actions/opportunities";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { REPORT_REASONS, type ReportTarget } from "@/lib/constants";

export function ReportButton({ targetType, targetId, signedIn, label = "Signaler" }: { targetType: ReportTarget; targetId: string; signedIn: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createReport, null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-red-700">
        <Flag className="size-4" aria-hidden /> {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Signaler ce contenu" description="L'équipe de modération examinera votre signalement.">
        {!signedIn ? (
          <Notice tone="info">
            Connectez-vous pour signaler ce contenu, ou utilisez la{" "}
            <a className="font-semibold underline" href={`/contact?objet=signalement&ref=${targetId}`}>
              page contact
            </a>
            .
          </Notice>
        ) : state?.ok ? (
          <Notice tone="success">{state.message}</Notice>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="targetType" value={targetType} />
            <input type="hidden" name="targetId" value={targetId} />
            <Field label="Motif" name="reason" required error={state && !state.ok ? state.fieldErrors?.reason : undefined}>
              {(p) => (
                <Select {...p} defaultValue="">
                  <option value="" disabled>
                    Choisir un motif
                  </option>
                  {Object.entries(REPORT_REASONS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Précisions (facultatif)" name="details">
              {(p) => <Textarea {...p} maxLength={2000} />}
            </Field>
            {state && !state.ok && <Notice tone="error">{state.error}</Notice>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <SubmitButton variant="danger">Envoyer le signalement</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
