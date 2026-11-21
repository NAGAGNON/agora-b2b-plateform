"use client";

import { useActionState, useState, useTransition } from "react";
import { cancelBoost, reviewBoost, reviewBoostAd, stopBoost, updateBoostAd } from "@/app/actions/visibility";
import { AD_LIMITS } from "@/lib/visibility";

export function CancelBoostButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => setMsg((await cancelBoost(id)).ok ? null : "Annulation impossible"))}
      className="text-sm font-semibold text-slate-500 underline-offset-2 hover:text-navy hover:underline disabled:opacity-50"
    >
      {msg ?? (pending ? "Annulation…" : "Annuler")}
    </button>
  );
}

/** Validation par l'équipe (administration). */
export function ReviewBoostButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  if (msg) return <p className="text-sm font-semibold text-navy">{msg}</p>;
  const run = (approve: boolean) =>
    start(async () => {
      const r = await reviewBoost(id, approve, note);
      setMsg(r.ok ? (r.message ?? "Fait") : r.error);
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (motif si refus)"
        aria-label="Note"
        className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
      />
      <button type="button" disabled={pending} onClick={() => run(true)} className="h-9 rounded-lg bg-teal px-3 text-sm font-semibold text-navy disabled:opacity-50">
        Valider et démarrer
      </button>
      <button type="button" disabled={pending} onClick={() => run(false)} className="h-9 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 disabled:opacity-50">
        Refuser
      </button>
    </div>
  );
}

/** Arrêt d'une offre en cours (administration), avec confirmation. */
export function StopBoostButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  if (msg) return <p className="text-sm font-semibold text-navy">{msg}</p>;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Arrêter cette offre de visibilité ? Plus aucune présentation ne sera envoyée.")) return;
        start(async () => {
          const r = await stopBoost(id);
          setMsg(r.ok ? (r.message ?? "Fait") : r.error);
        });
      }}
      className="h-9 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? "Arrêt…" : "Arrêter"}
    </button>
  );
}

/** Relecture de l'annonce d'une campagne (équipe) : valider = les e-mails partent ; à corriger = motif transmis. */
export function ReviewAdButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  if (msg) return <p className="text-sm font-semibold text-navy">{msg}</p>;
  const run = (approve: boolean) =>
    start(async () => {
      const r = await reviewBoostAd(id, approve, note);
      setMsg(r.ok ? (r.message ?? "Fait") : r.error);
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} onClick={() => run(true)} className="h-9 rounded-lg bg-teal px-3 text-sm font-semibold text-navy disabled:opacity-50">
        Valider l&apos;annonce
      </button>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ce qu'il faut corriger" aria-label="Ce qu'il faut corriger" className="h-9 min-w-48 flex-1 rounded-lg border border-slate-300 px-2 text-sm" />
      <button type="button" disabled={pending} onClick={() => run(false)} className="h-9 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 disabled:opacity-50">
        À corriger
      </button>
    </div>
  );
}

/** Correction de l'annonce d'une campagne par l'entreprise. */
export function EditAdForm({ id, title, points, text }: { id: string; title: string; points: string[]; text: string | null }) {
  const [state, action, pending] = useActionState(updateBoostAd, null);
  if (state?.ok) return <p className="text-sm font-semibold text-teal-700">{state.message}</p>;
  const field = "w-full rounded-xl border border-slate-300 px-3 text-sm text-navy focus:border-teal focus:ring-2 focus:ring-teal/30 focus:outline-none";
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="id" value={id} />
      <input name="ad_title" defaultValue={title} maxLength={AD_LIMITS.title} aria-label="Titre de l'annonce" className={`${field} h-10`} />
      {[0, 1, 2].map((i) => (
        <input key={i} name="ad_point" defaultValue={points[i] ?? ""} maxLength={AD_LIMITS.point} aria-label={`Point fort ${i + 1}`} className={`${field} h-9`} />
      ))}
      <textarea name="ad_text" defaultValue={text ?? ""} maxLength={AD_LIMITS.text} rows={5} aria-label="Présentation" className={`${field} py-2`} />
      {state && !state.ok && <p className="text-sm text-rose-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="h-10 rounded-xl bg-navy px-4 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "Envoi…" : "Renvoyer en relecture"}
      </button>
    </form>
  );
}
