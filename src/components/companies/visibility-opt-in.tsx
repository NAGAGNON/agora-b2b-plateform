"use client";

import { useState } from "react";
import { Crown, Mail, Megaphone, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatEuros } from "@/lib/billing/plans";
import { STARTER_BOOST, boostPrice } from "@/lib/visibility";

/**
 * Création d'entreprise : proposition de l'offre « Visibilité » (présentation à des entreprises ciblées
 * chaque jour + « À la une » de l'annuaire). Jamais activée d'office ; offerte pendant la phase de
 * lancement, payante ensuite. La demande est validée par l'équipe avant de démarrer.
 */
export function VisibilityOptIn({ freeLaunch }: { freeLaunch: boolean }) {
  const [on, setOn] = useState(false);
  const price = boostPrice(STARTER_BOOST.daily, STARTER_BOOST.featured, STARTER_BOOST.duration);
  const total = STARTER_BOOST.daily * STARTER_BOOST.duration;
  return (
    <div className={cn("relative rounded-3xl p-[2px] transition-all duration-500", on ? "plan-glow shadow-xl shadow-teal/25" : "bg-slate-200")} data-testid="visibility-opt-in">
      <label className={cn("relative block cursor-pointer overflow-hidden rounded-[1.4rem] p-5 transition-colors duration-500", on ? "bg-navy text-white" : "bg-white text-navy")}>
        <div aria-hidden className={cn("pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-teal/30 blur-3xl transition-opacity duration-500", on ? "opacity-100" : "opacity-0")} />
        <input type="checkbox" name="visibility" value="1" checked={on} onChange={(e) => setOn(e.target.checked)} className="peer sr-only" />
        <div className="relative flex items-start gap-4">
          <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-500", on ? "rotate-[-8deg] bg-teal text-navy" : "bg-teal-50 text-teal-700")}>
            <Megaphone className="size-6" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-heading text-lg font-extrabold">Faire connaître mon entreprise</span>
              <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", freeLaunch ? "bg-gradient-to-r from-teal to-electric text-white" : "bg-navy text-white")}>
                {freeLaunch ? "Offert pendant le lancement" : `${formatEuros(price)} HT`}
              </span>
            </span>
            <span className={cn("mt-1 block text-sm", on ? "text-slate-300" : "text-slate-600")}>
              Nous présentons votre entreprise aux entreprises de votre métier et de votre région, dès que l&apos;équipe a validé la demande.
            </span>
          </span>
          {/* Interrupteur */}
          <span
            aria-hidden
            className={cn(
              "relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-300 peer-focus-visible:ring-4 peer-focus-visible:ring-teal/40",
              on ? "bg-teal" : "bg-slate-300",
            )}
          >
            <span className={cn("absolute left-1 size-5 rounded-full bg-white shadow transition-transform duration-300", on && "translate-x-5")} />
          </span>
        </div>
        <span className="relative mt-4 grid gap-2 sm:grid-cols-3">
          {[
            { icon: Users, t: `${STARTER_BOOST.daily} entreprises / jour`, s: `pendant ${STARTER_BOOST.duration} jours` },
            { icon: Mail, t: `Jusqu'à ${total} entreprises`, s: "inscrites et de notre base" },
            { icon: Crown, t: `${STARTER_BOOST.featured} jours « À la une »`, s: "en tête de l'annuaire" },
          ].map(({ icon: Icon, t, s }, i) => (
            <span
              key={t}
              className={cn("plan-in rounded-2xl p-3 transition-colors duration-500", on ? "bg-white/10" : "bg-slate-50 ring-1 ring-slate-200")}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <Icon className={cn("size-4", on ? "text-teal" : "text-teal-700")} aria-hidden />
              <span className="mt-1 block text-sm font-bold">{t}</span>
              <span className={cn("block text-xs", on ? "text-slate-400" : "text-slate-500")}>{s}</span>
            </span>
          ))}
        </span>
        <span className={cn("relative mt-3 flex items-center gap-1.5 text-xs", on ? "text-teal-100" : "text-slate-500")}>
          <Sparkles className="size-3.5 shrink-0" aria-hidden />
          {freeLaunch ? `Valeur ${formatEuros(price)} HT, offerte pendant la phase de lancement. Suivi jour après jour dans « Visibilité ».` : "Paiement unique, sans abonnement. Suivi jour après jour dans « Visibilité »."}
        </span>
      </label>
    </div>
  );
}
