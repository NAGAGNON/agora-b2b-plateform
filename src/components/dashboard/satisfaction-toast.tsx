"use client";

import { useEffect, useState, useTransition } from "react";
import { Star, X } from "lucide-react";
import { answerSatisfaction } from "@/app/actions/testimonials";

const KEY = "lpb-satisfaction-later";

/** Petite carte en bas d'écran : « Vous appréciez LinkProB2B ? » Oui / Non. Fermée (croix) : reposée 3 jours plus tard. */
export function SatisfactionToast() {
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    let later = 0;
    try {
      later = Number(localStorage.getItem(KEY) ?? 0);
    } catch {}
    if (Date.now() < later) return;
    const t = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, String(Date.now() + 3 * 86_400_000));
    } catch {}
    setShow(false);
  };
  const answer = (liked: boolean) =>
    start(async () => {
      await answerSatisfaction(liked);
      setDone(true);
      setTimeout(() => setShow(false), 2500);
    });

  return (
    <div role="dialog" aria-label="Votre avis" className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-slate-200 sm:right-6 sm:left-auto sm:mx-0" data-testid="satisfaction-toast">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-teal text-navy">
          <Star className="size-6 fill-current" aria-hidden />
        </span>
        <div className="flex-1">
          <p className="font-bold text-navy">{done ? "Merci !" : "Vous appréciez LinkProB2B ?"}</p>
          <p className="text-sm text-slate-500">{done ? "Nous améliorons le site chaque jour." : "Une réponse, un clic."}</p>
        </div>
        <button type="button" onClick={close} aria-label="Fermer" className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      {!done && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" disabled={pending} onClick={() => answer(false)} className="h-11 rounded-2xl bg-slate-100 font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-60">
            Non
          </button>
          <button type="button" disabled={pending} onClick={() => answer(true)} className="h-11 rounded-2xl bg-navy font-semibold text-white transition hover:bg-navy-900 disabled:opacity-60">
            Oui
          </button>
        </div>
      )}
    </div>
  );
}
