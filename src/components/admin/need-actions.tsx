"use client";

import { useActionState } from "react";
import { processNeedsNow, rerunNeed } from "@/app/actions/needs-admin";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";

export function RerunNeedButton({ id }: { id: string }) {
  const [state, action] = useActionState(rerunNeed, null);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="opportunityId" value={id} />
      <SubmitButton size="sm" variant="outline" pendingLabel="Analyse…">
        Relancer
      </SubmitButton>
      {state && <p className={state.ok ? "text-xs text-teal-700" : "text-xs text-red-700"}>{state.ok ? state.message : state.error}</p>}
    </form>
  );
}

export function ProcessNeedsButton() {
  const [state, action] = useActionState(processNeedsNow, null);
  return (
    <form action={action} className="space-y-2">
      <SubmitButton size="sm" pendingLabel="Traitement (jusqu'à 2 minutes)…">
        Traiter les besoins maintenant
      </SubmitButton>
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</Notice>}
    </form>
  );
}
