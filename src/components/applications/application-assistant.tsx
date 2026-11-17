"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowUp,
  Copy,
  MessageCircleQuestion,
  Sparkles,
  X,
} from "lucide-react";
import {
  askApplicationQuestion,
  type AssistantMessage,
} from "@/app/actions/application-assistant";
import { cn } from "@/lib/cn";

/**
 * Assistant d'une candidature : la personne pose ses questions sur cet appel d'offres (pièces, notation,
 * groupement, visite…) et reçoit une réponse tirée de l'avis officiel et de sa fiche entreprise.
 * Encart dans la page + bouton flottant, qui ouvrent le même panneau de discussion.
 */
export function ApplicationAssistant({
  id,
  initial,
  suggestions,
  backTo,
}: {
  id: string;
  initial: AssistantMessage[];
  suggestions: string[];
  /** Après une réponse : ramener la personne à l'étape de sa candidature où elle en est. */
  backTo?: { label: string; onBack: () => void };
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>(initial);
  const [text, setText] = useState("");
  const [waiting, setWaiting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  // Panneau et bouton rendus à la racine de la page : au-dessus de l'en-tête du site
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [open, messages.length, waiting]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const ask = (q: string) => {
    const question = q.trim();
    if (question.length < 3 || pending) return;
    setOpen(true);
    setError(null);
    setWaiting(question);
    setText("");
    start(async () => {
      const r = await askApplicationQuestion(id, question);
      setWaiting(null);
      if (r.ok) setMessages((m) => [...m, r.message]);
      else {
        setError(r.error);
        setText(question);
      }
    });
  };
  const openPanel = () => {
    setOpen(true);
    setTimeout(() => input.current?.focus(), 250);
  };

  return (
    <>
      {/* Rappel discret dans la page : une ligne */}
      <button
        type="button"
        onClick={openPanel}
        data-testid="assistant-card"
        className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left text-sm shadow-sm ring-1 ring-slate-200 transition hover:ring-violet-300"
      >
        <MessageCircleQuestion className="size-5 shrink-0 text-violet-600" aria-hidden />
        <span className="min-w-0 flex-1 text-slate-600">
          Une question sur cet appel d&apos;offres ? <span className="font-semibold text-navy">L&apos;assistant vous répond.</span>
        </span>
        <Sparkles className="size-4 shrink-0 text-teal-600" aria-hidden />
      </button>

      {mounted &&
        createPortal(
          <>
            {/* Petit bouton rond, toujours à portée de main */}
            {!open && (
              <button
                type="button"
                onClick={openPanel}
                data-testid="assistant-fab"
                aria-label="Une question sur cet appel d'offres ?"
                title="Une question sur cet appel d'offres ?"
                className="fixed right-4 bottom-4 z-[60] flex size-10 animate-rise items-center justify-center rounded-full bg-gradient-to-br from-violet to-teal text-white shadow-lg shadow-violet/25 transition hover:scale-105 active:scale-95 sm:right-6 sm:bottom-6"
              >
                <MessageCircleQuestion className="size-5" aria-hidden />
              </button>
            )}

            {/* Panneau de discussion */}
            <div
              className={cn(
                "fixed inset-0 z-[100] transition",
                open ? "pointer-events-auto" : "pointer-events-none",
              )}
              aria-hidden={!open}
            >
              <div
                className={cn(
                  "absolute inset-0 bg-navy/30 backdrop-blur-[2px] transition-opacity duration-300",
                  open ? "opacity-100" : "opacity-0",
                )}
                onClick={() => setOpen(false)}
              />
              <aside
                role="dialog"
                aria-modal="true"
                aria-label="Assistant de candidature"
                data-testid="assistant-panel"
                className={cn(
                  "absolute top-0 right-0 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl transition-transform duration-300 ease-out",
                  open ? "translate-x-0" : "translate-x-full",
                )}
              >
                <header className="relative overflow-hidden bg-gradient-to-br from-navy to-navy-900 px-6 py-5 text-white">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -top-16 -right-10 size-40 animate-aurora rounded-full bg-teal/30 blur-3xl"
                  />
                  <div className="relative flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                      <Sparkles className="size-5 text-teal-200" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-heading text-lg font-bold">
                        Assistant de candidature
                      </p>
                      <p className="text-sm text-white/70">
                        Réponses tirées de l&apos;avis officiel et de votre
                        fiche entreprise.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
                      aria-label="Fermer"
                    >
                      <X className="size-5" aria-hidden />
                    </button>
                  </div>
                </header>

                <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50/60 px-5 py-6">
                  {messages.length === 0 && !waiting && (
                    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                      <p className="font-semibold text-navy">Bonjour 👋</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Posez une question sur cet appel d&apos;offres : pièces
                        à fournir, notation, visite, groupement, sous-traitance,
                        comment rédiger le mémoire technique… Exemples :
                      </p>
                      <div className="mt-3 flex flex-col gap-2">
                        {suggestions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => ask(s)}
                            className="rounded-xl bg-slate-50 px-3 py-2 text-left text-sm font-medium text-navy ring-1 ring-slate-200 transition hover:bg-violet-50 hover:ring-violet-300"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {messages.map((m) => (
                    <Exchange
                      key={m.id}
                      question={m.question}
                      answer={m.answer}
                    />
                  ))}
                  {waiting && <Exchange question={waiting} answer={null} />}
                  {/* Réponse reçue : retour direct à la candidature, à l'étape en cours */}
                  {!waiting && messages.length > 0 && backTo && (
                    <div className="animate-rise rounded-2xl bg-gradient-to-br from-teal-50 to-white p-4 ring-1 ring-teal/30" data-testid="assistant-back">
                      <p className="text-sm text-slate-600">C&apos;est plus clair ? Revenez à votre candidature pour avancer.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          setTimeout(backTo.onBack, 320);
                        }}
                        className="btn-shine mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-navy/20 transition hover:-translate-y-0.5 active:scale-[0.98]"
                      >
                        <ArrowLeft className="size-4" aria-hidden /> Retour à ma candidature
                      </button>
                      <p className="mt-2 text-center text-xs font-medium text-teal-800">{backTo.label}</p>
                    </div>
                  )}
                  {error && (
                    <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
                      {error}
                    </p>
                  )}
                  <div ref={end} />
                </div>

                <form
                  className="border-t border-slate-200 bg-white p-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    ask(text);
                  }}
                >
                  <div className="flex items-end gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-teal">
                    <textarea
                      ref={input}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          ask(text);
                        }
                      }}
                      rows={2}
                      maxLength={1000}
                      placeholder="Votre question sur cet appel d'offres…"
                      aria-label="Votre question"
                      className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-navy outline-none placeholder:text-slate-400"
                    />
                    <button
                      type="submit"
                      disabled={pending || text.trim().length < 3}
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal to-electric text-navy shadow transition hover:-translate-y-0.5 disabled:opacity-40"
                      aria-label="Envoyer"
                    >
                      <ArrowUp className="size-5" aria-hidden />
                    </button>
                  </div>
                  <p className="mt-2 text-center text-[11px] text-slate-400">
                    Vérifiez toujours les points importants dans le règlement de
                    consultation de l&apos;acheteur.
                  </p>
                </form>
              </aside>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

function Exchange({
  question,
  answer,
}: {
  question: string;
  answer: string | null;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <div className="ml-auto max-w-[85%] animate-rise rounded-2xl rounded-br-md bg-navy px-4 py-3 text-sm text-white shadow">
        {question}
      </div>
      <div className="max-w-[92%] animate-rise rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200">
        {answer === null ? (
          <span
            className="flex items-center gap-1.5 py-1"
            aria-label="Réponse en cours"
          >
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                className="size-2 animate-bounce rounded-full bg-violet-400"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </span>
        ) : (
          <>
            <p className="whitespace-pre-line leading-relaxed">{answer}</p>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(answer).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-navy"
            >
              <Copy className="size-3.5" aria-hidden />{" "}
              {copied ? "Copié" : "Copier"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
