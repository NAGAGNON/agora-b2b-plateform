"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck, Check, Sparkles, X } from "lucide-react";
import { toggleFavorite } from "@/app/actions/engagement";
import { answerApplicationPrompt } from "@/app/actions/applications";
import { trackCta } from "@/app/actions/cta";
import { cn } from "@/lib/cn";

/**
 * Les choix sur une offre : « En savoir plus » (ouvre l'aide pour répondre : puis-je répondre, pièces, dépôt), « Garder pour plus
 * tard » (favori) et « Pas pour moi ». Sur téléphone, une barre fixe en bas garde le bouton principal
 * visible quand il sort de l'écran.
 */
const noop = () => () => {};

export function OfferChoices({
  opportunityId,
  signedIn,
  hasCompany,
  started,
  saved,
  declined,
}: {
  opportunityId: string;
  signedIn: boolean;
  hasCompany: boolean;
  started: boolean;
  saved: boolean;
  declined: boolean;
}) {
  const router = useRouter();
  const href = !signedIn
    ? `/inscription?suite=${encodeURIComponent(`/opportunites/${opportunityId}`)}`
    : !hasCompany
      ? "/onboarding/entreprise"
      : `/dashboard/candidatures/${opportunityId}`;
  const label = started ? "Reprendre où j'en étais" : "En savoir plus";
  const [fav, setFav] = useState(saved);
  const [no, setNo] = useState(declined);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const mainRef = useRef<HTMLAnchorElement>(null);
  const [showBar, setShowBar] = useState(false);
  // Vrai seulement dans le navigateur (le portail vise document.body)
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

  useEffect(() => {
    const el = mainRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) =>
      setShowBar(!e.isIntersecting && e.boundingClientRect.top < 0),
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const needAccount = () => {
    if (signedIn) return false;
    router.push(
      `/connexion?suite=${encodeURIComponent(`/opportunites/${opportunityId}`)}`,
    );
    return true;
  };
  const onMain = () => {
    trackCta(
      started ? "offer_resume" : "offer_more",
      `/opportunites/${opportunityId}`,
    ).catch(() => null);
  };

  return (
    <div data-testid="offer-choices">
      <Link
        ref={mainRef}
        href={href}
        onClick={onMain}
        className="btn-shine inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal to-electric px-4 py-4 text-lg font-bold text-navy shadow-lg shadow-teal/25 transition hover:-translate-y-0.5 active:scale-[0.98]"
        data-testid="offer-interested"
      >
        <Sparkles className="size-5" aria-hidden /> {label}
      </Link>
      <p className="mt-2 text-center text-sm text-balance text-slate-600">
        Puis-je répondre ? Quelles pièces fournir ? Où déposer ? On vous
        explique tout, étape par étape.{" "}
        <strong className="text-navy">Gratuit.</strong>
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pending}
          aria-pressed={fav}
          onClick={() => {
            if (needAccount()) return;
            start(async () => {
              const r = await toggleFavorite("opportunity", opportunityId);
              if (r.ok) {
                setFav(!fav);
                setNote(
                  !fav
                    ? "Offre gardée : retrouvez-la dans vos favoris."
                    : "Offre retirée de vos favoris.",
                );
              }
            });
          }}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold ring-1 transition",
            fav
              ? "bg-teal-50 text-teal-800 ring-teal/40"
              : "bg-white text-navy ring-slate-300 hover:ring-teal/50",
          )}
          data-testid="offer-later"
        >
          {fav ? (
            <BookmarkCheck className="size-4" aria-hidden />
          ) : (
            <Bookmark className="size-4" aria-hidden />
          )}
          {fav ? (
            "Gardée"
          ) : (
            <>
              <span className="sm:hidden">Plus tard</span>
              <span className="hidden sm:inline">Garder pour plus tard</span>
            </>
          )}
        </button>
        <button
          type="button"
          disabled={pending || no}
          onClick={() => {
            if (needAccount()) return;
            start(async () => {
              const r = await answerApplicationPrompt(
                opportunityId,
                "NOT_FOR_ME",
              );
              if (r.ok) {
                setNo(true);
                setNote(
                  "C'est noté, merci. Cela nous aide à mieux choisir les offres que nous vous montrons.",
                );
              }
            });
          }}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold ring-1 transition",
            no
              ? "bg-slate-100 text-slate-500 ring-slate-200"
              : "bg-white text-slate-600 ring-slate-300 hover:ring-slate-400",
          )}
          data-testid="offer-not-for-me"
        >
          {no ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <X className="size-4" aria-hidden />
          )}
          Pas pour moi
        </button>
      </div>
      {note && (
        <p className="mt-2 text-center text-xs text-slate-600" role="status">
          {note}
        </p>
      )}

      {/* Téléphone : bouton principal toujours à portée de main (rendu à la racine de la page pour
          passer au-dessus de tout le contenu, même des blocs animés) */}
      {mounted &&
        createPortal(
          <div
            className={cn(
              "fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pr-20 pl-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(5,13,29,0.08)] backdrop-blur transition-transform duration-300 sm:hidden",
              showBar
                ? "translate-y-0"
                : "pointer-events-none translate-y-full",
            )}
            aria-hidden={!showBar}
            data-testid="offer-sticky"
          >
            <Link
              href={href}
              onClick={onMain}
              tabIndex={showBar ? 0 : -1}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal to-electric px-4 py-3.5 font-bold text-navy shadow-md"
            >
              <Sparkles className="size-5" aria-hidden /> {label}
            </Link>
          </div>,
          document.body,
        )}
    </div>
  );
}
