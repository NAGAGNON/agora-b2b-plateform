"use client";

import { useActionState } from "react";
import { recomputeGrowth, setGrowthEnabled } from "@/app/actions/growth";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";

export function GrowthEnableForm({ enabled }: { enabled: boolean }) {
  const [state, action] = useActionState(setGrowthEnabled, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
      <SubmitButton variant={enabled ? "outline" : "primary"} pendingLabel="Enregistrement…">
        {enabled ? "Suspendre la stratégie automatique" : "Activer la stratégie automatique"}
      </SubmitButton>
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</Notice>}
    </form>
  );
}

export function GrowthRecomputeForm() {
  const [state, action] = useActionState(recomputeGrowth, null);
  return (
    <form action={action} className="space-y-2">
      <SubmitButton pendingLabel="Calcul…">Recalculer maintenant</SubmitButton>
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</Notice>}
    </form>
  );
}
