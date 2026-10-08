"use client";

import { RefreshCw, Send } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { launchManualCampaign, runOutreachNow } from "@/app/actions/outreach";

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

/** Campagne manuelle complète, sans limite de nombre par jour (la campagne automatique n'est pas modifiée). */
export function LaunchManualButton() {
  return (
    <ActionForm action={launchManualCampaign} hidden={{}}>
      <SubmitButton pendingLabel="Campagne en cours (jusqu'à 5 min)…">
        <Send className="size-4" aria-hidden /> Lancer une campagne maintenant
      </SubmitButton>
    </ActionForm>
  );
}
