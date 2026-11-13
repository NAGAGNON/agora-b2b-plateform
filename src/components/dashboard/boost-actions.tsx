"use client";

import { useState, useTransition } from "react";
import { cancelBoost, reviewBoost } from "@/app/actions/visibility";

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
