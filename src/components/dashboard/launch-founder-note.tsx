import Link from "next/link";
import { Sparkles } from "lucide-react";
import { freeLaunch } from "@/lib/billing/entitlements";
import { founderWave, onFounderList } from "@/lib/billing/founder-list";
import { FOUNDER_PRICE_HT, REGULAR_PRICE_HT } from "@/lib/billing/founder";
import { formatEuros } from "@/lib/billing/plans";
import { FounderCountdown } from "@/components/billing/founder-countdown";
import { FounderJoinButton } from "@/components/billing/founder-join-button";

const endFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/**
 * Bandeau de lancement : le site est gratuit jusqu'au vrai lancement ; les membres de la liste paieront
 * l'offre Pro au tarif fondateur. Par vagues d'une semaine numérotées, avec leur vraie date de fin.
 * Visiteur non connecté : bouton d'inscription.
 */
export async function LaunchFounderNote({ userId, now }: { userId: string | null; now: number }) {
  if (!(await freeLaunch())) return null;
  const wave = founderWave(now);
  const joined = userId ? await onFounderList(userId) : false;
  const price = formatEuros(FOUNDER_PRICE_HT);
  const regular = formatEuros(REGULAR_PRICE_HT);
  return (
    <section
      className="relative isolate overflow-hidden rounded-3xl bg-navy-900 p-5 text-white shadow-xl sm:p-7"
      data-testid="launch-founder-note"
      aria-label="Offre de lancement"
    >
      <div aria-hidden className="absolute -top-24 -right-16 -z-10 size-72 rounded-full bg-teal/25 blur-3xl" />
      <div aria-hidden className="absolute -bottom-24 -left-16 -z-10 size-64 rounded-full bg-electric/20 blur-3xl" />
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-teal-400 ring-1 ring-white/15">
            <Sparkles className="size-3.5" aria-hidden /> Offre de lancement · Vague {wave.number}
          </p>
          <h2 className="mt-3 font-heading text-2xl font-extrabold text-white sm:text-3xl">
            Gratuit aujourd&apos;hui. <span className="text-gradient">Moins cher demain.</span>
          </h2>
          <p className="mt-2 max-w-xl text-slate-300">
            LinkProB2B est gratuit jusqu&apos;au vrai lancement. Inscrivez-vous sur la liste : quand l&apos;offre Pro ouvrira, vous la paierez{" "}
            <strong className="text-white">{price} HT par mois au lieu de {regular} HT</strong>.
          </p>
          {!joined && (
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-300" data-testid="founder-wave">
              <span>Fin de la vague {wave.number} dans</span>
              <FounderCountdown endsAt={wave.endsAt} tone="dark" />
              <span className="w-full text-xs text-slate-400 sm:w-auto">({endFmt.format(new Date(wave.endsAt))})</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 lg:items-center lg:text-center">
          <p className="text-sm text-slate-400">
            <span className="line-through">{regular} HT</span> par mois
          </p>
          <p className="font-heading text-4xl font-extrabold text-white">
            {price}
            <span className="ml-1 text-base font-semibold text-slate-300">HT / mois</span>
          </p>
          {userId ? (
            <FounderJoinButton joined={joined} price={price} regular={regular} className="w-full" />
          ) : (
            <Link
              href="/inscription?suite=/dashboard"
              className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-teal to-electric px-5 py-3 text-sm font-bold text-white shadow-lg shadow-teal/20 hover:opacity-95"
            >
              Créer mon compte gratuit
            </Link>
          )}
          <p className="text-xs text-slate-400">Rien à payer aujourd&apos;hui. La liste ne vous engage à rien.</p>
        </div>
      </div>
    </section>
  );
}
