"use client";

import { useActionState, useState } from "react";
import { Building2, Crown, Megaphone, Users } from "lucide-react";
import { requestBoost } from "@/app/actions/visibility";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { SelectMenu } from "@/components/ui/select-menu";
import { cn } from "@/lib/cn";
import { formatEuros } from "@/lib/billing/plans";
import { DAILY_OPTIONS, DURATION_OPTIONS, FEATURED_OPTIONS, boostPrice, totalPresentations, type Daily, type Duration, type Featured } from "@/lib/visibility";

type Target = { value: string; label: string };

function Choice<T extends number>({ name, options, value, onChange, render }: { name: string; options: readonly T[]; value: T; onChange: (v: T) => void; render: (v: T) => string }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cn(
            "rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 transition duration-200",
            value === o ? "bg-navy text-white shadow-md ring-navy" : "bg-white text-slate-700 ring-slate-200 hover:ring-teal",
          )}
        >
          {render(o)}
        </button>
      ))}
    </div>
  );
}

/** Choix de l'offre de visibilité : cible, présentations par jour, mise en avant, durée ; prix calculé en direct. */
export function BoostForm({ targets, freeLaunch, defaultTarget }: { targets: Target[]; freeLaunch: boolean; defaultTarget?: string }) {
  const [state, action] = useActionState(requestBoost, null);
  const [target, setTarget] = useState(defaultTarget && targets.some((t) => t.value === defaultTarget) ? defaultTarget : (targets[0]?.value ?? "COMPANY"));
  const [daily, setDaily] = useState<Daily>(10);
  const [featured, setFeatured] = useState<Featured>(7);
  const [duration, setDuration] = useState<Duration>(14);
  const price = boostPrice(daily, featured, duration);
  const need = target !== "COMPANY";
  if (state?.ok) return <Notice tone="success">{state.message}</Notice>;
  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <input type="hidden" name="daily" value={daily} />
      <input type="hidden" name="featured" value={featured} />
      <input type="hidden" name="duration" value={duration} />
      <div className="space-y-6">
        <div>
          <label htmlFor="boost-target" className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy">
            <Building2 className="size-4 text-teal-700" aria-hidden /> Que voulez-vous mettre en avant ?
          </label>
          <SelectMenu id="boost-target" name="target" value={target} onChange={(e) => setTarget(e.target.value)} className="h-11 rounded-lg border border-slate-300 bg-white pl-3 text-[15px] text-navy">
            {targets.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </SelectMenu>
        </div>
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy">
            <Users className="size-4 text-teal-700" aria-hidden /> {need ? "Entreprises du métier prévenues chaque jour" : "Entreprises à qui vous êtes présenté chaque jour"}
          </p>
          <Choice name="Présentations par jour" options={DAILY_OPTIONS} value={daily} onChange={setDaily} render={(v) => (v === 0 ? "Aucune" : `${v} / jour`)} />
        </div>
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy">
            <Crown className="size-4 text-teal-700" aria-hidden /> Affichage « À la une » {need ? "en tête des opportunités" : "en tête de l'annuaire"}
          </p>
          <Choice name="Mise en avant" options={FEATURED_OPTIONS} value={featured} onChange={setFeatured} render={(v) => (v === 0 ? "Non" : `${v} jours`)} />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-navy">Durée des présentations</p>
          <Choice name="Durée" options={DURATION_OPTIONS} value={duration} onChange={setDuration} render={(v) => `${v} jours`} />
        </div>
      </div>

      <aside className="h-fit rounded-2xl bg-navy p-5 text-white lg:sticky lg:top-24">
        <p className="flex items-center gap-2 text-sm font-semibold text-teal">
          <Megaphone className="size-4" aria-hidden /> Votre visibilité
        </p>
        <ul className="mt-4 space-y-2 text-sm text-slate-200">
          {daily > 0 && (
            <li>
              Jusqu&apos;à <strong className="text-white">{totalPresentations(daily, duration)} entreprises</strong> {need ? "prévenues" : "à qui vous êtes présenté"} en {duration} jours
            </li>
          )}
          {featured > 0 && (
            <li>
              <strong className="text-white">{featured} jours</strong> « À la une »
            </li>
          )}
          <li>Suivi jour après jour ici même</li>
        </ul>
        <div className="mt-5 border-t border-white/10 pt-4">
          {freeLaunch ? (
            <>
              <p className="text-sm text-slate-400 line-through">{formatEuros(price)} HT</p>
              <p className="font-heading text-3xl font-extrabold">Gratuit</p>
              <p className="text-xs text-slate-400">pendant la phase de lancement</p>
            </>
          ) : (
            <>
              <p className="font-heading text-3xl font-extrabold">{formatEuros(price)} HT</p>
              <p className="text-xs text-slate-400">paiement unique, sans abonnement</p>
            </>
          )}
        </div>
        {state && !state.ok && (
          <Notice tone="error" className="mt-4">
            {state.error}
          </Notice>
        )}
        <SubmitButton full size="lg" className="mt-5" pendingLabel="Envoi…">
          Demander cette visibilité
        </SubmitButton>
        <p className="mt-3 text-xs text-slate-400">Chaque demande est vérifiée par l&apos;équipe avant de démarrer (sous 24 h ouvrées).</p>
      </aside>
    </form>
  );
}
