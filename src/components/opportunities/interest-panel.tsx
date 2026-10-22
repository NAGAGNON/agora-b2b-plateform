"use client";

import { useActionState, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/validation";
import Link from "next/link";
import { MessageSquare, Send, KanbanSquare } from "lucide-react";
import { expressInterest, trackInPipeline, trackNeedMessageClick, withdrawInterest, withdrawProposal } from "@/app/actions/opportunities";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import type { InterestStatus, ProposalStatus } from "@/lib/constants";
import { ActionError } from "@/components/billing/upgrade-prompt";

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
  /** Arrivée par « Envoyer un message » (e-mail, notification) : formulaire ouvert d'emblée */
  openMessage?: boolean;
};

/** Panneau d'action d'un besoin interne : « Envoyer un message » puis « Répondre à la consultation ». */
export function InterestPanel(p: Props) {
  const canMessage = p.open && p.signedIn && p.hasCompany && !p.isOwner && (!p.interest || p.interest.status === "WITHDRAWN");
  const [open, setOpen] = useState(Boolean(p.openMessage && canMessage));
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
        <p className="text-sm text-slate-600">Vous pouvez répondre à ce besoin ? Écrivez directement à l&apos;entreprise qui l&apos;a publié (compte gratuit).</p>
        {p.open ? (
          <a href={`/api/besoins/${p.opportunityId}/message`} className={buttonClasses({ full: true, size: "lg" })} data-testid="need-message">
            <MessageSquare className="size-5" aria-hidden /> Envoyer un message
          </a>
        ) : (
          p.closedReason && <Notice tone="warning">{p.closedReason}</Notice>
        )}
        <a href={`/api/besoins/${p.opportunityId}/message?compte=1`} className={buttonClasses({ full: true, variant: "outline" })}>
          J&apos;ai déjà un compte
        </a>
        <p className="text-center text-xs text-slate-500">
          ou{" "}
          <Link href={`/inscription?suite=${encodeURIComponent(next)}`} className="underline">
            créer un compte
          </Link>{" "}
          pour suivre ce besoin
        </p>
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
      {canMessage && (
        <Button
          full
          size="lg"
          data-testid="need-message"
          onClick={() => {
            setOpen(true);
            void trackNeedMessageClick(p.opportunityId);
          }}
        >
          <MessageSquare className="size-5" aria-hidden /> Envoyer un message
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
      <Modal open={open} onClose={() => setOpen(false)} title="Envoyer un message au demandeur" description="L'entreprise est prévenue tout de suite et peut vous répondre par la messagerie de LinkProB2B.">
        <form action={action} className="space-y-4">
          <input type="hidden" name="opportunityId" value={p.opportunityId} />
          <Field label="Votre message" name="message" required hint="Présentez votre entreprise, ce que vous proposez pour ce besoin et vos disponibilités.">
            {(f) => <Textarea {...f} rows={6} minLength={10} maxLength={2000} required />}
          </Field>
          <ActionError state={state} />
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
