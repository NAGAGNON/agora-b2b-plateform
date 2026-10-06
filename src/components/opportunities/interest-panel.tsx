"use client";

import { useActionState, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/validation";
import Link from "next/link";
import { HandHeart, Send, KanbanSquare } from "lucide-react";
import { expressInterest, trackInPipeline, withdrawInterest, withdrawProposal } from "@/app/actions/opportunities";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import type { InterestStatus, ProposalStatus } from "@/lib/constants";

type Props = {
  opportunityId: string;
  open: boolean;
  closedReason: string | null;
  signedIn: boolean;
  hasCompany: boolean;
  isOwner: boolean;
  interest: { id: string; status: InterestStatus } | null;
  proposal: { id: string; status: ProposalStatus } | null;
  inPipeline: boolean;
};

/** Panneau d'action d'un besoin interne : « Je suis intéressé » puis « Répondre ». */
export function InterestPanel(p: Props) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const [state, action] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    const r = await expressInterest(prev, fd);
    if (r.ok) {
      setOpen(false);
      toast(r.message ?? "Intérêt envoyé.");
    }
    return r;
  }, null);

  const next = `/opportunites/${p.opportunityId}`;
  if (!p.signedIn) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Créez un compte gratuit pour manifester votre intérêt et répondre à ce besoin.</p>
        <ButtonLink href={`/connexion?suite=${encodeURIComponent(next)}`} full size="lg">
          Se connecter pour répondre
        </ButtonLink>
        <ButtonLink href={`/inscription?suite=${encodeURIComponent(next)}`} full variant="outline">
          Créer un compte
        </ButtonLink>
      </div>
    );
  }
  if (p.isOwner) {
    return (
      <div className="space-y-3">
        <Notice tone="info">Ce besoin a été publié par votre entreprise.</Notice>
        <ButtonLink href={`/dashboard/opportunites/${p.opportunityId}`} full size="lg" variant="secondary">
          Gérer cette consultation
        </ButtonLink>
      </div>
    );
  }
  if (!p.hasCompany) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Complétez le profil de votre entreprise pour pouvoir répondre.</p>
        <ButtonLink href={`/onboarding/entreprise?suite=${encodeURIComponent(next)}`} full size="lg">
          Créer mon entreprise
        </ButtonLink>
      </div>
    );
  }

  const canAct = p.open;
  const proposalEditable = !p.proposal || ["SUBMITTED", "INFO_REQUESTED", "WITHDRAWN"].includes(p.proposal.status);
  return (
    <div className="space-y-3">
      {p.interest && p.interest.status !== "WITHDRAWN" && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-sky px-3 py-2 text-sm">
          <span className="font-medium text-navy">Votre intérêt</span>
          <StatusBadge kind="interest" status={p.interest.status} />
        </div>
      )}
      {p.proposal && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-sky px-3 py-2 text-sm">
          <span className="font-medium text-navy">Votre réponse</span>
          <StatusBadge kind="proposal" status={p.proposal.status} />
        </div>
      )}
      {!canAct && p.closedReason && <Notice tone="warning">{p.closedReason}</Notice>}
      {canAct && (!p.interest || p.interest.status === "WITHDRAWN") && (
        <Button full size="lg" onClick={() => setOpen(true)}>
          <HandHeart className="size-5" aria-hidden /> Je suis intéressé
        </Button>
      )}
      {canAct && proposalEditable && (
        <Link href={`/opportunites/${p.opportunityId}/repondre`} className={buttonClasses({ full: true, size: "lg", variant: p.interest ? "primary" : "secondary" })}>
          <Send className="size-5" aria-hidden /> {p.proposal && p.proposal.status !== "WITHDRAWN" ? "Modifier ma réponse" : "Répondre à la consultation"}
        </Link>
      )}
      {!p.inPipeline && (
        <Button
          full
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await trackInPipeline(p.opportunityId);
              toast(r.ok ? (r.message ?? "OK") : r.error, r.ok ? "success" : "error");
            })
          }
        >
          <KanbanSquare className="size-4" aria-hidden /> Suivre dans mon pipeline
        </Button>
      )}
      {p.inPipeline && (
        <Link href="/dashboard/pipeline" className="block text-center text-sm font-semibold text-teal-700 hover:underline">
          Suivie dans votre pipeline →
        </Link>
      )}
      <div className="flex flex-wrap justify-center gap-4 pt-1 text-xs">
        {p.interest && !["WITHDRAWN", "ACCEPTED"].includes(p.interest.status) && !p.proposal && (
          <button
            type="button"
            className="text-slate-500 underline hover:text-red-700"
            onClick={() => start(async () => {
              const r = await withdrawInterest(p.interest!.id, p.opportunityId);
              toast(r.ok ? (r.message ?? "OK") : r.error, r.ok ? "success" : "error");
            })}
          >
            Retirer mon intérêt
          </button>
        )}
        {p.proposal && !["WITHDRAWN", "SELECTED", "DECLINED"].includes(p.proposal.status) && (
          <button
            type="button"
            className="text-slate-500 underline hover:text-red-700"
            onClick={() => {
              if (!confirm("Retirer votre réponse ? Le demandeur ne pourra plus la consulter comme active.")) return;
              start(async () => {
                const r = await withdrawProposal(p.proposal!.id, p.opportunityId);
                toast(r.ok ? (r.message ?? "OK") : r.error, r.ok ? "success" : "error");
              });
            }}
          >
            Retirer ma réponse
          </button>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Manifester votre intérêt" description="Le demandeur sera notifié et pourra vous contacter via la messagerie.">
        <form action={action} className="space-y-4">
          <input type="hidden" name="opportunityId" value={p.opportunityId} />
          <Field label="Message au demandeur (facultatif)" name="message" hint="Présentez brièvement votre entreprise et votre capacité à répondre.">
            {(f) => <Textarea {...f} rows={5} maxLength={2000} />}
          </Field>
          {state && !state.ok && <Notice tone="error">{state.error}</Notice>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <SubmitButton>Envoyer</SubmitButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
