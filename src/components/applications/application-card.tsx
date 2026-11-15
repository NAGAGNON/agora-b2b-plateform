"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronDown, ExternalLink, FileText, Lightbulb, Send, ThumbsDown, Trophy } from "lucide-react";
import { cn } from "@/lib/cn";
import { APPLICATION_GUIDE, LOST_ADVICE } from "@/lib/application-guide";
import { answerApplicationResult, markApplicationSent, toggleGuideStep } from "@/app/actions/applications";

export type ApplicationCardData = {
  opportunityId: string;
  title: string;
  buyer: string | null;
  deadline: string | null;
  stage: string;
  submittedAt: string | null;
  guideDone: number[];
  briefTodo: { total: number; done: number };
  submission: string | null;
  submissionUrl: string | null;
  external: boolean;
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const nowMs = () => Date.now();

function countdown(deadline: string | null) {
  if (!deadline) return null;
  const days = Math.ceil((new Date(deadline).getTime() - nowMs()) / 86_400_000);
  if (days < 0) return { text: "Date limite dépassée", hot: false };
  if (days === 0) return { text: "Dernier jour pour déposer", hot: true };
  return { text: `Plus que ${days} jour${days > 1 ? "s" : ""} pour déposer`, hot: days <= 5 };
}

/** Une candidature : guide étape par étape, dépôt, résultat. */
export function ApplicationCard({ data }: { data: ApplicationCardData }) {
  const [done, setDone] = useState<number[]>(data.guideDone);
  const [stage, setStage] = useState(data.stage);
  const [open, setOpen] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const preparing = !["RESPONSE_SENT", "DISCUSSION", "NEGOTIATION", "WON", "LOST"].includes(stage);
  const progress = Math.round((done.length / APPLICATION_GUIDE.length) * 100);
  const cd = preparing ? countdown(data.deadline) : null;

  const toggle = (i: number, value: boolean) => {
    const before = done;
    setDone(value ? [...done, i].sort((a, b) => a - b) : done.filter((x) => x !== i));
    start(async () => {
      const r = await toggleGuideStep(data.opportunityId, i, value);
      if (r.ok) setDone(r.done);
      else {
        setDone(before);
        setError(r.error);
      }
    });
  };
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, next: string) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) setStage(next);
      else setError(r.error ?? "Réessayez.");
    });

  return (
    <article className="plan-in overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200" data-testid="application-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5">
        <div className="min-w-0 flex-1">
          <Link href={`/opportunites/${data.opportunityId}`} className="font-heading text-lg font-bold text-navy hover:underline">
            {data.title}
          </Link>
          <p className="mt-0.5 text-sm text-slate-500">
            {data.buyer ?? "Besoin publié sur LinkProB2B"}
            {data.deadline ? ` · date limite ${fmt(data.deadline)}` : ""}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-bold",
            stage === "WON" ? "bg-teal text-navy" : stage === "LOST" ? "bg-slate-100 text-slate-600" : preparing ? "bg-violet/10 text-violet" : "bg-navy text-white",
          )}
        >
          {stage === "WON" ? "Gagné" : stage === "LOST" ? "Pas retenu" : preparing ? "En préparation" : "Réponse envoyée"}
        </span>
      </div>

      {preparing && (
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-2.5 min-w-40 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-teal to-violet transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm font-semibold text-navy">
              {done.length}/{APPLICATION_GUIDE.length} étapes
            </p>
            {cd && <p className={cn("w-full text-sm font-semibold", cd.hot ? "text-rose-700" : "text-slate-600")}>{cd.text}</p>}
          </div>
          <ol className="mt-4 space-y-2">
            {APPLICATION_GUIDE.map((g, i) => {
              const checked = done.includes(i);
              const expanded = open === i;
              return (
                <li key={g.title} className={cn("rounded-xl ring-1 transition", checked ? "bg-slate-50 ring-slate-200" : "bg-white ring-slate-200")}>
                  <div className="flex items-center gap-3 p-3">
                    <label className="flex flex-1 cursor-pointer items-center gap-3">
                      <input type="checkbox" className="peer sr-only" checked={checked} disabled={pending} onChange={(e) => toggle(i, e.target.checked)} />
                      <span
                        className={cn(
                          "inline-flex size-6 shrink-0 items-center justify-center rounded-md ring-2 transition peer-focus-visible:ring-teal",
                          checked ? "bg-gradient-to-br from-teal to-violet text-white ring-transparent" : "bg-white text-transparent ring-slate-300",
                        )}
                      >
                        <Check className="size-4" aria-hidden />
                      </span>
                      <span className={cn("font-semibold", checked ? "text-slate-400 line-through" : "text-navy")}>
                        {i + 1}. {g.title}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setOpen(expanded ? null : i)}
                      aria-expanded={expanded}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-teal-700 hover:bg-teal-50"
                    >
                      Comment faire ? <ChevronDown className={cn("size-4 transition", expanded && "rotate-180")} aria-hidden />
                    </button>
                  </div>
                  {expanded && (
                    <div className="animate-rise border-t border-slate-100 px-4 py-3 text-sm text-slate-700">
                      <ul className="space-y-1.5">
                        {g.how.map((h) => (
                          <li key={h} className="flex gap-2">
                            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal" aria-hidden /> {h}
                          </li>
                        ))}
                      </ul>
                      {i === 1 && (data.submission || data.submissionUrl) && (
                        <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-teal-900">
                          Pour cette offre : {data.submission ?? "plateforme de l'acheteur"}
                          {data.submissionUrl && (
                            <a href={data.submissionUrl} target="_blank" rel="noopener noreferrer nofollow" className="ml-1 inline-flex items-center gap-1 font-semibold underline">
                              ouvrir <ExternalLink className="size-3.5" aria-hidden />
                            </a>
                          )}
                        </p>
                      )}
                      {i === 0 && data.external && (
                        <Link href={`/opportunites/${data.opportunityId}#fiche-synthese`} className="mt-3 inline-flex items-center gap-1.5 font-semibold text-teal-700 hover:underline">
                          <FileText className="size-4" aria-hidden /> Voir les conditions de cette offre
                          {data.briefTodo.total > 0 ? ` (à faire de la fiche : ${data.briefTodo.done}/${data.briefTodo.total})` : ""}
                        </Link>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            disabled={pending}
            onClick={() => act(() => markApplicationSent(data.opportunityId), "RESPONSE_SENT")}
            className="btn-shine mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 font-semibold text-white transition hover:bg-navy/90 disabled:opacity-50 sm:w-auto"
          >
            <Send className="size-4" aria-hidden /> J&apos;ai déposé ma réponse
          </button>
        </div>
      )}

      {(stage === "RESPONSE_SENT" || stage === "DISCUSSION" || stage === "NEGOTIATION") && (
        <div className="p-5">
          <p className="text-sm text-slate-600">
            Réponse envoyée{data.submittedAt ? ` le ${fmt(data.submittedAt)}` : ""}. Vous avez eu le résultat ?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => act(() => answerApplicationResult(data.opportunityId, "WON"), "WON")} className="inline-flex items-center gap-1.5 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-50">
              <Trophy className="size-4" aria-hidden /> Gagné
            </button>
            <button type="button" disabled={pending} onClick={() => act(() => answerApplicationResult(data.opportunityId, "LOST"), "LOST")} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50">
              <ThumbsDown className="size-4" aria-hidden /> Pas retenu
            </button>
          </div>
        </div>
      )}

      {stage === "WON" && <p className="p-5 text-sm font-semibold text-teal-800">Bravo pour ce marché ! Pensez à l&apos;ajouter à vos références sur votre fiche entreprise.</p>}

      {stage === "LOST" && (
        <div className="p-5">
          <p className="flex items-center gap-2 font-semibold text-navy">
            <Lightbulb className="size-4 text-teal-700" aria-hidden /> Pour progresser
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
            {LOST_ADVICE.map((a) => (
              <li key={a} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal" aria-hidden /> {a}
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="px-5 pb-4 text-sm text-rose-700">{error}</p>}
    </article>
  );
}
