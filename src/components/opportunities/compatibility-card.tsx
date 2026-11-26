"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { addProfileCertification } from "@/app/actions/company";
import { ArrowRight, Check, CheckCircle2, CircleDashed, CircleHelp, CircleX, Gauge, Handshake, PenLine, Plus } from "lucide-react";
import { ProLock } from "@/components/billing/credits";
import { computeCompatibility, type CompatAnswers, type CompatCompany, type CompatItem, type CompatOffer, type CompatQuestion, type CompatRequirements, type Compatibility } from "@/lib/compatibility";
import { cn } from "@/lib/cn";

const ICON = {
  ok: <CheckCircle2 className="size-5 shrink-0 text-teal-600" aria-hidden />,
  partial: <CircleDashed className="size-5 shrink-0 text-sky-600" aria-hidden />,
  missing: <CircleX className="size-5 shrink-0 text-rose-500" aria-hidden />,
  unknown: <CircleHelp className="size-5 shrink-0 text-slate-400" aria-hidden />,
} as const;

const TONE = {
  high: { ring: "ring-teal/40", bar: "from-teal to-emerald-400", text: "text-teal-700", chip: "bg-teal-50 text-teal-800 ring-teal/30" },
  good: { ring: "ring-teal/30", bar: "from-teal to-electric", text: "text-teal-700", chip: "bg-teal-50 text-teal-800 ring-teal/30" },
  partial: { ring: "ring-sky-200", bar: "from-sky-400 to-electric", text: "text-sky-700", chip: "bg-sky-50 text-sky-800 ring-sky-200" },
  low: { ring: "ring-rose-200", bar: "from-rose-400 to-rose-300", text: "text-rose-700", chip: "bg-rose-50 text-rose-800 ring-rose-200" },
  none: { ring: "ring-slate-200", bar: "from-slate-300 to-slate-200", text: "text-slate-600", chip: "bg-slate-100 text-slate-700 ring-slate-200" },
} as const;

function Row({ item }: { item: CompatItem }) {
  return (
    <li className="flex gap-2.5">
      {ICON[item.status]}
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-navy">{item.label}</span>
        {item.detail && <span className="block text-sm text-slate-600">{item.detail}</span>}
      </span>
    </li>
  );
}

type QuestionProps = { onAnswer?: (text: string, value: boolean) => void; canEdit?: boolean; added?: string[]; onAdd?: (text: string) => void; adding?: string | null };

function Question({ q, onAnswer, canEdit, added, onAdd, adding }: { q: CompatQuestion } & QuestionProps) {
  const btn = (value: boolean, label: string) => (
    <button
      type="button"
      onClick={() => onAnswer?.(q.text, value)}
      aria-pressed={q.answer === value}
      className={cn(
        "h-8 rounded-lg px-3 text-xs font-bold ring-1 transition",
        q.answer === value ? (value ? "bg-teal-600 text-white ring-teal-600" : "bg-slate-700 text-white ring-slate-700") : "bg-white text-navy ring-slate-300 hover:ring-teal",
      )}
    >
      {label}
    </button>
  );
  const isAdded = added?.includes(q.text);
  return (
    <li className="rounded-xl bg-white p-3 ring-1 ring-slate-200" data-testid="compat-question">
      <p className="text-sm text-navy">
        <span className="mr-1.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-600 uppercase">{q.kind === "cert" ? "Certification" : "Condition"}</span>
        {q.text}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {btn(true, "Je l'ai")}
        {btn(false, "Je ne l'ai pas")}
        {q.kind === "cert" && q.answer === true && canEdit && (
          isAdded ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
              <Check className="size-3.5" aria-hidden /> Ajoutée à votre fiche
            </span>
          ) : (
            <button type="button" onClick={() => onAdd?.(q.text)} disabled={adding === q.text} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-bold text-teal-700 hover:underline disabled:opacity-60">
              <Plus className="size-3.5" aria-hidden /> {adding === q.text ? "Ajout…" : "Ajouter à ma fiche"}
            </button>
          )
        )}
      </div>
    </li>
  );
}

function Details({ c, opportunityId, ...qp }: { c: Compatibility; opportunityId: string } & QuestionProps) {
  return (
    <div className="space-y-4 bg-white p-4 sm:p-5">
      <ul className="space-y-3">
        {c.items.map((i) => (
          <Row key={i.key} item={i} />
        ))}
      </ul>
      {c.questions.length > 0 && (
        <div className="rounded-2xl bg-sky/40 p-3 ring-1 ring-slate-200 sm:p-4" data-testid="compat-questions">
          <p className="text-sm font-bold text-navy">Précisez votre note</p>
          <p className="text-xs text-slate-600">L&apos;avis demande ces éléments : répondez, la note se met à jour.</p>
          <ul className="mt-3 space-y-2">
            {c.questions.map((q) => (
              <Question key={q.kind + q.text} q={q} {...qp} />
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-600">
            Pour des notes plus précises sur vos prochaines candidatures, enrichissez votre fiche entreprise (certifications, zone, savoir-faire).{" "}
            <Link href="/dashboard/entreprise" className="font-semibold text-teal-700 underline">
              Ma fiche
            </Link>
          </p>
        </div>
      )}
      {c.advice.length > 0 && (
        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
          <p className="font-bold text-navy">Notre conseil</p>
          {c.advice.map((a) => (
            <p key={a} className="mt-1">
              {a}
            </p>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {c.suggestPartner && (
          <Link href={`/publier?partenaire=${opportunityId}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-navy px-3 text-sm font-semibold text-white transition hover:-translate-y-px">
            <Handshake className="size-4" aria-hidden /> Trouver un partenaire
          </Link>
        )}
        {c.profileIncomplete && (
          <Link href="/dashboard/entreprise" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-navy ring-1 ring-slate-300 transition hover:ring-teal">
            <PenLine className="size-4" aria-hidden /> Compléter ma fiche
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * Compatibilité entre l'entreprise du membre et l'appel d'offres, juste avant « En savoir plus ».
 * Offre Gratuit (au lancement) : la note reste visible, le détail est flouté avec le repère Pro.
 */
export function CompatibilityCard({
  offer,
  company,
  requirements,
  tradeName,
  opportunityId,
  locked = false,
  canEdit = false,
}: {
  offer: CompatOffer;
  company: CompatCompany;
  requirements: CompatRequirements;
  tradeName: string | null;
  opportunityId: string;
  locked?: boolean;
  canEdit?: boolean;
}) {
  const storeKey = `compat:${opportunityId}`;
  const [answers, setAnswers] = useState<CompatAnswers>({});
  const [added, setAdded] = useState<string[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Réponses gardées sur cet appareil pour cette offre (confort seulement)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storeKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setAnswers(JSON.parse(saved) as CompatAnswers);
    } catch {}
  }, [storeKey]);
  const answer = (text: string, value: boolean) =>
    setAnswers((a) => {
      const next = { ...a, [text]: value };
      try {
        localStorage.setItem(storeKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  const add = (text: string) => {
    setAdding(text);
    setError(null);
    startTransition(async () => {
      const r = await addProfileCertification(text);
      setAdding(null);
      if (r.ok) setAdded((x) => [...x, text]);
      else setError(r.error);
    });
  };
  const c = useMemo(() => computeCompatibility(offer, company, requirements, tradeName, locked ? {} : answers), [offer, company, requirements, tradeName, answers, locked]);
  const tone = TONE[c.level ?? "none"];
  return (
    <section className={cn("mt-5 overflow-hidden rounded-2xl bg-white shadow-sm ring-1", tone.ring)} data-testid="compatibility" aria-labelledby="compat-title">
      <div className="flex items-center gap-4 p-4 sm:p-5">
        <div className="relative flex size-16 shrink-0 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200 sm:size-[4.5rem]">
          {c.score != null ? (
            <span className={cn("font-heading text-2xl font-extrabold sm:text-3xl", tone.text)} data-testid="compat-score">
              {c.score}
            </span>
          ) : (
            <Gauge className="size-7 text-slate-400" aria-hidden />
          )}
          {c.score != null && <span className="absolute right-1.5 bottom-1 text-[10px] font-bold text-slate-400">/100</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p id="compat-title" className="text-xs font-bold tracking-wide text-slate-500 uppercase">
            Compatibilité avec votre entreprise
          </p>
          <p className={cn("mt-1 inline-flex rounded-full px-2.5 py-0.5 text-sm font-bold ring-1", tone.chip)}>{c.levelLabel}</p>
          {c.score != null && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
              <div className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", tone.bar)} style={{ width: `${c.score}%` }} />
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-slate-100">
        {locked ? (
          <div className="p-3">
            <ProLock title="Le détail de la note">
              <Details c={c} opportunityId={opportunityId} />
            </ProLock>
          </div>
        ) : (
          <Details c={c} opportunityId={opportunityId} onAnswer={answer} canEdit={canEdit} added={added} onAdd={add} adding={adding} />
        )}
        {error && <p className="px-4 pb-3 text-sm font-semibold text-rose-700 sm:px-5" role="alert">{error}</p>}
      </div>
      <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500 sm:px-5">
        Calculée avec votre fiche et l&apos;avis. Une aide pour décider, pas une garantie : l&apos;annonce officielle fait foi.
      </p>
    </section>
  );
}

/** Visiteur sans entreprise : une invitation à créer son compte ou son entreprise pour voir sa note. */
export function CompatibilityTeaser({ signedIn }: { signedIn: boolean }) {
  return (
    <Link
      href={signedIn ? "/onboarding/entreprise" : "/inscription"}
      className="mt-5 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-teal"
      data-testid="compatibility-teaser"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal to-electric text-navy">
        <Gauge className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-navy">Cette offre est-elle faite pour vous ?</span>
        <span className="block text-sm text-slate-600">
          {signedIn ? "Ajoutez votre entreprise pour voir votre note de compatibilité." : "Créez votre compte gratuit pour voir votre note de compatibilité."}
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-slate-400" aria-hidden />
    </Link>
  );
}
