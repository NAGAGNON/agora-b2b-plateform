"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, CalendarClock, Check, CircleHelp, ClipboardCheck, Download, ExternalLink, FileText, Hourglass, Layers, Lightbulb, Lock, MapPinned, Scale, Send, ShieldCheck, Sparkles, Tag, Users } from "lucide-react";
import Link from "next/link";
import { certStatus } from "@/lib/certification-match";
import type { TenderBrief } from "@/lib/tender-brief";
import { briefProgress, loadTenderBrief, toggleBriefStep } from "@/app/actions/tender-brief";

/** Fiche synthèse : l'essentiel de l'avis officiel en 30 secondes. */
export type BriefSteps = { done: number[]; onToggle: (step: number, done: boolean) => void; pending?: boolean };

export function TenderBriefView({
  brief,
  source,
  steps,
  opportunityId,
  mine,
}: {
  brief: TenderBrief;
  source?: string | null;
  steps?: BriefSteps;
  opportunityId?: string;
  /** Certifications de la fiche de l'entreprise (null : pas d'entreprise, pas de comparaison) */
  mine?: string[] | null;
}) {
  const certs = (brief.certifications ?? []).map((c) => ({ label: c, status: mine ? certStatus(c, mine) : null }));
  const missing = certs.some((c) => c.status === "missing");
  const criteria = (brief.criteria ?? []).filter((c) => c.label.trim());
  const weighted = criteria.length > 0 && criteria.every((c) => typeof c.weight === "number" && c.weight > 0);
  const keys = [
    { icon: CalendarClock, label: "Remise des offres", value: brief.deadline, hot: true },
    { icon: MapPinned, label: "Visite", value: brief.site_visit, hot: Boolean(brief.site_visit && /obligatoire/i.test(brief.site_visit)) },
    { icon: Hourglass, label: "Durée", value: brief.duration, hot: false },
    { icon: Tag, label: "Prix", value: brief.pricing, hot: false },
  ].filter((k) => k.value);
  return (
    <div className="space-y-6">
      <p className="text-lg text-navy">{brief.summary}</p>
      {keys.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {keys.map(({ icon: Icon, label, value, hot }) => (
            <div key={label} className={`flex gap-3 rounded-xl p-3 ring-1 ${hot ? "bg-teal-50 ring-teal/30" : "bg-slate-50 ring-slate-200"}`}>
              <Icon className={`mt-0.5 size-5 shrink-0 ${hot ? "text-teal-700" : "text-slate-500"}`} aria-hidden />
              <div>
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
                <p className="font-semibold text-navy">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {(certs.length > 0 || (brief.capacity ?? []).length > 0) && (
        <BriefBlock icon={ShieldCheck} title="Puis-je répondre ?">
          {certs.length > 0 && (
            <ul className="space-y-2">
              {certs.map((c) => (
                <li key={c.label} className="flex items-start gap-2.5 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                  {c.status === "ok" ? (
                    <BadgeCheck className="mt-0.5 size-5 shrink-0 text-teal-700" aria-label="Présente sur votre fiche" />
                  ) : c.status === "missing" ? (
                    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-600" aria-label="Absente de votre fiche" />
                  ) : (
                    <CircleHelp className="mt-0.5 size-5 shrink-0 text-slate-400" aria-label="À vérifier" />
                  )}
                  <span className="min-w-0">
                    <span className="font-semibold text-navy">{c.label}</span>
                    <span className="block text-xs text-slate-500">
                      {c.status === "ok"
                        ? "Présente sur votre fiche entreprise"
                        : c.status === "missing"
                          ? "Absente de votre fiche entreprise"
                          : c.status === "check"
                            ? "À vérifier : intitulé ou numéro différent sur votre fiche"
                            : "Exigée par l'acheteur"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {(brief.capacity ?? []).length > 0 && <List items={brief.capacity ?? []} />}
          <div className="mt-3 flex flex-wrap gap-2">
            {mine && mine.length === 0 && certs.length > 0 && (
              <Link href="/dashboard/entreprise" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-navy ring-1 ring-slate-300 transition hover:bg-slate-50">
                Ajouter mes certifications pour comparer
              </Link>
            )}
            {missing && opportunityId && (
              <Link href={`/publier?partenaire=${opportunityId}`} className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white transition hover:bg-navy/90">
                <Users className="size-4" aria-hidden /> Trouver un partenaire qui l&apos;a
              </Link>
            )}
          </div>
          {missing && (
            <p className="mt-2 text-xs text-slate-500">Il vous manque une exigence ? Répondre à plusieurs (groupement ou sous-traitance) permet souvent de candidater quand même.</p>
          )}
        </BriefBlock>
      )}
      {brief.lots.length > 0 && (
        <BriefBlock icon={Layers} title={`${brief.lots.length} lot${brief.lots.length > 1 ? "s" : ""}`}>
          <div className="grid gap-2 sm:grid-cols-2">
            {brief.lots.map((l) => (
              <p key={l} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                {l}
              </p>
            ))}
          </div>
        </BriefBlock>
      )}
      {brief.documents.length > 0 && (
        <BriefBlock icon={FileText} title="Pièces à fournir">
          <List items={brief.documents} />
        </BriefBlock>
      )}
      <BriefBlock icon={Scale} title="Comment l'offre sera notée">
        {weighted ? (
          <div className="space-y-2.5">
            {criteria.map((c) => (
              <div key={c.label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-slate-700">{c.label}</span>
                  <span className="font-bold text-navy tabular-nums">{c.weight} %</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-teal to-violet" style={{ width: `${Math.min(100, c.weight ?? 0)}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : criteria.length > 0 ? (
          <List items={criteria.map((c) => c.label)} />
        ) : null}
        <p className={`text-slate-700 ${criteria.length ? "mt-3 text-sm" : ""}`}>{brief.judging}</p>
      </BriefBlock>
      {(brief.tips ?? []).length > 0 && (
        <div className="rounded-xl bg-gradient-to-br from-teal-50 to-white p-4 ring-1 ring-teal/30">
          <p className="flex items-center gap-2 font-bold text-navy">
            <Lightbulb className="size-4 text-teal-700" aria-hidden /> Conseils pour obtenir la meilleure note
          </p>
          <List items={brief.tips ?? []} />
        </div>
      )}
      {(brief.submission || brief.submission_url) && (
        <BriefBlock icon={Send} title="Où déposer votre offre">
          {brief.submission && <p className="text-slate-700">{brief.submission}</p>}
          {brief.submission_url && (
            <a
              href={brief.submission_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-teal-800 ring-1 ring-teal/40 transition hover:bg-teal-50"
            >
              <ExternalLink className="size-4 shrink-0" aria-hidden /> <span className="truncate">Espace de dépôt de l&apos;acheteur</span>
            </a>
          )}
        </BriefBlock>
      )}
      {brief.todo.length > 0 && (
        <BriefBlock icon={ClipboardCheck} title="Votre « à faire »">
          {steps && (
            <div className="mb-3 flex items-center gap-3" aria-live="polite">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-teal to-violet transition-all duration-500" style={{ width: `${Math.round((steps.done.length / brief.todo.length) * 100)}%` }} />
              </div>
              <p className="text-sm font-semibold text-navy">
                {steps.done.length}/{brief.todo.length} étape{brief.todo.length > 1 ? "s" : ""}
              </p>
            </div>
          )}
          <ol className="space-y-2">
            {brief.todo.map((t, i) => {
              const checked = steps?.done.includes(i) ?? false;
              return steps ? (
                <li key={t}>
                  <label className={`flex cursor-pointer gap-3 rounded-xl p-2 transition hover:bg-slate-50 ${checked ? "text-slate-400 line-through" : "text-slate-700"}`}>
                    <input type="checkbox" className="peer sr-only" checked={checked} disabled={steps.pending} onChange={(e) => steps.onToggle(i, e.target.checked)} />
                    <span
                      className={`inline-flex size-6 shrink-0 items-center justify-center rounded-md ring-2 transition peer-focus-visible:ring-teal ${checked ? "bg-gradient-to-br from-teal to-violet text-white ring-transparent" : "bg-white text-transparent ring-slate-300"}`}
                    >
                      <Check className="size-4" aria-hidden />
                    </span>
                    {t}
                  </label>
                </li>
              ) : (
                <li key={t} className="flex gap-3 text-slate-700">
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal to-violet text-xs font-bold text-white">{i + 1}</span>
                  {t}
                </li>
              );
            })}
          </ol>
          {steps && <p className="mt-2 text-xs text-slate-500">Cochez vos étapes : l&apos;appel d&apos;offres est suivi dans votre pipeline, visible par votre équipe seulement.</p>}
        </BriefBlock>
      )}
      {brief.warnings.length > 0 && (
        <div className="rounded-xl bg-rose-50 p-4 ring-1 ring-rose-200">
          <p className="flex items-center gap-2 font-semibold text-rose-800">
            <AlertTriangle className="size-4" aria-hidden /> Points d&apos;attention
          </p>
          <List items={brief.warnings} />
        </div>
      )}
      <p className="text-xs text-slate-500">D&apos;après l&apos;avis officiel{source ? ` (${source})` : ""}. En cas de doute, le dossier de consultation fait foi.</p>
    </div>
  );
}

function BriefBlock({ icon: Icon, title, children }: { icon: typeof Layers; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 font-bold text-navy">
        <Icon className="size-4 text-teal-700" aria-hidden /> {title}
      </h3>
      {children}
    </section>
  );
}

const List = ({ items }: { items: string[] }) => (
  <ul className="mt-2 space-y-1.5">
    {items.map((t) => (
      <li key={t} className="flex gap-2 text-slate-700">
        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal" aria-hidden /> {t}
      </li>
    ))}
  </ul>
);

/** Encadré de la fiche : complète pour Pro (préparée à la demande si besoin), floutée sinon. */
export function TenderBriefPanel({
  opportunityId,
  initial,
  source,
  allowed,
  upgrade,
  teaser = null,
  lockedTitle = "Réservé aux membres Pro",
  mine = null,
}: {
  opportunityId: string;
  initial: TenderBrief | null;
  source: string | null;
  allowed: boolean;
  upgrade: React.ReactNode;
  /** Résumé en une phrase, montré à ceux qui n'ont pas la fiche complète */
  teaser?: string | null;
  lockedTitle?: string;
  /** Certifications de la fiche de l'entreprise active (null sans entreprise) */
  mine?: string[] | null;
}) {
  const [brief, setBrief] = useState<TenderBrief | null>(initial);
  const [state, setState] = useState<"idle" | "loading" | "none" | "error">(initial ? "idle" : allowed ? "loading" : "idle");
  const [done, setDone] = useState<number[]>([]);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!allowed) return;
    let live = true;
    briefProgress(opportunityId)
      .then((p) => live && setDone(p.done))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [allowed, opportunityId]);
  const toggle = (step: number, value: boolean) => {
    const before = done;
    setDone(value ? [...done, step].sort((a, b) => a - b) : done.filter((x) => x !== step));
    setPending(true);
    toggleBriefStep(opportunityId, step, value)
      .then((r) => {
        if (r.ok) {
          setDone(r.done);
          setNotice(before.length === 0 && value ? "Ajouté à votre pipeline : vos étapes sont enregistrées." : null);
        } else {
          setDone(before);
          setNotice(r.error);
        }
      })
      .catch(() => setDone(before))
      .finally(() => setPending(false));
  };
  useEffect(() => {
    if (!allowed || initial) return;
    let live = true;
    loadTenderBrief(opportunityId)
      .then((r) => {
        if (!live) return;
        if (r.ok && r.brief) {
          setBrief(r.brief);
          setState("idle");
        } else setState(r.ok ? "none" : "error");
      })
      .catch(() => live && setState("error"));
    return () => {
      live = false;
    };
  }, [allowed, initial, opportunityId]);
  if (allowed && state === "none") return null;
  return (
    <section aria-labelledby="fiche-synthese" className="relative mt-8 overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-gradient-to-br from-teal/20 to-violet/20 blur-3xl" />
      <div className="relative">
        <h2 id="fiche-synthese" className="flex flex-wrap items-center gap-2 text-xl font-bold text-navy">
          <Sparkles className="size-5 text-teal-700" aria-hidden /> Fiche synthèse
          <span className="rounded-full bg-gradient-to-r from-teal to-violet px-2.5 py-0.5 text-xs font-bold text-white">Pro</span>
        </h2>
        <p className="mt-1 text-sm text-slate-500">L&apos;essentiel de l&apos;avis officiel en 30 secondes, et comment préparer votre réponse.</p>
        <div className="mt-5">
          {allowed && brief ? (
            <>
              <div className="mb-5 flex flex-wrap gap-2">
                <a href={`/api/opportunites/${opportunityId}/fiche?format=pdf`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white transition hover:bg-navy/90">
                  <Download className="size-4" aria-hidden /> PDF
                </a>
                <a href={`/api/opportunites/${opportunityId}/fiche?format=doc`} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-navy ring-1 ring-slate-300 transition hover:bg-slate-50">
                  <Download className="size-4" aria-hidden /> Word
                </a>
              </div>
              {notice && <p className="mb-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800 ring-1 ring-teal/20">{notice}</p>}
              <TenderBriefView brief={brief} source={source} steps={{ done, onToggle: toggle, pending }} opportunityId={opportunityId} mine={mine} />
            </>
          ) : allowed && state === "loading" ? (
            <div className="space-y-3" aria-live="polite">
              <p className="text-sm font-semibold text-teal-700">Préparation de la fiche… (quelques secondes)</p>
              {[80, 95, 60, 85].map((w) => (
                <div key={w} className="h-4 animate-pulse rounded bg-slate-100" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : allowed ? (
            <p className="text-sm text-slate-600">La fiche n&apos;a pas pu être préparée pour le moment. Réessayez un peu plus tard.</p>
          ) : (
            <div className="relative">
              {teaser && <p className="mb-4 text-lg text-navy">{teaser}</p>}
              <div aria-hidden className="pointer-events-none space-y-3 blur-sm select-none">
                <p className="text-lg text-navy">Des entreprises pour réaliser les travaux décrits dans l&apos;avis, en plusieurs lots…</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {["Remise des offres", "Visite obligatoire", "Durée", "Prix"].map((l) => (
                    <div key={l} className="h-14 rounded-xl bg-slate-100" />
                  ))}
                </div>
                <div className="h-24 rounded-xl bg-slate-100" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="max-w-sm rounded-2xl bg-white/95 p-5 text-center shadow-lg ring-1 ring-slate-200">
                  <Lock className="mx-auto size-6 text-teal-700" aria-hidden />
                  <p className="mt-2 font-bold text-navy">{lockedTitle}</p>
                  <p className="mt-1 text-sm text-slate-600">Certifications exigées, pièces à fournir, notation, où déposer et conseils pour gagner.</p>
                  <div className="mt-4">{upgrade}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
