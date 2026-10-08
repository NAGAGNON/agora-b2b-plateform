"use client";

import { Ban, Eye, EyeOff, FlaskConical, Search, Send, UserMinus, UserPlus } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input, Label, Textarea } from "@/components/ui/form";
import { cancelCampaign, enrichCampaignNow, saveCampaignTemplates, saveRecipientText, toggleOpportunity, toggleRecipient, validateCampaign } from "@/app/actions/outreach";

export function CampaignActions({ campaignId, status, blockers, sendable }: { campaignId: string; status: string; blockers: string[]; sendable: number }) {
  if (!["READY", "VALIDATED", "SENDING"].includes(status)) return null;
  return (
    <div className="flex flex-wrap items-start gap-2">
      {status === "READY" && (
        <>
          <ActionForm action={validateCampaign} hidden={{ campaignId, mode: "simulation" }}>
            <SubmitButton variant="outline" pendingLabel="Simulation…" disabled={sendable === 0}>
              <FlaskConical className="size-4" aria-hidden /> Simuler l&apos;envoi (dry-run)
            </SubmitButton>
          </ActionForm>
          <ActionForm action={validateCampaign} hidden={{ campaignId, mode: "real" }}>
            <SubmitButton
              pendingLabel="Envoi…"
              disabled={blockers.length > 0 || sendable === 0}
              title={blockers.length ? blockers.join(" ") : undefined}
              onClick={(e) => {
                if (!confirm(`Valider la campagne et envoyer réellement ${sendable} e-mail(s) (dans la limite quotidienne) ?`)) e.preventDefault();
              }}
            >
              <Send className="size-4" aria-hidden /> Valider et envoyer
            </SubmitButton>
          </ActionForm>
        </>
      )}
      <ActionForm action={cancelCampaign} hidden={{ campaignId }}>
        <SubmitButton
          variant="ghost"
          pendingLabel="Annulation…"
          onClick={(e) => {
            if (!confirm("Annuler cette campagne ? Aucun autre e-mail ne partira.")) e.preventDefault();
          }}
        >
          <Ban className="size-4" aria-hidden /> Annuler
        </SubmitButton>
      </ActionForm>
    </div>
  );
}

export function EnrichCampaignButton({ campaignId, count }: { campaignId: string; count: number }) {
  return (
    <ActionForm action={enrichCampaignNow} hidden={{ campaignId }}>
      <SubmitButton variant="secondary" pendingLabel="Recherche en cours (jusqu'à 4 min)…">
        <Search className="size-4" aria-hidden /> Rechercher les adresses e-mail ({count})
      </SubmitButton>
    </ActionForm>
  );
}

export function TemplateEditor({ campaignId, subject, intro }: { campaignId: string; subject: string; intro: string }) {
  return (
    <ActionForm action={saveCampaignTemplates} hidden={{ campaignId }} className="space-y-4">
      <div>
        <Label htmlFor="subject_template">Objet de l&apos;e-mail</Label>
        <Input id="subject_template" name="subject_template" defaultValue={subject} maxLength={200} required />
      </div>
      <div>
        <Label htmlFor="intro_template">Introduction</Label>
        <Textarea id="intro_template" name="intro_template" defaultValue={intro} rows={3} maxLength={1000} required />
      </div>
      <p className="text-xs text-slate-500">
        Variables : {"{entreprise}"} · {"{nombre_opportunites}"} · {"{secteur}"} · {"{secteur_phrase}"} · {"{zone}"} · {"{zone_phrase}"} · {"{s}"} et {"{ent}"} (accords du pluriel).
      </p>
      <SubmitButton variant="secondary" pendingLabel="Enregistrement…">
        Enregistrer le modèle
      </SubmitButton>
    </ActionForm>
  );
}

export function RecipientToggle({ recipientId, excluded }: { recipientId: string; excluded: boolean }) {
  return (
    <ActionForm action={toggleRecipient} hidden={{ recipientId, exclude: excluded ? "false" : "true" }}>
      <SubmitButton variant="ghost" size="sm" pendingLabel="…" aria-label={excluded ? "Réintégrer l'entreprise" : "Exclure l'entreprise"}>
        {excluded ? <UserPlus className="size-4" aria-hidden /> : <UserMinus className="size-4" aria-hidden />}
        <span className="hidden sm:inline">{excluded ? "Réintégrer" : "Exclure"}</span>
      </SubmitButton>
    </ActionForm>
  );
}

export function OpportunityToggle({ opportunityId, recipientId, campaignId, excluded, label }: { opportunityId: string; recipientId?: string; campaignId?: string; excluded: boolean; label?: string }) {
  const hidden: Record<string, string> = { opportunityId, exclude: excluded ? "false" : "true" };
  if (recipientId) hidden.recipientId = recipientId;
  if (campaignId) hidden.campaignId = campaignId;
  return (
    <ActionForm action={toggleOpportunity} hidden={hidden}>
      <SubmitButton variant="ghost" size="sm" pendingLabel="…">
        {excluded ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
        {label ?? (excluded ? "Remettre" : "Retirer")}
      </SubmitButton>
    </ActionForm>
  );
}

export function RecipientTextEditor({ recipientId, subject, intro, placeholderSubject, placeholderIntro }: { recipientId: string; subject: string; intro: string; placeholderSubject: string; placeholderIntro: string }) {
  return (
    <ActionForm action={saveRecipientText} hidden={{ recipientId }} className="space-y-4">
      <div>
        <Label htmlFor="subject">Objet personnalisé</Label>
        <Input id="subject" name="subject" defaultValue={subject} placeholder={placeholderSubject} maxLength={200} />
      </div>
      <div>
        <Label htmlFor="intro">Introduction personnalisée</Label>
        <Textarea id="intro" name="intro" defaultValue={intro} placeholder={placeholderIntro} rows={4} maxLength={1000} />
      </div>
      <p className="text-xs text-slate-500">Laissez vide pour utiliser le modèle de la campagne. Les variables (ex. {"{entreprise}"}) restent utilisables.</p>
      <SubmitButton variant="secondary" pendingLabel="Enregistrement…">
        Enregistrer pour cette entreprise
      </SubmitButton>
    </ActionForm>
  );
}
