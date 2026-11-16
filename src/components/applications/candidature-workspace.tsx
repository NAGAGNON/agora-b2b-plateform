"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FolderDown,
  Hourglass,
  Lightbulb,
  MapPinned,
  PenLine,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  ThumbsDown,
  Trophy,
  Users,
  BookOpen,
  CalendarPlus,
  MessageSquareText,
  Trash2,
  Route,
  ThumbsUp,
  XCircle,
  Bookmark,
  BellRing,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { TenderBrief } from "@/lib/tender-brief";
import { certStatus } from "@/lib/certification-match";
import { APPLICATION_GUIDE, LOST_ADVICE, questionTemplate, rejectionTemplate } from "@/lib/application-guide";
import { applicationPlan } from "@/lib/application-plan";
import { buildMemoirDraft, type DraftCompany } from "@/lib/memoir-draft";
import { addJournalNote, answerApplicationResult, deleteJournalNote, keepForLater, markApplicationSent, saveDraft, startApplicationGuide, toggleDocStep, toggleGuideStep, withdrawApplication, type JournalEntry } from "@/app/actions/applications";
import { loadTenderBrief } from "@/app/actions/tender-brief";
import { goBackToSearch } from "@/components/applications/return-point";
import { ApplicationAssistant } from "@/components/applications/application-assistant";
import { StepsProgress } from "@/components/applications/steps-progress";
import type { AssistantMessage } from "@/app/actions/application-assistant";

export type WorkspaceData = {
  id: string;
  title: string;
  buyer: string | null;
  place: string | null;
  deadline: string | null;
  stage: string;
  submittedAt: string | null;
  guideDone: number[];
  docsDone: number[];
  draft: string | null;
  brief: TenderBrief | null;
  briefAllowed: boolean;
  canLoadBrief: boolean;
  sourceLabel: string | null;
  hasSource: boolean;
  mine: string[];
  company: DraftCompany;
  startedAt: string | null;
  reference: string | null;
  journal: JournalEntry[];
  questions: AssistantMessage[];
};

const SHORT = ["Conditions", "Dossier", "Questions et visite", "Pièces", "Rédaction", "Dépôt"];
const nowMs = () => Date.now();
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** Espace de travail d'une candidature : tout ce qu'il faut pour répondre, étape par étape. */
export function CandidatureWorkspace({ data }: { data: WorkspaceData }) {
  const [brief, setBrief] = useState<TenderBrief | null>(data.brief);
  const [briefState, setBriefState] = useState<"ready" | "loading" | "none">(data.brief ? "ready" : data.canLoadBrief ? "loading" : "none");
  const [done, setDone] = useState<number[]>(data.guideDone);
  const [docs, setDocs] = useState<number[]>(data.docsDone);
  const [stage, setStage] = useState(data.stage);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (briefState !== "loading") return;
    let live = true;
    loadTenderBrief(data.id)
      .then((r) => {
        if (!live) return;
        if (r.ok && r.brief) {
          setBrief(r.brief);
          setBriefState("ready");
        } else setBriefState("none");
      })
      .catch(() => live && setBriefState("none"));
    return () => {
      live = false;
    };
  }, [briefState, data.id]);

  const sent = ["RESPONSE_SENT", "DISCUSSION", "NEGOTIATION", "WON", "LOST"].includes(stage);
  // Offre « à l'étude » : la personne découvre avant de décider de répondre
  const discovery = ["DETECTED", "QUALIFIED", "INTERESTED"].includes(stage);
  const prepare = () => act(() => startApplicationGuide(data.id), "RESPONSE_PREPARING");
  const later = stage === "INTERESTED";
  // Cocher « je la garde pour plus tard » : enregistré, la personne reste sur la page et continue de lire
  const keep = () => {
    const value = !later;
    const before = stage;
    setStage(value ? "INTERESTED" : "DETECTED");
    start(async () => {
      setError(null);
      const r = await keepForLater(data.id, value);
      if (!r.ok) {
        setStage(before);
        setError(r.error ?? "Réessayez.");
      }
    });
  };
  // Retour de l'annonce officielle (onglet de l'acheteur) : fenêtre obligatoire avec les questions de décision
  const leftForSource = useRef<number | null>(null);
  const [returnAsk, setReturnAsk] = useState<"ask" | null>(null);
  const goToSource = () => {
    leftForSource.current = Date.now();
  };
  useEffect(() => {
    const onBack = () => {
      if (document.visibilityState !== "visible" || leftForSource.current === null) return;
      const away = Date.now() - leftForSource.current;
      leftForSource.current = null;
      if (away >= 3000 && ["DETECTED", "QUALIFIED", "INTERESTED"].includes(stage)) setReturnAsk("ask");
    };
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("focus", onBack);
    return () => {
      document.removeEventListener("visibilitychange", onBack);
      window.removeEventListener("focus", onBack);
    };
  }, [stage]);
  // Réponse à la fenêtre de retour : aide sur cette offre, à plus tard, ou d'autres offres
  const answerReturn = (choice: "help" | "later" | "others") => {
    setReturnAsk(null);
    if (choice === "help") {
      if (discovery) prepare();
    } else if (choice === "later") {
      if (!later) keep();
    } else withdraw(false);
  };
  const withdraw = (confirm: boolean) => {
    if (confirm && !window.confirm("Retirer cette offre de vos candidatures et retourner à vos recherches ?")) return;
    start(async () => {
      const r = await withdrawApplication(data.id);
      if (r.ok) goBackToSearch();
      else setError(r.error);
    });
  };
  const progress = sent ? 100 : Math.round((done.length / APPLICATION_GUIDE.length) * 100);
  const days = data.deadline ? Math.ceil((new Date(data.deadline).getTime() - nowMs()) / 86_400_000) : null;
  const nextStep = APPLICATION_GUIDE.findIndex((_, i) => !done.includes(i));
  const plan = useMemo(() => (sent ? [] : applicationPlan(data.deadline, done, new Date(nowMs()), data.startedAt)), [sent, data.deadline, done, data.startedAt]);
  const tpl = { title: data.title, buyer: data.buyer, reference: data.reference, company: data.company.name };

  const toggleStep = (i: number, value: boolean) => {
    const before = done;
    setDone(value ? [...done, i].sort((a, b) => a - b) : done.filter((x) => x !== i));
    start(async () => {
      const r = await toggleGuideStep(data.id, i, value);
      if (r.ok) {
        setDone(r.done);
        if (value && discovery) setStage("RESPONSE_PREPARING");
      }
      else {
        setDone(before);
        setError(r.error);
      }
    });
  };
  const toggleDoc = (i: number, value: boolean) => {
    const before = docs;
    setDocs(value ? [...docs, i] : docs.filter((x) => x !== i));
    start(async () => {
      const r = await toggleDocStep(data.id, i, value);
      if (r.ok) {
        setDocs(r.done);
        // Première pièce cochée sur une offre seulement consultée : la candidature commence
        if (value && stage === "DETECTED") setStage("RESPONSE_PREPARING");
      }
      else {
        setDocs(before);
        setError(r.error);
      }
    });
  };
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, next: string) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) setStage(next);
      else setError(r.error ?? "Réessayez.");
    });
  const scrollTo = (i: number) => document.getElementById(`etape-${i + 1}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const facts = [
    data.deadline && { icon: CalendarClock, label: "Date limite", value: fmtDay(data.deadline), hot: days !== null && days <= 5 },
    brief?.site_visit && { icon: MapPinned, label: "Visite", value: /obligatoire/i.test(brief.site_visit) ? "Obligatoire" : "Prévue", hot: /obligatoire/i.test(brief.site_visit) },
    brief?.duration && { icon: Hourglass, label: "Durée", value: brief.duration, hot: false },
    brief?.pricing && { icon: Tag, label: "Prix", value: brief.pricing, hot: false },
  ].filter(Boolean) as { icon: typeof CalendarClock; label: string; value: string; hot: boolean }[];

  return (
    <div className="space-y-8 pb-16">
      {returnAsk && (
        // Fenêtre bloquante : pas de fermeture en cliquant à côté, il faut répondre
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-navy/50 p-3 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="return-title" data-testid="return-ask">
          <div className="w-full max-w-lg animate-rise rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-200 sm:p-7">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal to-violet text-white shadow-lg shadow-teal/20">
                <BellRing className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p id="return-title" className="font-heading text-lg font-bold text-navy sm:text-xl">
                  Vous avez vu l&apos;annonce officielle. Que fait-on de cette offre ?
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{data.title}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-2">
              <button type="button" disabled={pending} onClick={() => answerReturn("help")} className="btn-shine flex items-center gap-3 rounded-2xl bg-gradient-to-r from-teal to-electric px-4 py-3.5 text-left font-semibold text-navy shadow-lg shadow-teal/20 transition hover:-translate-y-0.5" data-testid="return-help">
                <ThumbsUp className="size-5 shrink-0" aria-hidden />
                <span>
                  Je continue sur cette offre, aidez-moi
                  <span className="block text-xs font-normal text-navy/70">Elle reste dans « Mes candidatures » avec le suivi étape par étape</span>
                </span>
              </button>
              <button type="button" disabled={pending} onClick={() => answerReturn("later")} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left font-semibold text-navy ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-teal" data-testid="return-later">
                <Bookmark className="size-5 shrink-0 text-teal-700" aria-hidden />
                <span>
                  Je la garde pour plus tard
                  <span className="block text-xs font-normal text-slate-500">
                    Gardée dans « Mes candidatures »{days !== null && days > 0 ? ", rappel par e-mail 7 jours puis 2 jours avant la date limite" : ""}
                  </span>
                </span>
              </button>
              <button type="button" disabled={pending} onClick={() => answerReturn("others")} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left font-semibold text-navy ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-violet-300" data-testid="return-others">
                <Search className="size-5 shrink-0 text-violet-600" aria-hidden />
                <span>
                  Voir d&apos;autres offres
                  <span className="block text-xs font-normal text-slate-500">Celle-ci ne m&apos;intéresse pas : retour à mes recherches</span>
                </span>
              </button>
            </div>
            <Link href="/dashboard/candidatures" className="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-navy" data-testid="return-all">
              <ArrowLeft className="size-4" aria-hidden /> Retour à toutes mes candidatures
            </Link>
          </div>
        </div>
      )}
      {/* En-tête */}
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-sky via-white to-teal-50 p-5 shadow-sm ring-1 ring-slate-200 sm:p-10">
        <div aria-hidden className="bg-tech-grid-light pointer-events-none absolute inset-0 -z-10 opacity-70" />
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 -z-10 size-80 animate-aurora rounded-full bg-teal/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 left-1/3 -z-10 size-80 animate-aurora rounded-full bg-violet/15 blur-3xl [animation-delay:-6s]" />
        {data.hasSource && (
          <a
            href={`/go/${data.id}`}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={goToSource}
            data-testid="official-top"
            className="group mb-6 flex animate-rise items-center gap-3 rounded-2xl bg-navy p-3 pr-4 text-white shadow-lg shadow-navy/20 ring-1 ring-navy transition hover:-translate-y-0.5 hover:shadow-xl sm:mb-8 sm:p-4"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal to-electric text-navy">
              <ExternalLink className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Voir l&apos;annonce officielle{data.sourceLabel ? ` (${data.sourceLabel})` : ""}</span>
              <span className="block text-xs text-white/70 sm:text-sm">Le dossier complet sur le site de l&apos;acheteur · s&apos;ouvre dans un nouvel onglet, cette page reste ouverte</span>
            </span>
            <span className="hidden shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold ring-1 ring-white/20 transition group-hover:bg-white/20 sm:inline">Ouvrir ↗</span>
          </a>
        )}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <p className="inline-flex animate-rise items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-bold tracking-wide text-teal-700 uppercase shadow-sm ring-1 ring-teal/20">
              <Sparkles className="size-3.5" aria-hidden /> Ma candidature
            </p>
            <h1 className="mt-4 animate-rise font-heading text-xl leading-tight font-extrabold text-balance text-navy [animation-delay:80ms] sm:text-4xl">{data.title}</h1>
            <p className="mt-2 animate-rise text-slate-600 [animation-delay:140ms]">
              {data.buyer ?? "Besoin publié sur LinkProB2B"}
              {data.place ? ` · ${data.place}` : ""}
            </p>
            {facts.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {facts.map(({ icon: Icon, label, value, hot }, i) => (
                  <span
                    key={label}
                    className={cn("plan-in inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-xs shadow-sm ring-1 sm:gap-2 sm:px-3.5 sm:py-2 sm:text-sm", hot ? "bg-rose-50 text-rose-800 ring-rose-200" : "bg-white text-slate-700 ring-slate-200")}
                    style={{ animationDelay: `${200 + i * 70}ms` }}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="text-slate-500">{label} :</span> <span className="font-semibold">{value}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Sur téléphone, l'anneau n'apparaît qu'une fois la préparation commencée */}
          <div className={cn("justify-center", discovery ? "hidden lg:flex" : "flex")}>
            <ProgressRing value={progress} label={sent ? "Réponse envoyée" : discovery ? "À l'étude" : progress >= 100 ? "Candidature prête" : "En préparation"} />
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:mt-8 sm:flex-row sm:flex-wrap sm:gap-3">
          <button
            type="button"
            onClick={() => goBackToSearch()}
            className="btn-shine inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3 font-semibold text-white shadow-lg shadow-navy/20 transition hover:-translate-y-0.5 active:scale-[0.98]"
            data-testid="continue-search"
          >
            <Search className="size-4" aria-hidden /> Continuer mes recherches
          </button>
          <Link href="/dashboard/candidatures" className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 transition hover:bg-white/70 hover:text-navy">
            <ArrowLeft className="size-4" aria-hidden /> Toutes mes candidatures
          </Link>
          {!discovery && !sent && (
            <button type="button" disabled={pending} onClick={() => withdraw(true)} className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-slate-400 transition hover:bg-white/70 hover:text-rose-700">
              <XCircle className="size-4" aria-hidden /> Cette offre ne m&apos;intéresse plus
            </button>
          )}
        </div>
      </section>

      {/* À l'étude : la décision, sans engagement */}
      {discovery && (
        <section className="plan-in relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-white to-teal-50/60 p-6 shadow-lg ring-1 ring-teal/30 sm:p-8" data-testid="decision">
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-64 animate-aurora rounded-full bg-teal/15 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 size-56 animate-aurora rounded-full bg-violet/10 blur-3xl [animation-delay:-4s]" />
          <div className="relative text-center">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold tracking-wide text-teal-700 uppercase shadow-sm ring-1 ring-teal/20">
              {later ? (
                <>
                  <Bookmark className="size-3.5" aria-hidden /> Gardée pour plus tard
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" aria-hidden /> À l&apos;étude
                </>
              )}
            </p>
            <h2 className="mt-3 font-heading text-2xl font-extrabold text-balance text-navy sm:text-3xl">Alors, cette offre vous intéresse ?</h2>
            <p className="mx-auto mt-2 max-w-2xl text-balance text-slate-600">
              {later
                ? "Elle est enregistrée dans vos candidatures. Continuez à lire les infos ci-dessous ; quand vous êtes prêt, on vous accompagne étape par étape."
                : "Parcourez les conditions, les pièces et la notation ci-dessous, puis choisissez. Vous pouvez changer d'avis à tout moment."}
            </p>
          </div>
          <div className="relative mt-5 grid gap-2.5 sm:mt-6 sm:grid-cols-3 sm:gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={prepare}
              className="btn-shine group flex items-center gap-3 rounded-2xl text-left sm:flex-col sm:gap-2 sm:text-center bg-gradient-to-br from-teal to-electric p-4 sm:p-5 text-navy shadow-lg shadow-teal/25 transition hover:-translate-y-1 hover:shadow-xl active:scale-[0.98] disabled:opacity-50"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/30 ring-1 ring-white/50 transition group-hover:scale-110">
                <ThumbsUp className="size-5" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5 sm:items-center">
              <span className="font-heading text-base font-bold">Oui, je prépare ma candidature</span>
              <span className="text-xs text-navy/75">On vous guide jusqu&apos;au dépôt</span></span>
            </button>
            <button
              type="button"
              onClick={keep}
              role="checkbox"
              aria-checked={later}
              data-testid="keep-later"
              className={cn(
                "group flex items-center gap-3 rounded-2xl text-left sm:flex-col sm:gap-2 sm:text-center p-4 sm:p-5 transition hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]",
                later ? "bg-teal-50 text-teal-900 shadow-md ring-2 ring-teal" : "bg-white text-navy shadow-sm ring-1 ring-slate-200 hover:ring-teal",
              )}
            >
              <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full transition group-hover:scale-110", later ? "bg-teal text-white" : "bg-sky text-teal-700 ring-1 ring-teal/30")}>
                {later ? <Check className="size-5" aria-hidden /> : <Bookmark className="size-5" aria-hidden />}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5 sm:items-center">
              <span className="font-heading text-base font-bold">{later ? "Gardée pour plus tard" : "Oui, je la garde pour plus tard"}</span>
              <span className="text-xs text-slate-500">{later ? "Cliquez pour décocher" : "Enregistrée dans Mes candidatures"}</span></span>
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => withdraw(later)}
              className="group flex items-center gap-3 rounded-2xl text-left sm:flex-col sm:gap-2 sm:text-center bg-white p-4 sm:p-5 text-navy shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg hover:ring-rose-300 active:scale-[0.98] disabled:opacity-50"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition group-hover:scale-110 group-hover:bg-rose-50 group-hover:text-rose-600">
                <XCircle className="size-5" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5 sm:items-center">
              <span className="font-heading text-base font-bold">{later ? "Ne m'intéresse plus" : "Non, pas pour moi"}</span>
              <span className="text-xs text-slate-500">Retour à vos recherches, au même endroit</span></span>
            </button>
          </div>
        </section>
      )}

      {/* Où en est la candidature : visible dès le haut de la page */}
      {!discovery && (
        <div className="plan-in">
          <StepsProgress done={done} sent={sent} />
        </div>
      )}

      {/* L'essentiel */}
      {(brief || briefState === "loading") && (
        <section className="plan-in grid gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-teal-700 uppercase">
              <BookOpen className="size-4" aria-hidden /> L&apos;essentiel en 30 secondes
            </p>
            {brief ? (
              <p className="mt-3 text-lg leading-relaxed text-navy">{brief.summary}</p>
            ) : (
              <div className="mt-3 space-y-2">
                {[90, 70].map((w) => (
                  <div key={w} className="h-4 animate-pulse rounded-full bg-slate-100" style={{ width: `${w}%` }} />
                ))}
              </div>
            )}
            {data.deadline && (
              <a href={`/api/opportunites/${data.id}/agenda`} download className="mt-4 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-teal-800 ring-1 ring-teal/40 transition hover:-translate-y-0.5 hover:bg-teal-50">
                <CalendarPlus className="size-4" aria-hidden /> Ajouter la date limite à mon agenda
              </a>
            )}
          </div>
          {brief && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { n: (brief.certifications ?? []).length + (brief.capacity ?? []).length, l: "conditions vérifiées" },
                { n: brief.documents.length, l: "pièces listées" },
                { n: (brief.criteria ?? []).length, l: "critères de notation" },
                { n: (brief.tips ?? []).length + brief.warnings.length, l: "conseils et pièges" },
              ].map((x, i) => (
                <div key={x.l} className="plan-in rounded-2xl bg-gradient-to-br from-sky to-white p-4 ring-1 ring-slate-200" style={{ animationDelay: `${i * 80}ms` }}>
                  <p className="font-heading text-3xl font-extrabold text-navy tabular-nums">{x.n}</p>
                  <p className="text-sm text-slate-600">{x.l}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Frise des étapes */}
      <nav aria-label="Étapes de la candidature" className="sticky top-20 z-20 rounded-2xl bg-white/95 p-3 shadow-md ring-1 ring-slate-200">
        <div className="relative">
          <div aria-hidden className="absolute top-5 right-8 left-8 hidden h-1 rounded-full bg-slate-100 sm:block">
            <div className="h-full rounded-full bg-gradient-to-r from-teal to-violet transition-all duration-700" style={{ width: `${(Math.max(0, done.length - 1) / (APPLICATION_GUIDE.length - 1)) * 100}%` }} />
          </div>
          <ol className="relative flex gap-2 overflow-x-auto sm:justify-between">
            {SHORT.map((label, i) => {
              const ok = done.includes(i) || sent;
              const current = !sent && i === nextStep;
              return (
                <li key={label} className="shrink-0">
                  <button type="button" onClick={() => scrollTo(i)} className="group flex flex-col items-center gap-1.5 rounded-xl px-2 py-1 transition hover:bg-slate-50">
                    <span
                      className={cn(
                        "flex size-10 items-center justify-center rounded-full text-sm font-bold ring-4 ring-white transition-all duration-300",
                        ok ? "bg-gradient-to-br from-teal to-violet text-white" : current ? "scale-110 bg-navy text-white" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200",
                      )}
                    >
                      {ok ? <Check className="size-5" aria-hidden /> : i + 1}
                    </span>
                    <span className={cn("text-xs font-semibold whitespace-nowrap", ok ? "text-teal-700" : current ? "text-navy" : "text-slate-500")}>{label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {/* 1. Conditions */}
          <Step n={1} title="Puis-je répondre ?" subtitle="Les conditions exigées par l'acheteur, comparées à votre fiche entreprise." done={done.includes(0)} onToggle={(v) => toggleStep(0, v)} pending={pending}>
            <BriefZone state={briefState} brief={brief} allowed={data.briefAllowed}>
              {(b) => <Conditions brief={b} mine={data.mine} id={data.id} />}
            </BriefZone>
          </Step>

          {/* 2. Dossier */}
          <Step n={2} title="Télécharger le dossier" subtitle="Règlement de la consultation, cahier des charges et documents de prix." done={done.includes(1)} onToggle={(v) => toggleStep(1, v)} pending={pending}>
            <BriefZone state={briefState} brief={brief} allowed={data.briefAllowed}>
              {(b) => (
                <div className="space-y-4">
                  <InfoCard icon={FolderDown} title="Où trouver le dossier" tone="teal">
                    <p>{b.submission ?? "Sur la plateforme de l'acheteur, indiquée dans l'annonce officielle (lien en haut de cette page)."}</p>
                    {b.submission_url && (
                      <a
                        href={b.submission_url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-teal-800 ring-1 ring-teal/40 transition hover:-translate-y-0.5"
                      >
                        <ExternalLink className="size-4" aria-hidden /> Espace de dépôt de l&apos;acheteur
                      </a>
                    )}
                  </InfoCard>
                  {b.lots.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {b.lots.map((l) => (
                        <p key={l} className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200">
                          {l}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </BriefZone>
            <HowTo items={APPLICATION_GUIDE[1].how} />
          </Step>

          {/* 3. Questions et visite */}
          <Step n={3} title="Questions et visite" subtitle="Lever vos doutes avant de chiffrer, et ne pas manquer une visite obligatoire." done={done.includes(2)} onToggle={(v) => toggleStep(2, v)} pending={pending}>
            {brief?.site_visit ? (
              <InfoCard icon={MapPinned} title={/obligatoire/i.test(brief.site_visit) ? "Visite obligatoire" : "Visite"} tone={/obligatoire/i.test(brief.site_visit) ? "rose" : "teal"}>
                <p>{brief.site_visit}</p>
              </InfoCard>
            ) : briefState === "ready" ? (
              <p className="text-sm text-slate-600">L&apos;avis ne mentionne pas de visite. Vérifiez dans le règlement de la consultation.</p>
            ) : null}
            <TemplateCard icon={MessageSquareText} title="Modèle de question à l'acheteur" text={questionTemplate(tpl)} />
            <HowTo items={APPLICATION_GUIDE[2].how} />
          </Step>

          {/* 4. Pièces */}
          <Step n={4} title="Rassembler les pièces" subtitle="Cochez chaque pièce dès qu'elle est prête." done={done.includes(3)} onToggle={(v) => toggleStep(3, v)} pending={pending}>
            <BriefZone state={briefState} brief={brief} allowed={data.briefAllowed}>
              {(b) =>
                b.documents.length ? (
                  <div>
                    <div className="mb-3 flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-teal to-violet transition-all duration-500" style={{ width: `${(docs.length / b.documents.length) * 100}%` }} />
                      </div>
                      <span className="text-sm font-semibold text-navy">
                        {docs.length}/{b.documents.length} prêtes
                      </span>
                    </div>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {b.documents.map((d, i) => {
                        const ok = docs.includes(i);
                        return (
                          <li key={d}>
                            <label className={cn("flex cursor-pointer items-center gap-3 rounded-xl p-3 ring-1 transition hover:-translate-y-0.5", ok ? "bg-teal-50 ring-teal/30" : "bg-white ring-slate-200 hover:ring-teal")}>
                              <input type="checkbox" className="peer sr-only" checked={ok} disabled={pending} onChange={(e) => toggleDoc(i, e.target.checked)} />
                              <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md ring-2 transition peer-focus-visible:ring-teal", ok ? "bg-gradient-to-br from-teal to-violet text-white ring-transparent" : "text-transparent ring-slate-300")}>
                                <Check className="size-4" aria-hidden />
                              </span>
                              <span className={cn("text-sm", ok ? "text-slate-500 line-through" : "font-medium text-slate-800")}>{d}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">L&apos;avis renvoie la liste des pièces au règlement de la consultation.</p>
                )
              }
            </BriefZone>
            <HowTo items={APPLICATION_GUIDE[3].how} />
          </Step>

          {/* 5. Rédaction */}
          <Step n={5} title="Rédiger votre réponse" subtitle="Ce qui rapporte des points, et une trame de mémoire technique déjà préparée pour vous." done={done.includes(4)} onToggle={(v) => toggleStep(4, v)} pending={pending}>
            {brief && (
              <div className="space-y-5">
                {(brief.criteria ?? []).length > 0 && (
                  <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
                    <p className="mb-3 font-bold text-navy">Comment l&apos;offre sera notée</p>
                    <div className="space-y-3">
                      {(brief.criteria ?? []).map((c, i) => (
                        <div key={c.label}>
                          <div className="flex justify-between gap-3 text-sm">
                            <span className="text-slate-700">{c.label}</span>
                            {c.weight ? <span className="font-bold text-navy tabular-nums">{c.weight} %</span> : null}
                          </div>
                          {c.weight ? (
                            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                              <div className="plan-in h-full rounded-full bg-gradient-to-r from-teal to-violet" style={{ width: `${Math.min(100, c.weight)}%`, animationDelay: `${i * 120}ms` }} />
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(brief.tips ?? []).length > 0 && (
                  <InfoCard icon={Lightbulb} title="Conseils pour obtenir la meilleure note" tone="teal">
                    <Bullets items={brief.tips ?? []} />
                  </InfoCard>
                )}
              </div>
            )}
            <DraftEditor id={data.id} initial={data.draft} make={() => buildMemoirDraft({ title: data.title, buyer: data.buyer }, brief, data.company)} />
            <HowTo items={APPLICATION_GUIDE[4].how} />
          </Step>

          {/* 6. Dépôt */}
          <Step n={6} title="Déposer avant la date limite" subtitle="Sur la plateforme de l'acheteur, sans attendre la dernière heure." done={done.includes(5)} onToggle={(v) => toggleStep(5, v)} pending={pending}>
            <div className="space-y-4">
              {brief?.submission && (
                <InfoCard icon={Send} title="Où déposer" tone="teal">
                  <p>{brief.submission}</p>
                </InfoCard>
              )}
              <HowTo items={APPLICATION_GUIDE[5].how} open />
              {!sent ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => act(() => markApplicationSent(data.id), "RESPONSE_SENT")}
                  className="btn-shine inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal to-electric px-6 py-4 text-lg font-bold text-navy shadow-xl shadow-teal/25 transition hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50"
                >
                  <Send className="size-5" aria-hidden /> J&apos;ai déposé ma réponse
                </button>
              ) : (
                <Result stage={stage} pending={pending} onWon={() => act(() => answerApplicationResult(data.id, "WON"), "WON")} onLost={() => act(() => answerApplicationResult(data.id, "LOST"), "LOST")} submittedAt={data.submittedAt} rejection={rejectionTemplate(tpl)} />
              )}
            </div>
          </Step>
          {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-200">{error}</p>}

          {stage !== "DETECTED" && <Journal id={data.id} initial={data.journal} />}

          {/* Une question ? L'assistant répond à partir de l'avis */}
          <ApplicationAssistant id={data.id} initial={data.questions} suggestions={assistantSuggestions(brief, data.mine)} />

          {/* Fin de page : l'annonce officielle, une fois tout l'accompagnement parcouru */}
          <section className="plan-in relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-navy-900 p-6 text-white shadow-xl sm:p-8" data-testid="official-section">
            <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 -z-10 size-64 animate-aurora rounded-full bg-teal/30 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-24 left-10 -z-10 size-56 animate-aurora rounded-full bg-violet/25 blur-3xl [animation-delay:-5s]" />
            <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-teal-200 uppercase">
              <Sparkles className="size-4" aria-hidden /> Vous avez tout en main
            </p>
            <h2 className="mt-2 font-heading text-2xl font-extrabold text-white">Prêt à passer sur l&apos;annonce officielle ?</h2>
            <p className="mt-2 max-w-2xl text-white/75">
              Conditions vérifiées, pièces listées, notation comprise et trame du mémoire préparée : téléchargez maintenant le dossier complet sur le site de l&apos;acheteur.
              Votre candidature reste ici, enregistrée, pour suivre chaque étape.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {data.hasSource && (
                <a
                  href={`/go/${data.id}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  onClick={goToSource}
                  className="btn-shine inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal to-electric px-5 py-3 font-semibold text-navy shadow-lg shadow-teal/25 transition hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <ExternalLink className="size-4" aria-hidden /> Voir l&apos;annonce officielle
                </a>
              )}
              <button
                type="button"
                onClick={() => goBackToSearch()}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 font-semibold text-white ring-1 ring-white/20 transition hover:-translate-y-0.5 hover:bg-white/15 active:scale-[0.98]"
              >
                <Search className="size-4" aria-hidden /> Continuer mes recherches
              </button>
            </div>
          </section>
        </div>

        {/* Récap */}
        <aside className="space-y-4 lg:sticky lg:top-44 lg:self-start">
          {days !== null && (
            <div className="plan-in relative overflow-hidden rounded-3xl bg-navy p-6 text-white shadow-xl">
              <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-teal/30 blur-3xl" />
              <p className="relative text-xs font-bold tracking-wide text-teal-200 uppercase">Avant la date limite</p>
              <p className="relative mt-1 font-heading text-6xl font-extrabold text-white tabular-nums">{Math.max(0, days)}</p>
              <p className="relative text-white/80">{days < 0 ? "date limite dépassée" : `jour${days > 1 ? "s" : ""} restant${days > 1 ? "s" : ""}`}</p>
            </div>
          )}
          {plan.length > 0 && (
            <div className="plan-in rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 [animation-delay:120ms]">
              <p className="flex items-center gap-2 font-bold text-navy">
                <Route className="size-4 text-teal-700" aria-hidden /> Mon planning conseillé
              </p>
              <p className="mt-1 text-xs text-slate-500">Une étape par jour clé, jusqu&apos;à la veille de la date limite.</p>
              <ol className="mt-4 space-y-1">
                {plan.map((p) => (
                  <li key={p.step}>
                    <button
                      type="button"
                      onClick={() => scrollTo(p.step)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-slate-50",
                        p.status === "today" && "bg-teal-50 ring-1 ring-teal/30",
                        p.status === "late" && "bg-rose-50 ring-1 ring-rose-200",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          p.status === "done" ? "bg-gradient-to-br from-teal to-violet text-white" : p.status === "late" ? "bg-rose-500 text-white" : p.status === "today" ? "bg-navy text-white" : "bg-slate-100 text-slate-500",
                        )}
                      >
                        {p.status === "done" ? <Check className="size-3.5" aria-hidden /> : p.step + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm font-semibold", p.status === "done" ? "text-slate-400 line-through" : "text-navy")}>{p.title}</span>
                        <span className={cn("text-xs", p.status === "late" ? "font-semibold text-rose-700" : p.status === "today" ? "font-semibold text-teal-800" : "text-slate-500")}>
                          {p.status === "late" ? "En retard · " : p.status === "today" ? "Aujourd'hui · " : ""}
                          {p.date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {brief && brief.todo.length > 0 && (
            <div className="plan-in rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 [animation-delay:200ms]">
              <p className="flex items-center gap-2 font-bold text-navy">
                <ClipboardCheck className="size-4 text-teal-700" aria-hidden /> Le calendrier de l&apos;acheteur
              </p>
              <ol className="mt-3 space-y-3 border-l-2 border-teal/30 pl-4">
                {brief.todo.map((t) => (
                  <li key={t} className="relative text-sm text-slate-700">
                    <span aria-hidden className="absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full bg-teal ring-4 ring-white" />
                    {t}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {brief && brief.warnings.length > 0 && (
            <div className="plan-in rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200 [animation-delay:280ms]">
              <p className="flex items-center gap-2 font-bold text-rose-800">
                <AlertTriangle className="size-4" aria-hidden /> Points d&apos;attention
              </p>
              <Bullets items={brief.warnings} />
            </div>
          )}
          {data.sourceLabel && <p className="px-2 text-xs text-slate-500">D&apos;après l&apos;avis officiel ({data.sourceLabel}). En cas de doute, le dossier de consultation fait foi.</p>}
        </aside>
      </div>
    </div>
  );
}

/** Anneau de progression animé. */
function ProgressRing({ value, label }: { value: number; label: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex shrink-0 flex-col items-center">
      <div className="relative size-36">
        <svg viewBox="0 0 120 120" className="size-36 -rotate-90" aria-hidden>
          <defs>
            <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#14c2ad" />
              <stop offset="100%" stopColor="#7c6cff" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle cx="60" cy="60" r={r} fill="none" stroke="url(#ring-grad)" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} className="transition-[stroke-dashoffset] duration-1000 ease-out" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-heading text-3xl font-extrabold text-navy tabular-nums">{value} %</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-600">{label}</p>
    </div>
  );
}

function Step({ n, title, subtitle, done, onToggle, pending, children }: { n: number; title: string; subtitle: string; done: boolean; onToggle: (v: boolean) => void; pending: boolean; children: React.ReactNode }) {
  return (
    <section id={`etape-${n}`} className="plan-in scroll-mt-48 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition sm:p-8" style={{ animationDelay: `${n * 60}ms` }}>
      <header className="mb-5 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-3 sm:flex">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl font-heading text-lg font-extrabold transition-all duration-300", done ? "bg-gradient-to-br from-teal to-violet text-white" : "bg-navy text-white")}>
          {done ? <Check className="size-5" aria-hidden /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-xl font-bold text-navy">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => onToggle(!done)}
          aria-pressed={done}
          className={cn(
            "col-span-2 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition active:scale-95 disabled:opacity-50 sm:col-span-1 sm:ml-auto sm:shrink-0",
            done ? "bg-teal-50 text-teal-800 ring-1 ring-teal/30" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
          )}
        >
          <Check className="size-4" aria-hidden /> {done ? "Étape faite" : "Marquer comme faite"}
        </button>
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function BriefZone({ state, brief, allowed, children }: { state: "ready" | "loading" | "none"; brief: TenderBrief | null; allowed: boolean; children: (b: TenderBrief) => React.ReactNode }) {
  if (brief) return <>{children(brief)}</>;
  if (state === "loading")
    return (
      <div className="space-y-3" aria-live="polite">
        <p className="text-sm font-semibold text-teal-700">Lecture de l&apos;avis officiel… (quelques secondes)</p>
        {[85, 65, 75].map((w) => (
          <div key={w} className="h-4 animate-pulse rounded-full bg-slate-100" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  return (
    <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
      {allowed ? "Ces informations sont dans l'annonce officielle et le règlement de la consultation." : "Le détail de l'avis (conditions, pièces, notation) est inclus dans l'offre Pro."}
    </p>
  );
}

function Conditions({ brief, mine, id }: { brief: TenderBrief; mine: string[]; id: string }) {
  const certs = (brief.certifications ?? []).map((c) => ({ label: c, status: certStatus(c, mine) }));
  const missing = certs.filter((c) => c.status === "missing").length;
  const check = certs.filter((c) => c.status === "check").length;
  if (!certs.length && !(brief.capacity ?? []).length) return <p className="text-sm text-slate-600">L&apos;avis ne précise pas de conditions particulières. Vérifiez le règlement de la consultation.</p>;
  return (
    <div className="space-y-4">
      {certs.length > 0 && (
        <div className={cn("flex items-center gap-3 rounded-2xl p-4 ring-1", missing ? "bg-rose-50 ring-rose-200" : check ? "bg-slate-50 ring-slate-200" : "bg-teal-50 ring-teal/30")}>
          {missing ? <AlertTriangle className="size-6 shrink-0 text-rose-600" aria-hidden /> : <ShieldCheck className="size-6 shrink-0 text-teal-700" aria-hidden />}
          <p className="font-semibold text-navy">
            {missing
              ? `Il vous manque ${missing} exigence${missing > 1 ? "s" : ""} : vous pouvez répondre avec un partenaire.`
              : check
                ? "À vérifier : certaines certifications diffèrent de votre fiche."
                : "Vos certifications correspondent aux exigences connues."}
          </p>
        </div>
      )}
      {certs.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {certs.map((c, i) => (
            <li key={c.label} className="plan-in flex items-start gap-2.5 rounded-xl bg-white p-3 ring-1 ring-slate-200" style={{ animationDelay: `${i * 70}ms` }}>
              {c.status === "ok" ? (
                <BadgeCheck className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden />
              ) : c.status === "missing" ? (
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-600" aria-hidden />
              ) : (
                <CircleHelp className="mt-0.5 size-5 shrink-0 text-slate-400" aria-hidden />
              )}
              <span>
                <span className="block font-semibold text-navy">{c.label}</span>
                <span className="text-xs text-slate-500">{c.status === "ok" ? "Sur votre fiche" : c.status === "missing" ? "Absente de votre fiche" : "À vérifier"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {(brief.capacity ?? []).length > 0 && (
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="text-sm font-bold text-navy">Autres conditions</p>
          <Bullets items={brief.capacity ?? []} />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {missing > 0 && (
          <Link href={`/publier?partenaire=${id}`} className="btn-shine inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5">
            <Users className="size-4" aria-hidden /> Trouver un partenaire
          </Link>
        )}
        <Link href="/dashboard/entreprise" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-navy ring-1 ring-slate-300 transition hover:-translate-y-0.5 hover:ring-teal">
          {mine.length ? "Mettre à jour mes certifications" : "Ajouter mes certifications"}
        </Link>
      </div>
    </div>
  );
}

function DraftEditor({ id, initial, make }: { id: string; initial: string | null; make: () => string }) {
  const [text, setText] = useState(initial ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(initial ? "saved" : "idle");
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placeholders = useMemo(() => (text.match(/\[À compléter/g) ?? []).length, [text]);
  const save = (value: string) => {
    setText(value);
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveDraft(id, value)
        .then((r) => setStatus(r.ok ? "saved" : "error"))
        .catch(() => setStatus("error"));
    }, 1000);
  };
  const download = () => {
    const html = `<html><head><meta charset="utf-8"></head><body>${text
      .split("\n")
      .map((l) => `<p>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;") || "&nbsp;"}</p>`)
      .join("")}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "application/msword" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "memoire-technique.doc";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-navy to-navy-900 px-5 py-4 text-white">
        <p className="flex items-center gap-2 font-bold">
          <PenLine className="size-4 text-teal" aria-hidden /> Mon mémoire technique
        </p>
        <span className="text-xs text-white/70" aria-live="polite">
          {status === "saving" ? "Enregistrement…" : status === "saved" ? "Enregistré" : status === "error" ? "Non enregistré, réessayez" : ""}
        </span>
      </div>
      {text ? (
        <>
          <textarea
            value={text}
            onChange={(e) => save(e.target.value)}
            spellCheck
            aria-label="Mémoire technique"
            className="block min-h-[28rem] w-full resize-y border-0 bg-white p-5 text-[15px] leading-relaxed whitespace-pre-wrap text-slate-800 focus:ring-2 focus:ring-teal focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
            <button type="button" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-navy ring-1 ring-slate-300 transition hover:ring-teal">
              <Copy className="size-4" aria-hidden /> {copied ? "Copié !" : "Copier"}
            </button>
            <button type="button" onClick={download} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-navy ring-1 ring-slate-300 transition hover:ring-teal">
              <Download className="size-4" aria-hidden /> Télécharger (Word)
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Remplacer votre texte par une nouvelle trame ?")) save(make());
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-white"
            >
              Repartir de la trame
            </button>
            {placeholders > 0 && <span className="ml-auto text-xs font-semibold text-violet">{placeholders} passage{placeholders > 1 ? "s" : ""} à compléter</span>}
          </div>
        </>
      ) : (
        <div className="bg-white p-6 text-center sm:p-8">
          <FileText className="mx-auto size-10 text-teal-700" aria-hidden />
          <p className="mt-3 font-heading text-lg font-bold text-navy">Une trame de mémoire technique prête à compléter</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">Organisée selon les critères de notation de l&apos;acheteur et pré-remplie avec votre fiche entreprise. Il ne vous reste qu&apos;à compléter les passages indiqués.</p>
          <button type="button" onClick={() => save(make())} className="btn-shine mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal to-electric px-5 py-3 font-semibold text-navy shadow-lg shadow-teal/25 transition hover:-translate-y-0.5 active:scale-[0.98]">
            <Sparkles className="size-4" aria-hidden /> Préparer ma trame
          </button>
        </div>
      )}
    </div>
  );
}

function Result({ stage, pending, onWon, onLost, submittedAt, rejection }: { stage: string; pending: boolean; onWon: () => void; onLost: () => void; submittedAt: string | null; rejection: string }) {
  if (stage === "WON")
    return (
      <div className="plan-in rounded-2xl bg-gradient-to-br from-teal-50 to-white p-6 text-center ring-1 ring-teal/30">
        <Trophy className="mx-auto size-10 text-teal-700" aria-hidden />
        <p className="mt-2 font-heading text-xl font-bold text-navy">Bravo pour ce marché !</p>
        <p className="mt-1 text-sm text-slate-600">Ajoutez-le à vos références sur votre fiche entreprise : il comptera pour les prochains.</p>
      </div>
    );
  if (stage === "LOST")
    return (
      <div className="space-y-4">
        <InfoCard icon={Lightbulb} title="Pour progresser" tone="teal">
          <Bullets items={LOST_ADVICE} />
        </InfoCard>
        <TemplateCard icon={MessageSquareText} title="Modèle de demande des motifs du rejet" text={rejection} />
      </div>
    );
  return (
    <div className="plan-in rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200">
      <p className="font-bold text-navy">Réponse envoyée{submittedAt ? ` le ${new Date(submittedAt).toLocaleDateString("fr-FR")}` : ""} 🎉</p>
      <p className="mt-1 text-sm text-slate-600">Vous avez eu le résultat ?</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={onWon} className="inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-3 font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50">
          <Trophy className="size-4" aria-hidden /> Gagné
        </button>
        <button type="button" disabled={pending} onClick={onLost} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-slate-700 ring-1 ring-slate-300 transition hover:-translate-y-0.5 disabled:opacity-50">
          <ThumbsDown className="size-4" aria-hidden /> Pas retenu
        </button>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, tone, children }: { icon: typeof Lightbulb; title: string; tone: "teal" | "rose"; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl p-5 text-slate-700 ring-1", tone === "rose" ? "bg-rose-50 ring-rose-200" : "bg-gradient-to-br from-teal-50 to-white ring-teal/30")}>
      <p className={cn("mb-2 flex items-center gap-2 font-bold", tone === "rose" ? "text-rose-800" : "text-navy")}>
        <Icon className={cn("size-4", tone === "rose" ? "text-rose-600" : "text-teal-700")} aria-hidden /> {title}
      </p>
      {children}
    </div>
  );
}

function HowTo({ items, open = false }: { items: string[]; open?: boolean }) {
  const [show, setShow] = useState(open);
  return (
    <div className="rounded-2xl bg-slate-50/70 ring-1 ring-slate-200">
      <button type="button" onClick={() => setShow(!show)} aria-expanded={show} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left text-sm font-semibold text-teal-800">
        <span className="flex items-center gap-2">
          <CircleHelp className="size-4" aria-hidden /> Comment faire ?
        </span>
        <ChevronDown className={cn("size-4 transition duration-300", show && "rotate-180")} aria-hidden />
      </button>
      {show && (
        <div className="animate-rise px-5 pb-4">
          <Bullets items={items} />
        </div>
      )}
    </div>
  );
}

const Bullets = ({ items }: { items: string[] }) => (
  <ul className="mt-1 space-y-2">
    {items.map((t) => (
      <li key={t} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal" aria-hidden /> {t}
      </li>
    ))}
  </ul>
);

/** Modèle de texte prêt à copier (question à l'acheteur, demande des motifs du rejet). */
function TemplateCard({ icon: Icon, title, text }: { icon: typeof Lightbulb; title: string; text: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 bg-white px-5 py-3.5 text-left text-sm font-semibold text-navy transition hover:bg-slate-50">
        <span className="flex items-center gap-2">
          <Icon className="size-4 text-teal-700" aria-hidden /> {title}
        </span>
        <ChevronDown className={cn("size-4 transition duration-300", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="animate-rise border-t border-slate-100 bg-slate-50 p-5">
          <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-slate-700">{text}</pre>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard
                ?.writeText(text)
                .then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                })
                .catch(() => {});
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-navy ring-1 ring-slate-300 transition hover:ring-teal"
          >
            <Copy className="size-4" aria-hidden /> {copied ? "Copié !" : "Copier le texte"}
          </button>
        </div>
      )}
    </div>
  );
}

const KIND_STYLE: Record<string, string> = {
  NOTE: "bg-slate-100 text-slate-600",
  START: "bg-violet/10 text-violet",
  STEP: "bg-teal-50 text-teal-800",
  SENT: "bg-navy text-white",
  WON: "bg-teal text-navy",
  LOST: "bg-slate-200 text-slate-700",
};
const KIND_LABEL: Record<string, string> = { NOTE: "Note", START: "Début", STEP: "Étape", SENT: "Dépôt", WON: "Gagné", LOST: "Résultat" };

/** Journal de suivi jour par jour : notes de l'équipe et étapes franchies. */
function Journal({ id, initial }: { id: string; initial: JournalEntry[] }) {
  const [entries, setEntries] = useState(initial);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const add = () =>
    start(async () => {
      setError(null);
      const r = await addJournalNote(id, text);
      if (r.ok) {
        setEntries([r.entry, ...entries]);
        setText("");
      } else setError(r.error);
    });
  const groups = entries.reduce<Record<string, JournalEntry[]>>((acc, e) => {
    const day = new Date(e.created_at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    (acc[day] ??= []).push(e);
    return acc;
  }, {});
  return (
    <section id="journal" className="plan-in scroll-mt-48 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
      <header className="mb-5 flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal to-violet text-white">
          <BookOpen className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-heading text-xl font-bold text-navy">Journal de suivi</h2>
          <p className="mt-0.5 text-sm text-slate-500">Jour après jour : ce qui a été fait, les échanges avec l&apos;acheteur, les points à ne pas oublier. Visible par votre équipe.</p>
        </div>
      </header>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) add();
          }}
          maxLength={2000}
          placeholder="Ex. : visite faite avec M. Dupont, question posée sur les quantités…"
          aria-label="Nouvelle note"
          className="h-12 flex-1 rounded-xl border border-slate-300 px-4 text-sm focus:border-teal focus:ring-2 focus:ring-teal/30 focus:outline-none"
        />
        <button type="button" disabled={pending || !text.trim()} onClick={add} className="btn-shine h-12 rounded-xl bg-navy px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50">
          Ajouter au journal
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
      {entries.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-500">Votre journal se remplit au fil des étapes. Ajoutez vos notes pour garder une trace de chaque échange.</p>
      ) : (
        <div className="mt-6 space-y-5">
          {Object.entries(groups).map(([day, list]) => (
            <div key={day}>
              <p className="mb-2 text-xs font-bold tracking-wide text-slate-500 uppercase">{day}</p>
              <ol className="space-y-2 border-l-2 border-slate-100 pl-4">
                {list.map((e) => (
                  <li key={e.id} className="animate-rise relative flex items-start gap-3">
                    <span aria-hidden className="absolute top-2 -left-[1.4rem] size-2.5 rounded-full bg-teal ring-4 ring-white" />
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", KIND_STYLE[e.kind] ?? KIND_STYLE.NOTE)}>{KIND_LABEL[e.kind] ?? "Note"}</span>
                    <p className="min-w-0 flex-1 text-sm text-slate-700">
                      {e.body}
                      <span className="ml-2 text-xs text-slate-400">
                        {new Date(e.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        {e.author ? ` · ${e.author}` : ""}
                      </span>
                    </p>
                    {e.mine && e.kind === "NOTE" && (
                      <button
                        type="button"
                        aria-label="Supprimer la note"
                        onClick={() =>
                          start(async () => {
                            const r = await deleteJournalNote(e.id);
                            if (r.ok) setEntries(entries.filter((x) => x.id !== e.id));
                          })
                        }
                        className="rounded-lg p-1 text-slate-300 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Questions proposées : adaptées à ce que l'avis exige (certification manquante, visite, notation). */
function assistantSuggestions(brief: TenderBrief | null, mine: string[]): string[] {
  const out: string[] = [];
  const missing = (brief?.certifications ?? []).find((c) => certStatus(c, mine) !== "ok");
  if (missing) out.push(`Puis-je candidater sans « ${missing.length > 60 ? `${missing.slice(0, 57)}…` : missing} » ?`);
  out.push("Quelles pièces dois-je fournir exactement ?");
  if (brief?.criteria?.length) out.push("Comment mon offre sera-t-elle notée ?");
  else out.push("Comment se passe la sélection des offres ?");
  if (brief?.site_visit) out.push("La visite est-elle obligatoire ? Comment m'inscrire ?");
  out.push("Puis-je répondre à plusieurs (groupement ou sous-traitance) ?");
  out.push("Que mettre dans mon mémoire technique ?");
  return out.slice(0, 5);
}
