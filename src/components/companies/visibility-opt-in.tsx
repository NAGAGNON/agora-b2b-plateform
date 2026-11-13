"use client";

import { useState } from "react";
import { Check, Crown, Megaphone, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatEuros } from "@/lib/billing/plans";
import { STARTER_BOOST, boostPrice } from "@/lib/visibility";

/**
 * Création d'entreprise : proposition de l'offre « Visibilité » (présentation à d'autres entreprises chaque
 * jour + « À la une » de l'annuaire). Jamais cochée d'office ; gratuite pendant la phase de lancement,
 * payante ensuite. La demande est validée par l'équipe avant de démarrer.
 */
export function VisibilityOptIn({ freeLaunch }: { freeLaunch: boolean }) {
  const [on, setOn] = useState(false);
  const price = boostPrice(STARTER_BOOST.daily, STARTER_BOOST.featured, STARTER_BOOST.duration);
  return (
    <fieldset className={cn("rounded-2xl border-2 p-4 transition", on ? "border-teal bg-teal-50/60" : "border-slate-200 bg-white")} data-testid="visibility-opt-in">
      <legend className="sr-only">Offre Visibilité</legend>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" name="visibility" value="1" checked={on} onChange={(e) => setOn(e.target.checked)} className="mt-1 size-5 shrink-0 rounded border-slate-300 accent-teal" />
        <span className="flex-1">
          <span className="flex flex-wrap items-center gap-2 font-semibold text-navy">
            <Megaphone className="size-4 text-teal-700" aria-hidden /> Faire connaître mon entreprise dès aujourd&apos;hui
            {freeLaunch ? (
              <span className="rounded-full bg-teal px-2 py-0.5 text-xs font-bold text-navy">Offert pendant le lancement</span>
            ) : (
              <span className="rounded-full bg-navy px-2 py-0.5 text-xs font-bold text-white">{formatEuros(price)} HT</span>
            )}
          </span>
          <span className="mt-2 grid gap-1.5 text-sm text-slate-700 sm:grid-cols-2">
            <span className="flex items-center gap-1.5">
              <Users className="size-4 shrink-0 text-teal-700" aria-hidden /> Présentée à {STARTER_BOOST.daily} entreprises par jour pendant {STARTER_BOOST.duration} jours
            </span>
            <span className="flex items-center gap-1.5">
              <Crown className="size-4 shrink-0 text-teal-700" aria-hidden /> {STARTER_BOOST.featured} jours « À la une » de l&apos;annuaire
            </span>
          </span>
          <span className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <Check className="size-3.5 shrink-0" aria-hidden />
            {freeLaunch
              ? `Gratuit pendant la phase de lancement (valeur ${formatEuros(price)} HT). Vérifié par l'équipe avant de démarrer ; suivi dans « Visibilité ».`
              : "Paiement unique, sans abonnement. Vérifié par l'équipe avant de démarrer ; suivi dans « Visibilité »."}
          </span>
        </span>
      </label>
    </fieldset>
  );
}
