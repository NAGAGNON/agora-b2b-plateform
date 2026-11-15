"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, KanbanSquare, PartyPopper, Sparkles, ThumbsDown, Trophy, X } from "lucide-react";
import { answerApplicationPrompt, answerApplicationResult, nextApplicationPrompt, type ApplicationPrompt } from "@/app/actions/applications";

const CLOSED_KEY = "lp-application-prompt-closed";
const REASONS = ["Certification ou qualification manquante", "Trop loin", "Trop gros pour nous", "Pas mon métier", "Délai trop court"];

/**
 * Au retour sur le site après avoir consulté une annonce officielle : « Cet appel d'offres vous
 * intéresse ? » (la personne est souvent en repérage). Oui : suivi dans le pipeline, ou guide pour
 * gagner dans « Mes candidatures ». Discret, une question à la fois, fermable.
 */
export function ApplicationPromptCard() {
  const pathname = usePathname();
  const [prompt, setPrompt] = useState<ApplicationPrompt | null>(null);
  const [step, setStep] = useState<"ask" | "reasons" | "done-interested" | "done-preparing" | "done-won" | "done-lost">("ask");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (/^\/(admin|outreach)/.test(pathname)) return;
    try {
      if (sessionStorage.getItem(CLOSED_KEY)) return;
    } catch {
      // stockage indisponible : la question peut s'afficher
    }
    let live = true;
    nextApplicationPrompt()
      .then((p) => live && setPrompt(p))
      .catch(() => {});
    return () => {
      live = false;
    };
    // Une seule vérification par chargement de page complet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!prompt) return null;
  const close = () => {
    try {
      sessionStorage.setItem(CLOSED_KEY, "1");
    } catch {
      // ignoré
    }
    setPrompt(null);
  };
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, next: typeof step | null) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Réessayez.");
      else if (next) setStep(next);
      else close();
    });
  const id = prompt.opportunityId;
  const btn = "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50";

  return (
    <div
      role="dialog"
      aria-labelledby="application-prompt-title"
      className="fixed bottom-20 left-4 right-4 z-50 animate-pop sm:right-auto sm:bottom-4 sm:w-[24rem] print:hidden"
      data-testid="application-prompt"
    >
      <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-gradient-to-br from-teal/25 to-violet/20 blur-2xl" />
        <button type="button" onClick={close} aria-label="Fermer" className="absolute top-3 right-3 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-navy">
          <X className="size-4" aria-hidden />
        </button>
        <div className="relative">
          {step === "ask" && (
            <>
              <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-teal-700 uppercase">
                {prompt.kind === "result" ? <Trophy className="size-4" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
                {prompt.kind === "result" ? "Résultat de votre réponse" : "Appel d'offres consulté"}
              </p>
              <p id="application-prompt-title" className="mt-2 pr-6 font-heading text-lg leading-snug font-bold text-navy">
                {prompt.kind === "result" ? "Avez-vous eu le résultat pour" : "Cet appel d'offres vous intéresse ?"}
                {prompt.kind === "result" && <> « {prompt.title.length > 90 ? `${prompt.title.slice(0, 88)}…` : prompt.title} » ?</>}
              </p>
              {prompt.kind === "apply" && <p className="mt-1 text-sm font-semibold text-slate-700">{prompt.title.length > 110 ? `${prompt.title.slice(0, 108)}…` : prompt.title}</p>}
              {prompt.buyer && <p className="mt-0.5 text-sm text-slate-500">{prompt.buyer}</p>}
              {prompt.kind === "apply" ? (
                <div className="mt-4 grid gap-2">
                  <button type="button" disabled={pending} onClick={() => run(() => answerApplicationPrompt(id, "PREPARING"), "done-preparing")} className={`${btn} btn-shine bg-navy text-white hover:bg-navy/90`}>
                    <Trophy className="size-4" aria-hidden /> Oui, me guider pour le gagner
                  </button>
                  <button type="button" disabled={pending} onClick={() => run(() => answerApplicationPrompt(id, "INTERESTED"), "done-interested")} className={`${btn} bg-teal text-navy hover:bg-teal/90`}>
                    <KanbanSquare className="size-4" aria-hidden /> Oui, l&apos;ajouter à mon suivi
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={pending} onClick={() => setStep("reasons")} className={`${btn} text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50`}>
                      Pas pour moi
                    </button>
                    <button type="button" disabled={pending} onClick={() => run(() => answerApplicationPrompt(id, "LATER"), null)} className={`${btn} text-slate-500 hover:bg-slate-50`}>
                      Plus tard
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid gap-2">
                  <button type="button" disabled={pending} onClick={() => run(() => answerApplicationResult(id, "WON"), "done-won")} className={`${btn} bg-navy text-white hover:bg-navy/90`}>
                    <Trophy className="size-4" aria-hidden /> Gagné
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={pending} onClick={() => run(() => answerApplicationResult(id, "LOST"), "done-lost")} className={`${btn} text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50`}>
                      <ThumbsDown className="size-4" aria-hidden /> Pas retenu
                    </button>
                    <button type="button" disabled={pending} onClick={() => run(() => answerApplicationResult(id, "WAITING"), null)} className={`${btn} text-slate-500 hover:bg-slate-50`}>
                      Toujours en attente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {step === "reasons" && (
            <>
              <p id="application-prompt-title" className="pr-6 font-heading text-lg font-bold text-navy">
                Pourquoi pas celle-ci ?
              </p>
              <p className="mt-1 text-sm text-slate-500">Facultatif : cela nous aide à vous proposer de meilleures offres.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {REASONS.map((r) => (
                  <button key={r} type="button" disabled={pending} onClick={() => run(() => answerApplicationPrompt(id, "NOT_FOR_ME", r), null)} className="rounded-full bg-slate-50 px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-200 transition hover:ring-teal">
                    {r}
                  </button>
                ))}
                <button type="button" disabled={pending} onClick={() => run(() => answerApplicationPrompt(id, "NOT_FOR_ME"), null)} className="rounded-full px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50">
                  Passer
                </button>
              </div>
            </>
          )}
          {step.startsWith("done") && (
            <div className="text-center">
              {step === "done-won" ? (
                <PartyPopper className="mx-auto size-8 text-teal-700" aria-hidden />
              ) : (
                <CheckCircle2 className="mx-auto size-8 text-teal-700" aria-hidden />
              )}
              <p id="application-prompt-title" className="mt-2 font-heading text-lg font-bold text-navy">
                {step === "done-won" ? "Bravo pour ce marché !" : step === "done-lost" ? "Merci, c'est noté." : "C'est noté !"}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {step === "done-interested"
                  ? "L'appel d'offres est dans votre pipeline. Quand vous décidez d'y répondre, le guide vous accompagne jusqu'au dépôt."
                  : step === "done-preparing"
                    ? "Suivez le guide étape par étape : conditions, dossier, pièces, mémoire technique et dépôt."
                    : step === "done-won"
                      ? "Retrouvez-le dans « Mes candidatures »."
                      : "Découvrez comment obtenir les motifs du rejet pour progresser."}
              </p>
              <Link
                href={step === "done-interested" ? "/dashboard/pipeline" : step === "done-preparing" ? `/dashboard/candidatures/${id}` : "/dashboard/candidatures"}
                onClick={close}
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy/90"
              >
                {step === "done-interested" ? "Voir mon pipeline" : "Commencer le guide"}
              </Link>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
        </div>
      </div>
    </div>
  );
}
