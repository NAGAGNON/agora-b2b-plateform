"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Building2, CalendarDays, Check, Crown, Gift, Mail, Megaphone, Rocket, Sparkles, Target as TargetIcon, Users, X, Zap } from "lucide-react";
import { boostAudience, requestBoost } from "@/app/actions/visibility";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { SelectMenu } from "@/components/ui/select-menu";
import { cn } from "@/lib/cn";
import { formatEuros } from "@/lib/billing/plans";
import {
  DAILY_OPTIONS,
  DURATION_OPTIONS,
  FEATURED_OPTIONS,
  INTENSIVE_DAILY,
  PRESENTATION_DAY_PRICE,
  boostPriceWithIncluded,
  totalPresentations,
  type Daily,
  type Duration,
  type Featured,
} from "@/lib/visibility";

type Target = { value: string; label: string };
export type TargetingOptions = {
  sectors: { family: string; items: { slug: string; label: string }[] }[];
  regions: string[];
  sizes: { value: string; label: string }[];
  kinds: { value: string; label: string }[];
};
type Audience = { members: number; prospects: number };

const nf = (n: number) => n.toLocaleString("fr-FR");

/** Pastilles à choix multiples, envoyées avec le formulaire sous le nom donné. */
function Chips({ name, label, options, value, onChange }: { name: string; label: string; options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <label
            key={o.value}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all duration-200 select-none active:scale-95",
              on ? "bg-navy text-white shadow-md ring-navy" : "bg-white text-slate-600 ring-slate-200 hover:-translate-y-0.5 hover:shadow-sm hover:ring-teal",
            )}
          >
            <input type="checkbox" name={name} value={o.value} checked={on} onChange={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])} className="sr-only" />
            {on && <Check className="size-3 text-teal" strokeWidth={3} aria-hidden />}
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

/** Étape numérotée du formulaire. */
function Step({ n, icon: Icon, title, hint, children, delay = 0 }: { n: number; icon: typeof Users; title: string; hint?: string; children: React.ReactNode; delay?: number }) {
  return (
    <section className="plan-in rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md sm:p-6" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal to-electric text-sm font-extrabold text-white shadow-lg shadow-teal/25">{n}</span>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 font-heading text-lg font-extrabold text-navy">
            <Icon className="size-5 text-teal-700" aria-hidden /> {title}
          </h3>
          {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/**
 * Offre « Visibilité » : cible, ciblage (métiers, régions, tailles, type), volume, mise en avant et durée.
 * Audience réelle recalculée à chaque choix (entreprises inscrites + entreprises de la base joignables par
 * e-mail), prix en direct, présentations incluses dans l'abonnement déduites.
 */
export function BoostForm({
  targets,
  freeLaunch,
  defaultTarget,
  initialAudience,
  includedLeft,
  includedPlan,
  options,
  baseLabel,
}: {
  targets: Target[];
  freeLaunch: boolean;
  defaultTarget?: string;
  initialAudience: Audience;
  includedLeft: number;
  includedPlan: string;
  options: TargetingOptions;
  baseLabel?: string | null;
}) {
  const [state, action] = useActionState(requestBoost, null);
  const [target, setTarget] = useState(defaultTarget && targets.some((t) => t.value === defaultTarget) ? defaultTarget : (targets[0]?.value ?? "COMPANY"));
  const [daily, setDaily] = useState<Daily>(10);
  const [featured, setFeatured] = useState<Featured>(7);
  const [duration, setDuration] = useState<Duration>(14);
  const [sectors, setSectors] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [kinds, setKinds] = useState<string[]>([]);
  const [audience, setAudience] = useState<Audience>(initialAudience);
  const [counting, startCount] = useTransition();
  const need = target !== "COMPANY";
  const filtered = sectors.length + regions.length + sizes.length + kinds.length > 0;
  const shown = filtered ? audience : initialAudience;
  const reach = shown.members + shown.prospects;
  const total = totalPresentations(daily, duration);
  const { price, covered } = boostPriceWithIncluded(daily, featured, duration, includedLeft);
  const fullPrice = boostPriceWithIncluded(daily, featured, duration, 0).price;

  // Audience réelle recalculée à chaque changement de ciblage
  useEffect(() => {
    if (need || !filtered) return;
    const t = setTimeout(() => startCount(async () => setAudience(await boostAudience({ sectors, regions, sizes, kinds }))), 250);
    return () => clearTimeout(t);
  }, [need, filtered, sectors, regions, sizes, kinds]);

  if (state?.ok)
    return (
      <div className="plan-in rounded-3xl bg-gradient-to-br from-teal-50 to-white p-8 text-center ring-1 ring-teal/30">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-teal text-navy shadow-lg shadow-teal/30">
          <Rocket className="size-7" aria-hidden />
        </span>
        <p className="mt-4 font-heading text-xl font-extrabold text-navy">Demande envoyée</p>
        <p className="mt-1 text-slate-600">{state.message}</p>
      </div>
    );

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <input type="hidden" name="daily" value={daily} />
      <input type="hidden" name="featured" value={featured} />
      <input type="hidden" name="duration" value={duration} />
      <div className="space-y-5">
        {baseLabel && (
          <p className="plan-in flex items-center gap-3 rounded-3xl bg-gradient-to-r from-navy to-teal-800 p-4 text-sm font-semibold text-white shadow-lg">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <Mail className="size-5 text-teal" aria-hidden />
            </span>
            {baseLabel}, en plus des entreprises inscrites sur LinkProB2B.
          </p>
        )}
        <Step n={1} icon={Building2} title="Que voulez-vous faire connaître ?">
          <label htmlFor="boost-target" className="sr-only">
            Cible
          </label>
          <SelectMenu id="boost-target" name="target" value={target} onChange={(e) => setTarget(e.target.value)} className="h-12 rounded-xl border border-slate-300 bg-white pl-4 text-[15px] font-semibold text-navy">
            {targets.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </SelectMenu>
        </Step>

        {!need ? (
          <Step n={2} icon={TargetIcon} title="À qui voulez-vous être présenté ?" hint="Sans choix : toutes les entreprises. Chaque critère affine la cible." delay={80}>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-[11px] font-bold tracking-wider text-slate-500 uppercase">Régions</p>
                <Chips name="t_region" label="Régions" options={options.regions.map((r) => ({ value: r, label: r }))} value={regions} onChange={setRegions} />
              </div>
              <div>
                <p className="mb-2 text-[11px] font-bold tracking-wider text-slate-500 uppercase">Taille de l&apos;entreprise</p>
                <Chips name="t_size" label="Taille" options={options.sizes} value={sizes} onChange={setSizes} />
              </div>
              <div>
                <p className="mb-2 text-[11px] font-bold tracking-wider text-slate-500 uppercase">Type (entreprises inscrites)</p>
                <Chips name="t_kind" label="Type d'entreprise" options={options.kinds} value={kinds} onChange={setKinds} />
              </div>
              <details className="group rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 open:bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-bold tracking-wider text-slate-500 uppercase [&::-webkit-details-marker]:hidden">
                  <span>
                    Métiers {sectors.length > 0 && <span className="ml-1 rounded-full bg-teal px-1.5 py-0.5 text-[10px] text-navy">{sectors.length}</span>}
                  </span>
                  <span className="text-teal-700 normal-case group-open:hidden">Choisir des métiers</span>
                </summary>
                <div className="mt-3 max-h-72 space-y-3 overflow-y-auto overscroll-contain pr-1">
                  {options.sectors.map((f) => (
                    <div key={f.family}>
                      <p className="mb-1.5 text-[11px] font-semibold text-slate-400">{f.family}</p>
                      <Chips name="t_sector" label={f.family} options={f.items.map((i) => ({ value: i.slug, label: i.label }))} value={sectors} onChange={setSectors} />
                    </div>
                  ))}
                </div>
              </details>
              {filtered && (
                <button
                  type="button"
                  onClick={() => {
                    setSectors([]);
                    setRegions([]);
                    setSizes([]);
                    setKinds([]);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-navy"
                >
                  <X className="size-3.5" aria-hidden /> Effacer le ciblage
                </button>
              )}
            </div>
            <div className={cn("mt-5 grid gap-3 transition-opacity sm:grid-cols-2", counting && "opacity-60")} aria-live="polite">
              <div className="rounded-2xl bg-gradient-to-br from-navy to-navy-900 p-4 text-white">
                <p className="flex items-center gap-2 text-xs text-slate-300">
                  <Users className="size-4 text-teal" aria-hidden /> Entreprises inscrites
                </p>
                <p key={`m-${shown.members}`} className="price-pop mt-1 font-heading text-3xl font-extrabold">
                  {nf(shown.members)}
                </p>
                <p className="text-xs text-slate-400">présentation dans leur espace</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 p-4 text-white">
                <p className="flex items-center gap-2 text-xs text-teal-100">
                  <Mail className="size-4" aria-hidden /> Entreprises de notre base
                </p>
                <p key={`p-${shown.prospects}`} className="price-pop mt-1 font-heading text-3xl font-extrabold">
                  {nf(shown.prospects)}
                </p>
                <p className="text-xs text-teal-100">joignables par e-mail professionnel</p>
              </div>
            </div>
          </Step>
        ) : (
          <Step n={2} icon={TargetIcon} title="Ciblage automatique" hint="Votre besoin est présenté aux entreprises de son métier et de sa zone." delay={80}>
            <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
              Le métier et le lieu de votre besoin choisissent les entreprises prévenues : inscrites d&apos;abord, puis entreprises de notre base, par e-mail, dans la limite des envois
              quotidiens.
            </p>
          </Step>
        )}

        <Step n={3} icon={Zap} title="Combien d'entreprises chaque jour ?" delay={160}>
          <div role="radiogroup" aria-label="Présentations par jour" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {DAILY_OPTIONS.map((o) => {
              const on = daily === o;
              const intense = o === INTENSIVE_DAILY;
              return (
                <button
                  key={o}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setDaily(o)}
                  className={cn(
                    "relative rounded-2xl p-3 text-left ring-1 transition-all duration-200 active:scale-[0.98]",
                    on ? "bg-navy text-white shadow-xl ring-navy" : "bg-white text-navy ring-slate-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-teal",
                    intense && !on && "ring-teal/50",
                  )}
                >
                  {intense && <span className="absolute -top-2 right-2 rounded-full bg-gradient-to-r from-teal to-electric px-2 py-0.5 text-[10px] font-bold text-white shadow">Intensif</span>}
                  <span className="block font-heading text-xl font-extrabold">{o === 0 ? "Aucune" : o}</span>
                  <span className={cn("text-xs", on ? "text-slate-300" : "text-slate-500")}>{o === 0 ? "seulement « À la une »" : freeLaunch ? "par jour" : `par jour · ${formatEuros(PRESENTATION_DAY_PRICE[o])} / j`}</span>
                </button>
              );
            })}
          </div>
        </Step>

        <Step n={4} icon={CalendarDays} title="Durée et mise en avant" delay={240}>
          <p className="mb-2 text-[11px] font-bold tracking-wider text-slate-500 uppercase">Durée des présentations</p>
          <div role="radiogroup" aria-label="Durée" className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map((o) => (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={duration === o}
                onClick={() => setDuration(o)}
                className={cn(
                  "rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 transition-all duration-200 active:scale-95",
                  duration === o ? "bg-navy text-white shadow-md ring-navy" : "bg-white text-slate-700 ring-slate-200 hover:ring-teal",
                )}
              >
                {o} jours
              </button>
            ))}
          </div>
          <p className="mt-5 mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
            <Crown className="size-3.5 text-teal-700" aria-hidden /> « À la une » {need ? "des opportunités" : "de l'annuaire"}
            {!freeLaunch && " · 1 € / jour"}
          </p>
          <div role="radiogroup" aria-label="Mise en avant" className="flex flex-wrap gap-2">
            {FEATURED_OPTIONS.map((o) => (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={featured === o}
                onClick={() => setFeatured(o)}
                className={cn(
                  "rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 transition-all duration-200 active:scale-95",
                  featured === o ? "bg-navy text-white shadow-md ring-navy" : "bg-white text-slate-700 ring-slate-200 hover:ring-teal",
                )}
              >
                {o === 0 ? "Non" : `${o} jours`}
              </button>
            ))}
          </div>
        </Step>
      </div>

      <aside className="h-fit lg:sticky lg:top-24">
        <div className="plan-glow relative rounded-3xl p-[2px] shadow-2xl shadow-teal/20">
          <div className="relative overflow-hidden rounded-[1.4rem] bg-navy p-6 text-white">
            <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-teal/30 blur-3xl" />
            <p className="flex items-center gap-2 text-sm font-semibold text-teal">
              <Megaphone className="size-4" aria-hidden /> Votre visibilité
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              {daily > 0 && (
                <li className="flex gap-2">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
                  <span>
                    Jusqu&apos;à{" "}
                    <strong key={total} className="price-pop text-white">
                      {nf(total)} entreprises
                    </strong>{" "}
                    en {duration} jours
                    {!need && reach > 0 && <span className="block text-xs text-slate-400">parmi {nf(reach)} qui correspondent à votre ciblage</span>}
                  </span>
                </li>
              )}
              {featured > 0 && (
                <li className="flex gap-2">
                  <Crown className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden /> {featured} jours « À la une »
                </li>
              )}
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden /> Suivi jour après jour ici même
              </li>
            </ul>
            {covered > 0 && (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-white/10 p-3 text-xs text-teal-100">
                <Gift className="mt-0.5 size-4 shrink-0" aria-hidden />
                {nf(covered)} présentation{covered > 1 ? "s" : ""} incluse{covered > 1 ? "s" : ""} dans votre offre {includedPlan} ce mois-ci
              </p>
            )}
            <div className="mt-5 border-t border-white/10 pt-5">
              {freeLaunch ? (
                <>
                  <p className="font-heading text-4xl font-extrabold">Offert</p>
                  <p className="text-xs text-slate-400">pendant la phase de lancement</p>
                </>
              ) : (
                <>
                  {covered > 0 && <p className="text-sm text-slate-400 line-through">{formatEuros(fullPrice)} HT</p>}
                  <p key={price} className="price-pop font-heading text-4xl font-extrabold">
                    {formatEuros(price)} <span className="text-base font-medium text-slate-400">HT</span>
                  </p>
                  <p className="text-xs text-slate-400">paiement unique, sans abonnement</p>
                </>
              )}
            </div>
            {state && !state.ok && (
              <Notice tone="error" className="mt-4">
                {state.error}
              </Notice>
            )}
            <SubmitButton full size="lg" className="btn-shine mt-5" pendingLabel="Envoi…">
              Lancer ma visibilité
            </SubmitButton>
            <p className="mt-3 text-center text-xs text-slate-400">Vérifiée par l&apos;équipe avant de démarrer (sous 24 h ouvrées).</p>
          </div>
        </div>
      </aside>
    </form>
  );
}
