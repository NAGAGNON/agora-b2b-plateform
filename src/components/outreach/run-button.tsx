"use client";

import { RefreshCw, Send } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { launchManualCampaign, runOutreachNow, testSmtpConnection } from "@/app/actions/outreach";
import { launchNeedCampaignsNow } from "@/app/actions/needs-admin";

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
        <Send className="size-4" aria-hidden /> Lancer la prospection habituelle
      </SubmitButton>
    </ActionForm>
  );
}

/** Campagne pour les besoins publiés par les entreprises inscrites (quota séparé de la prospection habituelle). */
export function LaunchNeedsButton() {
  return (
    <ActionForm action={launchNeedCampaignsNow} hidden={{}}>
      <SubmitButton variant="outline" pendingLabel="Campagne besoins en cours (jusqu'à 5 min)…">
        <Send className="size-4" aria-hidden /> Lancer la campagne besoins
      </SubmitButton>
    </ActionForm>
  );
}

/** Teste la connexion et l'authentification au serveur SMTP (aucun e-mail envoyé). */
export function SmtpTestButton() {
  return (
    <ActionForm action={testSmtpConnection} hidden={{}}>
      <SubmitButton variant="outline" pendingLabel="Test en cours…">
        <RefreshCw className="size-4" aria-hidden /> Tester la connexion SMTP
      </SubmitButton>
    </ActionForm>
  );
}
