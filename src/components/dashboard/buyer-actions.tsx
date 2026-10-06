"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Check, Edit3, HelpCircle, Lock, MessageSquare, RotateCcw, Send, Star, Trash2, X } from "lucide-react";
import Link from "next/link";
import { buyerDecision, changeOpportunityStatus, closeOpportunity, deleteDraft, deleteOpportunityDocument, saveEvaluation } from "@/app/actions/opportunities";
import { startConversation } from "@/app/actions/messages";
import { Button, buttonClasses } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import { OUTCOME_LABELS, type OpportunityOutcome, type OpportunityStatus } from "@/lib/constants";
import type { ActionResult } from "@/lib/validation";

/** Actions de cycle de vie disponibles pour le demandeur selon le statut. */
export function LifecycleActions({ id, status, proposals }: { id: string; status: OpportunityStatus; proposals: { id: string; label: string }[] }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const run = (to: "PENDING_REVIEW" | "DRAFT" | "ARCHIVED", confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    start(async () => {
      const r = await changeOpportunityStatus(id, to);
      toast(r.ok ? (r.message ?? "OK") : r.error, r.ok ? "success" : "error");
      router.refresh();
    });
  };
  const editable = ["DRAFT", "CHANGES_REQUESTED", "REJECTED", "PUBLISHED"].includes(status);
  return (
    <div className="flex flex-wrap gap-2">
      {editable && (
        <Link href={`/dashboard/opportunites/${id}/modifier`} className={buttonClasses({ variant: "outline", size: "sm" })}>
          <Edit3 className="size-4" aria-hidden /> Modifier
        </Link>
      )}
      {["DRAFT", "CHANGES_REQUESTED"].includes(status) && (
        <Button size="sm" disabled={pending} onClick={() => run("PENDING_REVIEW", "Envoyer cette publication en validation ? Vous certifiez être autorisé à publier ces informations.")}>
          <Send className="size-4" aria-hidden /> Soumettre à validation
        </Button>
      )}
      {status === "PENDING_REVIEW" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run("DRAFT")}>
          <RotateCcw className="size-4" aria-hidden /> Repasser en brouillon
        </Button>
      )}
      {["PUBLISHED", "EXPIRED"].includes(status) && <CloseButton id={id} proposals={proposals} />}
      {["DRAFT", "REJECTED", "CHANGES_REQUESTED", "CLOSED", "EXPIRED"].includes(status) && status !== "DRAFT" && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run("ARCHIVED", "Archiver cette opportunité ? Elle ne sera plus modifiable.")}>
          <Archive className="size-4" aria-hidden /> Archiver
        </Button>
      )}
      {status === "DRAFT" && (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          className="text-red-700"
          onClick={() => {
            if (!confirm("Supprimer définitivement ce brouillon ?")) return;
            start(async () => {
              const r = await deleteDraft(id);
              if (r && !r.ok) toast(r.error, "error");
            });
          }}
        >
          <Trash2 className="size-4" aria-hidden /> Supprimer
        </Button>
      )}
    </div>
  );
}

function CloseButton({ id, proposals }: { id: string; proposals: { id: string; label: string }[] }) {
  const hasProposals = proposals.length > 0;
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, action] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    const r = await closeOpportunity(prev, fd);
    if (r.ok) {
      setOpen(false);
      router.refresh();
    }
    return r;
  }, null);
  const [outcome, setOutcome] = useState<OpportunityOutcome>(hasProposals ? "AWARDED" : "NOT_AWARDED");
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Lock className="size-4" aria-hidden /> Clôturer
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Clôturer la consultation" description="Plus aucune réponse ne pourra être déposée. Les fournisseurs ayant répondu seront informés.">
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <Field label="Résultat" name="outcome" required>
            {(p) => (
              <Select {...p} value={outcome} onChange={(e) => setOutcome(e.target.value as OpportunityOutcome)}>
                {(Object.keys(OUTCOME_LABELS) as OpportunityOutcome[]).map((k) => (
                  <option key={k} value={k}>
                    {OUTCOME_LABELS[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {outcome === "AWARDED" && <ProposalPicker options={proposals} error={state && !state.ok ? state.fieldErrors?.selectedProposalId : undefined} />}
          <Field label="Note interne (facultatif)" name="note">
            {(p) => <Textarea {...p} rows={3} maxLength={2000} />}
          </Field>
          {state && !state.ok && <Notice tone="error">{state.error}</Notice>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <SubmitButton>Clôturer</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}

function ProposalPicker({ options, error }: { options: { id: string; label: string }[]; error?: string }) {
  return (
    <Field label="Réponse retenue" name="selectedProposalId" required error={error}>
      {(p) => (
        <Select {...p} defaultValue="">
          <option value="" disabled>
            Choisir la réponse retenue
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

type DecisionKind = "interest" | "proposal";
const LABELS: Record<string, { label: string; icon: typeof Check; variant: "primary" | "outline" | "danger" | "secondary"; needsMessage?: boolean }> = {
  SHORTLISTED: { label: "Présélectionner", icon: Star, variant: "outline" },
  INFO_REQUESTED: { label: "Demander des informations", icon: HelpCircle, variant: "outline", needsMessage: true },
  ACCEPTED: { label: "Accepter", icon: Check, variant: "primary" },
  SELECTED: { label: "Sélectionner", icon: Check, variant: "primary" },
  DECLINED: { label: "Décliner", icon: X, variant: "danger" },
};

/** Boutons de décision (accepter, décliner, demander des informations, présélectionner, sélectionner). */
export function DecisionButtons({ kind, targetId, opportunityId, current, disabled }: { kind: DecisionKind; targetId: string; opportunityId: string; current: string; disabled?: boolean }) {
  const [modal, setModal] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();
  const [, action] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    const r = await buyerDecision(prev, fd);
    if (r.ok) {
      setModal(null);
      toast(r.message ?? "Enregistré.");
      router.refresh();
    } else toast(r.error, "error");
    return r;
  }, null);
  if (disabled || current === "WITHDRAWN") return null;
  const options = kind === "interest" ? ["SHORTLISTED", "INFO_REQUESTED", "ACCEPTED", "DECLINED"] : ["SHORTLISTED", "INFO_REQUESTED", "SELECTED", "DECLINED"];
  return (
    <div className="flex flex-wrap gap-2">
      {options
        .filter((s) => s !== current)
        .map((s) => {
          const cfg = LABELS[s];
          return (
            <Button key={s} size="sm" variant={cfg.variant} onClick={() => setModal(s)}>
              <cfg.icon className="size-4" aria-hidden /> {cfg.label}
            </Button>
          );
        })}
      <Modal open={modal !== null} onClose={() => setModal(null)} title={modal ? LABELS[modal].label : ""} description="Le fournisseur sera notifié de votre décision.">
        <form action={action} className="space-y-4">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="targetId" value={targetId} />
          <input type="hidden" name="opportunityId" value={opportunityId} />
          <input type="hidden" name="status" value={modal ?? ""} />
          <Field label={modal && LABELS[modal].needsMessage ? "Informations demandées" : "Message au fournisseur (facultatif)"} name="message">
            {(p) => <Textarea {...p} rows={4} maxLength={2000} required={Boolean(modal && LABELS[modal].needsMessage)} />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModal(null)}>
              Annuler
            </Button>
            <SubmitButton variant={modal === "DECLINED" ? "danger" : "primary"}>Confirmer</SubmitButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function EvaluationForm({ proposalId, opportunityId, score, note }: { proposalId: string; opportunityId: string; score: number | null; note: string | null }) {
  const [state, action] = useActionState(saveEvaluation, null);
  return (
    <form action={action} className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
      <input type="hidden" name="proposalId" value={proposalId} />
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <label className="text-xs font-semibold text-slate-600">
        Note /5
        <select name="score" defaultValue={score ?? ""} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm">
          <option value="">—</option>
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-600">
        Évaluation interne (non visible du fournisseur)
        <input name="note" defaultValue={note ?? ""} maxLength={5000} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm" />
      </label>
      <SubmitButton size="sm" variant="outline">
        Enregistrer
      </SubmitButton>
      {state && <p className={`text-xs sm:col-span-3 ${state.ok ? "text-teal-700" : "text-red-600"}`}>{state.ok ? state.message : state.error}</p>}
    </form>
  );
}

export function ContactSupplierButton({ opportunityId, supplierCompanyId, existingConversationId, label = "Contacter" }: { opportunityId: string; supplierCompanyId: string; existingConversationId?: string | null; label?: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(startConversation, null);
  if (existingConversationId)
    return (
      <Link href={`/dashboard/messages/${existingConversationId}`} className={buttonClasses({ size: "sm", variant: "outline" })}>
        <MessageSquare className="size-4" aria-hidden /> Conversation
      </Link>
    );
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <MessageSquare className="size-4" aria-hidden /> {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nouveau message">
        <form action={action} className="space-y-4">
          <input type="hidden" name="opportunityId" value={opportunityId} />
          <input type="hidden" name="supplierCompanyId" value={supplierCompanyId} />
          <Field label="Message" name="body" required>
            {(p) => <Textarea {...p} rows={5} maxLength={5000} />}
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
    </>
  );
}

export function DeleteDocumentButton({ docId, opportunityId }: { docId: string; opportunityId: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label="Supprimer le document"
      className="rounded p-1 text-slate-500 hover:text-red-600"
      onClick={() => {
        if (!confirm("Supprimer ce document ?")) return;
        start(async () => {
          const r = await deleteOpportunityDocument(docId, opportunityId);
          toast(r.ok ? (r.message ?? "OK") : r.error, r.ok ? "success" : "error");
          router.refresh();
        });
      }}
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}
