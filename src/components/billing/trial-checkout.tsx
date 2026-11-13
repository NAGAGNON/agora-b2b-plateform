"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { BellRing, Check, CreditCard, Lock, PartyPopper, ShieldCheck } from "lucide-react";
import { startCardTrial } from "@/app/actions/billing";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";
import { PLANS, formatEuros, priceTTC, yearlyMonthlyHT, type PlanCode } from "@/lib/billing/plans";

type Paid = Exclude<PlanCode, "FREE">;

/**
 * Choix de l'offre et démarrage de l'essai : 0 € aujourd'hui, premier paiement à la date indiquée
 * sauf résiliation. Le montant n'est jamais transmis par le navigateur (offre + périodicité seulement).
 */
export function TrialCheckout({ days, firstCharge, yearly, initialPlan = "PRO" }: { days: number; firstCharge: string; yearly: boolean; initialPlan?: Paid }) {
  const [state, action] = useActionState(startCardTrial, null);
  const [plan, setPlan] = useState<Paid>(initialPlan);
  const [interval, setInterval] = useState<"month" | "year">("month");
  const info = PLANS.find((p) => p.code === plan)!;
  const ht = interval === "year" ? info.yearlyPriceHT : info.priceHT;
  const reminder = new Date(new Date(firstCharge).getTime() - 3 * 86_400_000);
  const fmt = (d: Date | string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="interval" value={interval} />

      {yearly && (
        <div role="radiogroup" aria-label="Périodicité" className="inline-flex rounded-full bg-slate-100 p-1 text-sm font-semibold">
          {(["month", "year"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={interval === v}
              onClick={() => setInterval(v)}
              className={cn("rounded-full px-4 py-1.5 transition", interval === v ? "bg-white text-navy shadow" : "text-slate-500 hover:text-navy")}
            >
              {v === "month" ? "Mensuel" : "Annuel · 2 mois offerts"}
            </button>
          ))}
        </div>
      )}

      <div role="radiogroup" aria-label="Offre" className="grid gap-3 sm:grid-cols-2">
        {PLANS.filter((p) => p.code !== "FREE").map((p) => {
          const on = plan === p.code;
          return (
            <button
              key={p.code}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPlan(p.code as Paid)}
              className={cn(
                "relative rounded-2xl border-2 bg-white p-4 text-left transition",
                on ? "border-teal shadow-lg shadow-teal/15" : "border-slate-200 hover:border-teal/50",
              )}
            >
              {p.popular && <span className="absolute -top-2.5 right-3 rounded-full bg-navy px-2 py-0.5 text-[11px] font-bold text-white">Le plus choisi</span>}
              <span className="flex items-center justify-between">
                <span className="font-heading text-lg font-extrabold text-navy">{p.name}</span>
                <span className={cn("flex size-5 items-center justify-center rounded-full border-2", on ? "border-teal bg-teal" : "border-slate-300")}>
                  {on && <Check className="size-3 text-white" aria-hidden />}
                </span>
              </span>
              <span className="mt-1 block text-sm text-slate-500">
                puis {formatEuros(interval === "year" ? yearlyMonthlyHT(p) : p.priceHT)} HT / mois
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl bg-navy p-5 text-white">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-slate-300">À payer aujourd&apos;hui</p>
            <p className="font-heading text-4xl font-extrabold">0,00 €</p>
          </div>
          <p className="text-right text-sm text-slate-300">
            puis {formatEuros(ht)} HT ({formatEuros(priceTTC(ht))} TTC)
            <br />
            {interval === "year" ? "par an" : "par mois"}, à partir du {fmt(firstCharge)}
          </p>
        </div>
        <ol className="mt-5 space-y-3 border-t border-white/10 pt-5 text-sm">
          <li className="flex gap-3">
            <PartyPopper className="size-5 shrink-0 text-teal" aria-hidden />
            <span>
              <strong>Aujourd&apos;hui</strong> : accès complet à l&apos;offre {info.name}, pendant {days} jours.
            </span>
          </li>
          <li className="flex gap-3">
            <BellRing className="size-5 shrink-0 text-teal" aria-hidden />
            <span>
              <strong>Le {fmt(reminder)}</strong> : un e-mail vous rappelle la fin de l&apos;essai.
            </span>
          </li>
          <li className="flex gap-3">
            <CreditCard className="size-5 shrink-0 text-teal" aria-hidden />
            <span>
              <strong>Le {fmt(firstCharge)}</strong> : premier paiement, sauf si vous résiliez avant. Résiliation en 2 clics depuis votre espace.
            </span>
          </li>
        </ol>
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-600">
        <input type="checkbox" name="acceptTerms" className="mt-0.5 size-5 shrink-0 rounded border-slate-300 accent-teal" />
        <span>
          J&apos;accepte les{" "}
          <Link href="/conditions-abonnement" target="_blank" className="font-semibold text-teal-700 underline">
            conditions d&apos;abonnement
          </Link>{" "}
          : le paiement démarre à la fin de l&apos;essai si je ne résilie pas avant.
        </span>
      </label>

      {state && !state.ok && <Notice tone="error">{state.error}</Notice>}

      <SubmitButton full size="lg" pendingLabel="Ouverture du paiement sécurisé…">
        Démarrer mes {days} jours gratuits
      </SubmitButton>

      <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Lock className="size-3.5" aria-hidden /> Paiement sécurisé par Stripe
        </span>
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="size-3.5" aria-hidden /> Aucun débit avant le {fmt(firstCharge)}
        </span>
      </p>
    </form>
  );
}
