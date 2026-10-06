"use client";

import { useActionState, useEffect, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, GripVertical, NotebookPen, Trash2 } from "lucide-react";
import { movePipelineItem, removePipelineItem, updatePipelineItem } from "@/app/actions/opportunities";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import { OriginBadge } from "@/components/opportunities/opportunity-badge";
import { DemoBadge } from "@/components/demo";
import { PIPELINE_STAGES, type OpportunityOrigin, type OpportunityType, type PipelineStage } from "@/lib/constants";
import { deadlineLabel, formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";

export type PipelineCard = {
  id: string;
  stage: PipelineStage;
  notes: string | null;
  next_action: string | null;
  next_action_at: string | null;
  estimated_value: number | null;
  updated_at: string;
  opportunity: { id: string; title: string; origin: OpportunityOrigin; type: OpportunityType; response_deadline: string | null; is_demo: boolean; status: string } | null;
};

const STAGE_TONE: Record<PipelineStage, string> = {
  DETECTED: "border-t-slate-400",
  QUALIFIED: "border-t-sky-400",
  INTERESTED: "border-t-teal",
  RESPONSE_PREPARING: "border-t-amber-400",
  RESPONSE_SENT: "border-t-violet-400",
  DISCUSSION: "border-t-cyan-500",
  NEGOTIATION: "border-t-orange-500",
  WON: "border-t-emerald-500",
  LOST: "border-t-red-400",
};

/** Pipeline ingénieur d'affaires — glisser-déposer (souris) ou liste déroulante (clavier, mobile). */
export function PipelineBoard({ items }: { items: PipelineCard[] }) {
  const [optimistic, applyMove] = useOptimistic(items, (state, m: { id: string; stage: PipelineStage }) => state.map((i) => (i.id === m.id ? { ...i, stage: m.stage } : i)));
  const [, start] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PipelineCard | null>(null);
  const toast = useToast();
  const router = useRouter();

  const move = (id: string, stage: PipelineStage) =>
    start(async () => {
      applyMove({ id, stage });
      const r = await movePipelineItem(id, stage);
      if (!r.ok) toast(r.error, "error");
      router.refresh();
    });

  return (
    <>
      <div className="relative -mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        <div className="flex gap-3 lg:min-w-max">
          {PIPELINE_STAGES.map((s) => {
            const cards = optimistic.filter((i) => i.stage === s.stage);
            return (
              <section
                key={s.stage}
                aria-labelledby={`col-${s.stage}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId) move(dragId, s.stage);
                  setDragId(null);
                }}
                className={cn("flex w-72 shrink-0 flex-col rounded-2xl border border-t-4 border-slate-200 bg-slate-50", STAGE_TONE[s.stage])}
              >
                <h2 id={`col-${s.stage}`} className="flex items-center justify-between px-3 py-2.5 text-sm font-bold text-navy">
                  {s.label}
                  <span className="rounded-full bg-white px-2 text-xs text-slate-600 ring-1 ring-slate-200">{cards.length}</span>
                </h2>
                <ul className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
                  {cards.map((c) => (
                    <li
                      key={c.id}
                      draggable
                      onDragStart={() => setDragId(c.id)}
                      className="cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing"
                    >
                      <div className="flex items-start gap-1.5">
                        <GripVertical className="mt-0.5 hidden size-4 shrink-0 text-slate-300 lg:block" aria-hidden />
                        <div className="min-w-0 flex-1">
                          {c.opportunity ? (
                            <>
                              <div className="mb-1 flex flex-wrap gap-1">
                                <OriginBadge origin={c.opportunity.origin} type={c.opportunity.type} />
                                {c.opportunity.is_demo && <DemoBadge />}
                              </div>
                              <Link href={`/opportunites/${c.opportunity.id}`} className="line-clamp-3 text-sm font-semibold text-navy hover:text-teal-700">
                                {c.opportunity.title}
                              </Link>
                              {c.opportunity.response_deadline && (
                                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                                  <CalendarClock className="size-3" aria-hidden /> {deadlineLabel(c.opportunity.response_deadline)}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-slate-500">Opportunité supprimée</p>
                          )}
                          {c.estimated_value != null && <p className="mt-1 text-xs font-semibold text-navy">{formatMoney(c.estimated_value)}</p>}
                          {c.next_action && (
                            <p className="mt-1 text-xs text-amber-800">
                              → {c.next_action}
                              {c.next_action_at ? ` (${formatDate(c.next_action_at)})` : ""}
                            </p>
                          )}
                          {c.notes && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{c.notes}</p>}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1 border-t border-slate-100 pt-2">
                        <label className="sr-only" htmlFor={`stage-${c.id}`}>
                          Étape
                        </label>
                        <select
                          id={`stage-${c.id}`}
                          value={c.stage}
                          onChange={(e) => move(c.id, e.target.value as PipelineStage)}
                          className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-1.5 text-xs font-semibold text-navy"
                        >
                          {PIPELINE_STAGES.map((x) => (
                            <option key={x.stage} value={x.stage}>
                              {x.label}
                            </option>
                          ))}
                        </select>
                        <button type="button" onClick={() => setEditing(c)} className="rounded p-1.5 text-slate-500 hover:bg-sky hover:text-navy" aria-label="Notes et prochaine action">
                          <NotebookPen className="size-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!confirm("Retirer cette opportunité du pipeline ?")) return;
                            start(async () => {
                              const r = await removePipelineItem(c.id);
                              toast(r.ok ? (r.message ?? "OK") : r.error, r.ok ? "success" : "error");
                              router.refresh();
                            });
                          }}
                          className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          aria-label="Retirer du pipeline"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
      {editing && <EditModal card={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function EditModal({ card, onClose }: { card: PipelineCard; onClose: () => void }) {
  const [state, action] = useActionState(updatePipelineItem, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      onClose();
      router.refresh();
    }
  }, [state, onClose, router]);
  return (
    <Modal open onClose={onClose} title="Suivi de l'opportunité" description={card.opportunity?.title}>
      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={card.id} />
        <input type="hidden" name="stage" value={card.stage} />
        <Field label="Notes privées" name="notes">
          {(p) => <Textarea {...p} defaultValue={card.notes ?? ""} rows={4} maxLength={5000} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prochaine action" name="nextAction">
            {(p) => <Input {...p} defaultValue={card.next_action ?? ""} maxLength={300} placeholder="ex. Relancer le demandeur" />}
          </Field>
          <Field label="Date" name="nextActionAt">
            {(p) => <Input {...p} type="date" defaultValue={card.next_action_at ?? ""} />}
          </Field>
        </div>
        <Field label="Valeur estimée (€ HT)" name="estimatedValue">
          {(p) => <Input {...p} type="number" min={0} step="100" defaultValue={card.estimated_value ?? ""} />}
        </Field>
        {state && !state.ok && <Notice tone="error">{state.error}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <SubmitButton>Enregistrer</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
