"use client";

import { useActionState, useRef, useState } from "react";
import type { ActionResult } from "@/lib/validation";
import { addOpportunityDocuments } from "@/app/actions/opportunities";
import { FileUploader } from "@/components/ui/file-uploader";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";

export function DocumentUploadForm({ opportunityId }: { opportunityId: string }) {
  const [key, setKey] = useState(0);
  const ref = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    const r = await addOpportunityDocuments(prev, fd);
    if (r.ok) setKey((k) => k + 1);
    return r;
  }, null);
  return (
    <form ref={ref} action={action} className="mt-4 space-y-3">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <FileUploader key={key} name="files" maxFiles={5} />
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</Notice>}
      <SubmitButton size="sm" variant="outline">
        Ajouter les documents
      </SubmitButton>
    </form>
  );
}
