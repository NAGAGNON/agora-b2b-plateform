"use client";

import { RefreshCw } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { runOutreachNow } from "@/app/actions/outreach";

/** Lance immédiatement la synchronisation et la préparation de la campagne du jour. */
export function RunNowButton({ force = false, label = "Préparer la campagne du jour" }: { force?: boolean; label?: string }) {
  return (
    <ActionForm action={runOutreachNow} hidden={{ force: force ? "1" : "0" }}>
      <SubmitButton variant={force ? "outline" : "primary"} pendingLabel="Analyse en cours…">
        <RefreshCw className="size-4" aria-hidden /> {label}
      </SubmitButton>
    </ActionForm>
  );
}
