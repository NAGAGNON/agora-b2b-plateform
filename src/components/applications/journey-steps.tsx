"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, CircleHelp, CircleSlash, History, Loader2, MessageSquarePlus, Send, Trophy, XCircle } from "lucide-react";
import { addJourneyResult, saveJourney } from "@/app/actions/applications";
import {
  CHECK_LABEL,
  CHECK_STATUSES,
  RESULT_LABEL,
  RESULT_STATUSES,
  SUBMISSION_LABEL,
  SUBMISSION_STATUSES,
  checkSummary,
  type CheckStatus,
  type Checks,
  type Journey,
  type ResultEntry,
  type ResultStatus,
  type Submission,
} from "@/lib/journey";
import { cn } from "@/lib/cn";

const TONE: Record<CheckStatus, { on: string; icon: typeof CheckCircle2 }> = {
  yes: { on: "bg-teal-600 text-white ring-teal-600", icon: CheckCircle2 },
  no: { on: "bg-rose-600 text-white ring-rose-600", icon: XCircle },
  check: { on: "bg-violet-600 text-white ring-violet-600", icon: CircleHelp },
  na: { on: "bg-slate-500 text-white ring-slate-500", icon: CircleSlash },
};

/**
 * Liste de points à vérifier (étape 1 : conditions de l'acheteur ; étape 3 : vos moyens).
 * Enregistrement automatique à chaque choix ; une note facultative par point.
 */
export function ChecksList({
  opportunityId,
  section,
  items,
  initial,
  onSaved,
  empty,
}: {
  opportunityId: string;
  section: "eligibility" | "capacities";
  items: { key: string; label: string }[];
  initial: Checks | undefined;
  onSaved?: (j: Journey) => void;
  empty?: string;
}) {
  const [checks, setChecks] = useState<Checks>(initial ?? {});
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const save = (next: Checks) => {
    const before = checks;
    setChecks(next);
    setError(null);
    start(async () => {
      const r = await saveJourney(opportunityId, section, next).catch(() => ({ ok: false as const, error: "Connexion perdue. Réessayez." }));
      if (!r.ok) {
        setChecks(before);
        setError(r.error);
      } else {
        setSavedAt(Date.now());
        onSaved?.(r.journey);
      }
    });
  };
  if (!items.length) return empty ? <p className="text-sm text-slate-600">{empty}</p> : null;
  const sum = checkSummary(
    items.map((i) => i.key),
    checks,
  );
  return (
    <div className="space-y-3" data-testid={`checks-${section}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="rounded-full bg-teal-50 px-2.5 py-1 text-teal-800 ring-1 ring-teal/30">{sum.yes} vérifié{sum.yes > 1 ? "s" : ""}</span>
        <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-800 ring-1 ring-rose-200">{sum.no} manquant{sum.no > 1 ? "s" : ""}</span>
        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-800 ring-1 ring-violet-200">{sum.check} à vérifier</span>
        {sum.open > 0 && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{sum.open} sans réponse</span>}
        <span className="ml-auto inline-flex items-center gap-1 text-slate-500" aria-live="polite">
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : savedAt ? <CheckCircle2 className="size-3.5 text-teal-600" aria-hidden /> : null}
          {pending ? "Enregistrement…" : savedAt ? "Enregistré" : ""}
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((it, idx) => {
          const cur = checks[it.key];
          return (
            <li key={it.key} className="plan-in rounded-2xl bg-white p-3 ring-1 ring-slate-200 transition hover:ring-teal/40" style={{ animationDelay: `${idx * 40}ms` }}>
              <p className="text-sm font-semibold text-navy">{it.label}</p>
              <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={it.label}>
                {CHECK_STATUSES.map((s) => {
                  const Icon = TONE[s].icon;
                  const on = cur?.s === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={pending}
                      onClick={() => save({ ...checks, [it.key]: { s, ...(cur?.note ? { note: cur.note } : {}) } })}
                      className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition active:scale-95", on ? TONE[s].on : "bg-white text-slate-600 ring-slate-200 hover:ring-teal")}
                    >
                      <Icon className="size-3.5" aria-hidden /> {CHECK_LABEL[s]}
                    </button>
                  );
                })}
                <button type="button" onClick={() => setNoteOpen(noteOpen === it.key ? null : it.key)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-teal-700">
                  <MessageSquarePlus className="size-3.5" aria-hidden /> {cur?.note ? "Note" : "Ajouter une note"}
                </button>
              </div>
              {cur?.note && noteOpen !== it.key && <p className="mt-2 text-xs text-slate-600">{cur.note}</p>}
              {noteOpen === it.key && (
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const note = String(new FormData(e.currentTarget).get("note") ?? "").slice(0, 300);
                    save({ ...checks, [it.key]: { s: cur?.s ?? "check", ...(note.trim() ? { note: note.trim() } : {}) } });
                    setNoteOpen(null);
                  }}
                >
                  <input name="note" defaultValue={cur?.note ?? ""} maxLength={300} autoFocus placeholder="Ex. : attestation à demander à l'assureur" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  <button type="submit" className="rounded-xl bg-navy px-3 py-2 text-sm font-semibold text-white">
                    OK
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
      {sum.no > 0 && (
        <p className="rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-900 ring-1 ring-violet-200">
          Il vous manque quelque chose ? Vous pouvez répondre avec une autre entreprise (groupement) ou lui confier une partie du travail (sous-traitance).
        </p>
      )}
      {error && <p className="text-sm text-rose-700">{error}</p>}
    </div>
  );
}

/** Étape 6 : où en est le dépôt (date, plateforme, référence quand c'est déposé). */
export function SubmissionForm({ opportunityId, initial, onSaved }: { opportunityId: string; initial: Submission | undefined; onSaved?: (j: Journey) => void }) {
  const [status, setStatus] = useState<Submission["status"]>(initial?.status ?? "preparing");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      data-testid="submission-form"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const value = { status, date: String(fd.get("date") ?? ""), platform: String(fd.get("platform") ?? "").trim() || undefined, reference: String(fd.get("reference") ?? "").trim() || undefined };
        start(async () => {
          const r = await saveJourney(opportunityId, "submission", value).catch(() => ({ ok: false as const, error: "Connexion perdue. Réessayez." }));
          setMsg(r.ok ? (status === "submitted" ? "Bravo ! Le dépôt est enregistré : suivez maintenant le résultat à l'étape 7." : "Enregistré.") : r.error);
          if (r.ok) onSaved?.(r.journey);
        });
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {SUBMISSION_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={cn(
              "rounded-2xl px-4 py-3 text-left text-sm font-semibold ring-1 transition hover:-translate-y-0.5",
              status === s ? (s === "dropped" ? "bg-slate-700 text-white ring-slate-700" : "bg-gradient-to-r from-teal to-electric text-navy ring-transparent shadow-md") : "bg-white text-navy ring-slate-200",
            )}
          >
            {SUBMISSION_LABEL[s]}
          </button>
        ))}
      </div>
      {status === "submitted" && (
        <div className="grid animate-rise gap-2 sm:grid-cols-3">
          <label className="text-xs font-semibold text-slate-600">
            Date du dépôt
            <input type="date" name="date" defaultValue={initial?.date ?? ""} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Plateforme utilisée
            <input name="platform" defaultValue={initial?.platform ?? ""} maxLength={120} placeholder="Ex. : PLACE, AWS, Maximilien…" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Référence de dépôt
            <input name="reference" defaultValue={initial?.reference ?? ""} maxLength={120} placeholder="Accusé de réception" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>
        </div>
      )}
      <p className="text-xs text-slate-500">Le dépôt se fait sur le site de l&apos;acheteur : LinkProB2B ne dépose rien à votre place.</p>
      <button type="submit" disabled={pending} className="btn-shine inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-navy px-5 py-3 font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-50">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />} Enregistrer où j&apos;en suis
      </button>
      {msg && <p className="text-sm font-semibold text-teal-800" aria-live="polite">{msg}</p>}
    </form>
  );
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** Étape 7 : suivi du résultat, avec l'historique de chaque nouvelle. */
export function ResultTracker({ opportunityId, initial, enabled }: { opportunityId: string; initial: ResultEntry[]; enabled: boolean }) {
  const [results, setResults] = useState<ResultEntry[]>(initial);
  const [status, setStatus] = useState<ResultStatus>("waiting");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!enabled) return <p className="text-sm text-slate-600">Cette étape s&apos;ouvre dès que votre candidature est déposée (étape 6).</p>;
  const final = status === "accepted" || status === "rejected" || status === "other_winner";
  return (
    <div className="space-y-4" data-testid="result-tracker">
      {results.length > 0 && (
        <ol className="space-y-2">
          {[...results].reverse().map((r, i) => (
            <li key={r.at + i} className="flex gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
              {r.status === "accepted" ? <Trophy className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden /> : <History className="mt-0.5 size-5 shrink-0 text-slate-500" aria-hidden />}
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-navy">{RESULT_LABEL[r.status]}</p>
                <p className="text-xs text-slate-500">{fmt(r.date ? `${r.date}T12:00:00` : r.at)}</p>
                {r.comment && <p className="mt-1 text-slate-700">{r.comment}</p>}
                {r.reason && <p className="mt-1 text-slate-700">Motif : {r.reason}</p>}
                {r.amount !== undefined && <p className="mt-1 font-semibold text-teal-800">Montant : {r.amount.toLocaleString("fr-FR")} €</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
      <form
        className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const amount = Number(String(fd.get("amount") ?? "").replace(/\s/g, "").replace(",", "."));
          const value = {
            status,
            date: String(fd.get("date") ?? ""),
            comment: String(fd.get("comment") ?? "").trim() || undefined,
            reason: String(fd.get("reason") ?? "").trim() || undefined,
            ...(Number.isFinite(amount) && amount > 0 ? { amount } : {}),
          };
          setError(null);
          start(async () => {
            const r = await addJourneyResult(opportunityId, value).catch(() => ({ ok: false as const, error: "Connexion perdue. Réessayez." }));
            if (r.ok) {
              setResults(r.journey.results ?? []);
              (e.target as HTMLFormElement).reset();
            } else setError(r.error);
          });
        }}
      >
        <p className="text-sm font-bold text-navy">Une nouvelle ? Notez-la ici</p>
        <select value={status} onChange={(e) => setStatus(e.target.value as ResultStatus)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" aria-label="Où en est votre candidature">
          {RESULT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {RESULT_LABEL[s]}
            </option>
          ))}
        </select>
        <div className="grid gap-2 sm:grid-cols-2">
          <input type="date" name="date" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" aria-label="Date" />
          {status === "accepted" ? (
            <input name="amount" inputMode="decimal" placeholder="Montant du marché (€), si connu" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          ) : status === "rejected" || status === "other_winner" ? (
            <input name="reason" maxLength={300} placeholder="Motif communiqué, si connu" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          ) : null}
        </div>
        <textarea name="comment" rows={2} maxLength={500} placeholder="Commentaire (facultatif)" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        <button type="submit" disabled={pending} className={cn("inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 font-bold transition hover:-translate-y-0.5 disabled:opacity-50", final ? "bg-gradient-to-r from-teal to-electric text-navy" : "bg-navy text-white")}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Enregistrer
        </button>
        {error && <p className="text-sm text-rose-700">{error}</p>}
      </form>
    </div>
  );
}
