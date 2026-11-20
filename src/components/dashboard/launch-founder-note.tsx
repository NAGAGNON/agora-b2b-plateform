import Link from "next/link";
import { Gift } from "lucide-react";
import { freeLaunch } from "@/lib/billing/entitlements";
import { FOUNDER_LIST_ENDS, founderListOpen, onFounderList } from "@/lib/billing/founder-list";
import { FounderCountdown } from "@/components/billing/founder-countdown";
import { FounderJoinButton } from "@/components/billing/founder-join-button";

/** Texte unique du message de lancement (tableau de bord, abonnement, tarifs, accueil). */
export const LAUNCH_FOUNDER_TEXT =
  "Tout est gratuit pendant le lancement. Les membres inscrits pendant cette période auront un tarif fondateur réservé quand les offres payantes ouvriront.";

/**
 * Bandeau de lancement. Pendant 7 jours : bouton pour rejoindre la liste « tarif fondateur » (prix plus
 * léger au lancement des offres payantes) avec le temps restant. Visiteur non connecté : bouton d'inscription.
 */
export async function LaunchFounderNote({ userId, now }: { userId: string | null; now: number }) {
  if (!(await freeLaunch())) return null;
  const open = founderListOpen(now);
  const joined = open && userId ? await onFounderList(userId) : false;
  return (
    <div
      className="flex flex-col gap-3 rounded-2xl bg-gradient-to-r from-teal-50 to-sky px-4 py-4 text-sm text-navy ring-1 ring-teal/30 sm:flex-row sm:items-center"
      data-testid="launch-founder-note"
    >
      <Gift className="hidden size-5 shrink-0 text-teal-700 sm:block" aria-hidden />
      <div className="flex-1 space-y-2">
        <p>
          <strong>Membre du lancement</strong> : {LAUNCH_FOUNDER_TEXT}
          {open && " Rejoignez la liste pour avoir un prix plus léger au lancement (aucun paiement maintenant)."}
        </p>
        {open && (
          <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
            Liste ouverte encore <FounderCountdown endsAt={FOUNDER_LIST_ENDS} />
          </p>
        )}
      </div>
      {open ? (
        userId ? (
          <FounderJoinButton joined={joined} />
        ) : (
          <Link
            href="/inscription?suite=/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-teal to-electric px-4 py-2 text-sm font-bold text-white shadow-sm hover:opacity-95"
          >
            Je m&apos;inscris gratuitement
          </Link>
        )
      ) : (
        <Link href="/tarifs" className="font-semibold text-teal-700 hover:underline">
          Voir les offres
        </Link>
      )}
    </div>
  );
}
