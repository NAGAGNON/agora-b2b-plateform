"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
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
  ThumbsDown,
  Trophy,
  UserPlus,
  Users,
  NotebookPen,
  BookOpen,
  CalendarPlus,
  MessageSquareText,
  Trash2,
  Route,
  ThumbsUp,
  XCircle,
  Bookmark,
  BellRing,
  FolderOpen,
  Scale,
  Landmark,
  ListChecks,
  Layers,
} from "lucide-react";
import { offersLabel } from "@/lib/award-format";
import { cn } from "@/lib/cn";
import type { TenderBrief } from "@/lib/tender-brief";
import { certStatus } from "@/lib/certification-match";
import { APPLICATION_GUIDE, LOST_ADVICE, followUpTemplate, questionTemplate, rejectionTemplate } from "@/lib/application-guide";
import { applicationPlan } from "@/lib/application-plan";
import { buildMemoirDraft, type DraftCompany } from "@/lib/memoir-draft";
import { addFollower, addJournalNote, answerApplicationResult, deleteJournalNote, removeFollower, keepForLater, markApplicationSent, saveDraft, setApplicationReminder, startApplicationGuide, toggleDocStep, toggleGuideStep, withdrawApplication, type JournalEntry, type TeamMember } from "@/app/actions/applications";
import { loadTenderBrief, toggleBriefStep } from "@/app/actions/tender-brief";
import { goBackToSearch } from "@/components/applications/return-point";
import { ApplicationAssistant } from "@/components/applications/application-assistant";
import { StepsProgress } from "@/components/applications/steps-progress";
import { ChecksList, ResultTracker, SubmissionForm } from "@/components/applications/journey-steps";
import { CAPACITIES, type Journey } from "@/lib/journey";
import type { AssistantMessage } from "@/app/actions/application-assistant";

export type WorkspaceData = {
  id: string;
  title: string;
  buyer: string | null;
  /** Appel d'offres externe (BOAMP, TED…) plutôt que besoin publié sur LinkProB2B */
  external: boolean;
  place: string | null;
  deadline: string | null;
  stage: string;
  submittedAt: string | null;
  /** Avis de résultat officiel détecté automatiquement (BOAMP) */
  award: { idweb: string; titulaires: string[]; date: string | null; url: string; cancelled: boolean; won?: boolean; offers?: number[] } | null;
  /** Le résultat est surveillé automatiquement (offre publiée au BOAMP) */
  awardWatched: boolean;
  /** Rappel choisi après le dépôt (« prochaine action » du suivi) */
  reminder: { date: string; text: string } | null;
  guideDone: number[];
  /** Réponses du parcours en 7 étapes (éligibilité, capacités, dépôt, résultat) */
  journey: Journey;
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
  /** Membres de l'entreprise (pour en ajouter au suivi du dossier) */
  team: TeamMember[];
  /** Membres qui suivent ce dossier */
  followers: string[];
  questions: AssistantMessage[];
  /** Lignes cochées du « à faire » de l'annonce (fiche synthèse) */
  briefDone: number[];
  /** Où découvrir l'offre Pro (fiche réservée) */
  upgradeHref: string;
};

const nowMs = () => Date.now();
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** Espace de travail d'une candidature : tout ce qu'il faut pour répondre, étape par étape. */
export function CandidatureWorkspace({ data }: { data: WorkspaceData }) {
  const [brief, setBrief] = useState<TenderBrief | null>(data.brief);
  const [briefState, setBriefState] = useState<"ready" | "loading" | "none">(data.brief ? "ready" : data.canLoadBrief ? "loading" : "none");
  const [done, setDone] = useState<number[]>(data.guideDone);
  const [docs, setDocs] = useState<number[]>(data.docsDone);
  const [stage, setStage] = useState(data.stage);
  // Journal partagé entre les notes de chaque étape et le journal de suivi complet
  const [journal, setJournal] = useState<JournalEntry[]>(data.journal);
  const notesFor = (step: number) => (
    <StepNotes
      id={data.id}
      step={step}
      entries={journal.filter((e) => e.step === step && e.kind === "NOTE")}
      onAdd={(e) => setJournal((j) => [e, ...j])}
      onRemove={(rid) => setJournal((j) => j.filter((x) => x.id !== rid))}
    />
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Une seule étape ouverte à la fois : la prochaine à faire (aucune une fois la réponse envoyée)
  const [openStep, setOpenStep] = useState<number>(() =>
    ["RESPONSE_SENT", "DISCUSSION", "NEGOTIATION", "WON", "LOST"].includes(data.stage) ? -1 : APPLICATION_GUIDE.findIndex((_, i) => !data.guideDone.includes(i)),
  );

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
  // « Oui, je prépare » : la personne est emmenée à l'étape 1, ouverte, pour savoir tout de suite quoi faire
  const prepare = () =>
    start(async () => {
      setError(null);
      const r = await startApplicationGuide(data.id);
      if (!r.ok) return setError(r.error ?? "Réessayez.");
      setStage("RESPONSE_PREPARING");
      setOpenStep(0);
      setTimeout(() => document.getElementById("etape-1")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    });
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
  // Fenêtre rendue à la racine de la page : au-dessus de l'en-tête et du bouton de l'assistant
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  // Départ mémorisé aussi dans l'onglet (sessionStorage) : sur téléphone, le navigateur recharge souvent la
  // page au retour (ou l'annonce s'ouvre dans le même onglet puis « retour ») et la mémoire de la page est perdue
  const leftKey = `lp-left-source-${data.id}`;
  const goToSource = () => {
    leftForSource.current = Date.now();
    try {
      sessionStorage.setItem(leftKey, String(leftForSource.current));
    } catch {
      // stockage indisponible : la mémoire de la page suffit sur ordinateur
    }
  };
  useEffect(() => {
    const onBack = () => {
      if (document.visibilityState !== "visible") return;
      let left = leftForSource.current;
      try {
        left ??= Number(sessionStorage.getItem(leftKey)) || null;
        sessionStorage.removeItem(leftKey);
      } catch {
        // stockage indisponible
      }
      leftForSource.current = null;
      if (left === null) return;
      const away = Date.now() - left;
      // Retour entre 3 secondes et 2 heures après le départ vers l'annonce
      if (away >= 3000 && away < 2 * 3_600_000 && ["DETECTED", "QUALIFIED", "INTERESTED"].includes(stage)) setReturnAsk("ask");
    };
    // Page rechargée au retour : vérification dès l'affichage
    onBack();
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("focus", onBack);
    window.addEventListener("pageshow", onBack);
    return () => {
      document.removeEventListener("visibilitychange", onBack);
      window.removeEventListener("focus", onBack);
      window.removeEventListener("pageshow", onBack);
    };
  }, [stage, leftKey]);
  // Réponse à la fenêtre de retour : même parcours que les boutons de décision de la page
  const answerReturn = (choice: "prepare" | "later" | "applied" | "no") => {
    setReturnAsk(null);
    if (choice === "prepare") prepare();
    else if (choice === "later") {
      if (!later) keep();
    } else if (choice === "applied") act(() => markApplicationSent(data.id), "RESPONSE_SENT");
    else withdraw(false);
  };
  const withdraw = (confirm: boolean) => {
    if (confirm && !window.confirm("Retirer cette offre de vos candidatures et retourner à vos recherches ?")) return;
    start(async () => {
      const r = await withdrawApplication(data.id);
      if (r.ok) goBackToSearch();
      else setError(r.error);
    });
  };
  const days = data.deadline ? Math.ceil((new Date(data.deadline).getTime() - nowMs()) / 86_400_000) : null;
  const plan = useMemo(() => (sent ? [] : applicationPlan(data.deadline, done, new Date(nowMs()), data.startedAt)), [sent, data.deadline, done, data.startedAt]);
  const tpl = { title: data.title, buyer: data.buyer, reference: data.reference, company: data.company.name };

  const toggleStep = (i: number, value: boolean) => {
    const before = done;
    const nextDone = value ? [...new Set([...done, i])].sort((a, b) => a - b) : done.filter((x) => x !== i);
    setDone(nextDone);
    // Étape faite : la suivante s'ouvre aussitôt ; étape rouverte : elle reste ouverte
    if (value) {
      const next = APPLICATION_GUIDE.findIndex((_, k) => !nextDone.includes(k));
      setOpenStep(next);
      if (next >= 0) setTimeout(() => document.getElementById(`etape-${next + 1}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
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
  const scrollTo = (i: number) => {
    setOpenStep(i);
    setTimeout(() => document.getElementById(`etape-${i + 1}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  // Retour depuis l'assistant : l'étape ouverte, sinon la prochaine à faire, sinon le haut de la candidature
  const backStep = discovery || sent ? -1 : openStep >= 0 ? openStep : APPLICATION_GUIDE.findIndex((_, i) => !done.includes(i));
  const backTo =
    backStep >= 0
      ? { label: `Étape ${backStep + 1} : ${APPLICATION_GUIDE[backStep]?.title ?? "Suivre le résultat"}`, onBack: () => scrollTo(backStep) }
      : { label: "En haut de votre candidature", onBack: () => window.scrollTo({ top: 0, behavior: "smooth" }) };

  const visitHot = Boolean(brief?.site_visit && /obligatoire/i.test(brief.site_visit));
  const facts = [
    data.deadline && {
      icon: CalendarClock,
      label: "Date limite",
      value: `${fmtDay(data.deadline)}${days === null ? "" : days < 0 ? " · dépassée" : days === 0 ? " · aujourd'hui" : ` · dans ${days} jour${days > 1 ? "s" : ""}`}`,
      hot: days !== null && days <= 5,
    },
    brief?.site_visit && { icon: MapPinned, label: "Visite", value: visitHot ? "Obligatoire" : "Prévue", hot: visitHot },
    brief?.duration && { icon: Hourglass, label: "Durée", value: brief.duration, hot: false },
  ].filter(Boolean) as { icon: typeof CalendarClock; label: string; value: string; hot: boolean }[];
  const statusLabel = sent ? "Réponse envoyée" : discovery ? (later ? "Gardée pour plus tard" : "À l'étude") : "En préparation";
  // En bref : l'essentiel de l'annonce, le détail sur demande (avant la décision ; après les étapes une fois la préparation lancée)
  const essentials =
    brief || briefState === "loading" ? (
            <section className="plan-in rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8" data-testid="essentials">
              <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-teal-700 uppercase">
                <BookOpen className="size-4" aria-hidden /> En bref
              </p>
              {brief ? (
                <>
                  <p className="mt-3 text-lg leading-relaxed text-navy">{brief.summary}</p>
                  {brief.buyer && (
                    <p className="mt-3 flex items-start gap-2 text-sm text-slate-600">
                      <Landmark className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden />
                      <span>
                        <strong className="font-semibold text-navy">Qui achète : </strong>
                        {brief.buyer}
                      </span>
                    </p>
                  )}
                  {(brief.details ?? []).length > 0 && (
                    <div className="mt-5 rounded-2xl bg-gradient-to-br from-sky/60 to-white p-4 ring-1 ring-teal/20" data-testid="brief-details">
                      <p className="flex items-center gap-2 text-sm font-bold text-navy">
                        <ListChecks className="size-4 text-teal-700" aria-hidden /> Le besoin en détail
                      </p>
                      <Bullets items={brief.details ?? []} />
                    </div>
                  )}
                  {brief.lots.length > 0 && (
                    <div className="mt-3 rounded-2xl bg-slate-50/70 p-4 ring-1 ring-slate-200">
                      <p className="flex items-center gap-2 text-sm font-bold text-navy">
                        <Layers className="size-4 text-teal-700" aria-hidden /> {brief.lots.length} lot{brief.lots.length > 1 ? "s" : ""} (vous pouvez répondre à un seul)
                      </p>
                      <Bullets items={brief.lots} />
                    </div>
                  )}
                  {(brief.key_dates ?? []).length > 0 && (
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Dates utiles">
                      {(brief.key_dates ?? []).map((d) => (
                        <li key={d.label + d.date} className="flex items-start gap-2.5 rounded-xl bg-white p-3 text-sm ring-1 ring-slate-200">
                          <CalendarClock className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden />
                          <span>
                            <span className="block text-xs font-semibold text-slate-500">{d.label}</span>
                            <span className="font-semibold text-navy">{d.date}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-5 grid gap-2">
                    <EssentialRow icon={conditionsTone(brief, data.mine) === "missing" ? AlertTriangle : ShieldCheck} tone={conditionsTone(brief, data.mine)} title="Puis-je répondre ?" text={conditionsLine(brief, data.mine)}>
                      <Conditions brief={brief} mine={data.mine} id={data.id} />
                    </EssentialRow>
                    <EssentialRow icon={FileText} title="Pièces à fournir" text={brief.documents.length ? `${brief.documents.length} pièce${brief.documents.length > 1 ? "s" : ""} à préparer` : "La liste est dans le règlement de la consultation (sur le site de l'acheteur)"}>
                      {brief.documents.length > 0 ? <Bullets items={brief.documents} /> : null}
                    </EssentialRow>
                    <EssentialRow icon={Scale} title="Comment l'offre est notée" text={notationLine(brief)}>
                      {(brief.criteria ?? []).length > 0 || (brief.tips ?? []).length > 0 ? <Notation brief={brief} /> : null}
                    </EssentialRow>
                    {(brief.submission || brief.submission_url) && (
                      <EssentialRow icon={Send} title="Où déposer" text={brief.submission ?? "Sur le site de dépôt de l'acheteur"}>
                        {brief.submission_url ? (
                          <a href={brief.submission_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-teal-800 ring-1 ring-teal/40 transition hover:-translate-y-0.5">
                            <ExternalLink className="size-4" aria-hidden /> Ouvrir le site de dépôt
                          </a>
                        ) : null}
                      </EssentialRow>
                    )}
                  </div>
                  {(brief.official ?? []).length > 0 && (
                    <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200" data-testid="brief-official">
                      <p className="flex items-center gap-2 text-sm font-bold text-navy">
                        <ExternalLink className="size-4 text-teal-700" aria-hidden /> Ce que vous trouverez dans l&apos;annonce officielle
                      </p>
                      <Bullets items={brief.official ?? []} />
                    </div>
                  )}
                  {brief.warnings.length > 0 && (
                    <div className="mt-4 rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200">
                      <p className="flex items-center gap-2 text-sm font-bold text-rose-800">
                        <AlertTriangle className="size-4" aria-hidden /> À ne pas manquer
                      </p>
                      <Bullets items={brief.warnings.slice(0, 3)} />
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-3 space-y-2" aria-live="polite">
                  <p className="text-sm font-semibold text-teal-700">Lecture de l&apos;annonce officielle… Nous préparons une fiche détaillée (20 à 30 secondes).</p>
                  {[90, 70, 80].map((w) => (
                    <div key={w} className="h-4 animate-pulse rounded-full bg-slate-100" style={{ width: `${w}%` }} />
                  ))}
                </div>
              )}
              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-sm">
                {data.deadline && (
                  <a href={`/api/opportunites/${data.id}/agenda`} download className="inline-flex items-center gap-1.5 font-semibold text-slate-500 transition hover:text-teal-700">
                    <CalendarPlus className="size-4" aria-hidden /> Date limite dans mon agenda
                  </a>
                )}
                {brief && (
                  <>
                    <a href={`/api/opportunites/${data.id}/fiche?format=pdf`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-semibold text-slate-500 transition hover:text-teal-700">
                      <Download className="size-4" aria-hidden /> Fiche PDF
                    </a>
                    <a href={`/api/opportunites/${data.id}/fiche?format=doc`} className="inline-flex items-center gap-1.5 font-semibold text-slate-500 transition hover:text-teal-700">
                      <Download className="size-4" aria-hidden /> Fiche Word
                    </a>
                  </>
                )}
                <Link href={`/publier?partenaire=${data.id}`} className="inline-flex items-center gap-1.5 font-semibold text-slate-500 transition hover:text-teal-700">
                  <Users className="size-4" aria-hidden /> Trouver un partenaire
                </Link>
              </div>
            </section>
          ) : (
            <section className="plan-in rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
              <BriefZone state={briefState} brief={brief} allowed={data.briefAllowed} upgradeHref={data.upgradeHref}>
                {() => null}
              </BriefZone>
            </section>
          );

  return (
    <div className="space-y-6 pb-16 sm:space-y-8">
      {returnAsk && mounted && createPortal(
        // Fenêtre bloquante : pas de fermeture en cliquant à côté, il faut répondre
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-navy/50 p-3 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="return-title" data-testid="return-ask">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg animate-rise overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-200 sm:p-7">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal to-violet text-white shadow-lg shadow-teal/20">
                <BellRing className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p id="return-title" className="font-heading text-lg font-bold text-navy sm:text-xl">
                  Vous avez vu l&apos;annonce officielle. Alors, cette offre vous intéresse ?
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{data.title}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-2">
              <button type="button" disabled={pending} onClick={() => answerReturn("prepare")} className="btn-shine flex items-center gap-3 rounded-2xl bg-gradient-to-r from-teal to-electric px-4 py-3.5 text-left font-semibold text-navy shadow-lg shadow-teal/20 transition hover:-translate-y-0.5" data-testid="return-prepare">
                <ThumbsUp className="size-5 shrink-0" aria-hidden />
                <span>
                  Oui, je prépare ma réponse
                  <span className="block text-xs font-normal text-navy/70">Le guide étape par étape s&apos;ouvre ici</span>
                </span>
              </button>
              <button type="button" disabled={pending} onClick={() => answerReturn("later")} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left font-semibold text-navy ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-teal" data-testid="return-later">
                <Bookmark className="size-5 shrink-0 text-teal-700" aria-hidden />
                <span>
                  Oui, mais plus tard : suivez-la pour moi
                  <span className="block text-xs font-normal text-slate-500">
                    Gardée dans « Mes candidatures »{days !== null && days > 0 ? ", rappel par e-mail 7 jours puis 2 jours avant la date limite" : ""}
                  </span>
                </span>
              </button>
              <button type="button" disabled={pending} onClick={() => answerReturn("applied")} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left font-semibold text-navy ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-teal" data-testid="return-applied">
                <Send className="size-5 shrink-0 text-violet-600" aria-hidden />
                <span>
                  J&apos;ai déjà postulé
                  <span className="block text-xs font-normal text-slate-500">On suit le résultat avec vous</span>
                </span>
              </button>
              <button type="button" disabled={pending} onClick={() => answerReturn("no")} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-rose-700" data-testid="return-no">
                <XCircle className="size-5 shrink-0" aria-hidden />
                <span>
                  Non, ça ne m&apos;intéresse pas
                  <span className="block text-xs font-normal">Retour à mes recherches</span>
                </span>
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {/* En-tête : l'annonce officielle en premier, puis l'offre en une ligne */}
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
        <p className="inline-flex animate-rise items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-bold tracking-wide text-teal-700 uppercase shadow-sm ring-1 ring-teal/20">
          <Sparkles className="size-3.5" aria-hidden /> Ma candidature · {statusLabel}
        </p>
        {!discovery && (
          <p className="ml-2 inline-flex animate-rise items-center gap-1 text-xs font-semibold text-teal-800" data-testid="autosaved">
            <Check className="size-3.5" aria-hidden /> Enregistrée automatiquement · vous reprenez là où vous en êtes
          </p>
        )}
        <h1 className="mt-4 animate-rise font-heading text-xl leading-tight font-extrabold text-balance text-navy [animation-delay:80ms] sm:text-4xl">{data.title}</h1>
        <p className="mt-2 animate-rise text-slate-600 [animation-delay:140ms]">
          {data.buyer ?? (data.external ? "Acheteur indiqué dans l'annonce officielle" : "Besoin publié sur LinkProB2B")}
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
        <div className="-mx-2 mt-5 flex flex-wrap items-center gap-x-1 text-sm sm:mt-8">
          <button type="button" onClick={() => goBackToSearch()} className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 font-semibold text-navy transition hover:bg-white/80" data-testid="continue-search">
            <ArrowLeft className="size-4" aria-hidden /> Continuer mes recherches
          </button>
          <Link href="/dashboard/candidatures" className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 font-semibold text-slate-500 transition hover:bg-white/80 hover:text-navy">
            <FolderOpen className="size-4" aria-hidden /> Toutes mes candidatures
          </Link>
          {!discovery && !sent && (
            <button type="button" disabled={pending} onClick={() => withdraw(true)} className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 font-semibold text-slate-400 transition hover:bg-white/80 hover:text-rose-700">
              <XCircle className="size-4" aria-hidden /> Ne m&apos;intéresse plus
            </button>
          )}
        </div>
      </section>

      <div className="grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {/* À l'étude : l'essentiel de l'annonce d'abord, puis la décision (sans engagement) */}
          {discovery && essentials}

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
                  {later ? "Elle est enregistrée dans vos candidatures. Quand vous êtes prêt, on vous guide étape par étape." : essentials ? "Vous avez l'essentiel de l'annonce juste au-dessus. Vous pouvez changer d'avis à tout moment." : "Vous pouvez changer d'avis à tout moment."}
                </p>
              </div>
              <div className="relative mt-5 grid gap-2.5 sm:mt-6 sm:grid-cols-3 sm:gap-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={prepare}
                  className="btn-shine group flex items-center gap-3 rounded-2xl bg-gradient-to-br from-teal to-electric p-4 text-left text-navy shadow-lg shadow-teal/25 transition hover:-translate-y-1 hover:shadow-xl active:scale-[0.98] disabled:opacity-50 sm:flex-col sm:gap-2 sm:p-5 sm:text-center"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/30 ring-1 ring-white/50 transition group-hover:scale-110">
                    <ThumbsUp className="size-5" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5 sm:items-center">
                    <span className="font-heading text-base font-bold">Oui, je prépare ma candidature</span>
                    <span className="text-xs text-navy/75">On vous guide jusqu&apos;au dépôt</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={keep}
                  role="checkbox"
                  aria-checked={later}
                  data-testid="keep-later"
                  className={cn(
                    "group flex items-center gap-3 rounded-2xl p-4 text-left transition hover:-translate-y-1 hover:shadow-lg active:scale-[0.98] sm:flex-col sm:gap-2 sm:p-5 sm:text-center",
                    later ? "bg-teal-50 text-teal-900 shadow-md ring-2 ring-teal" : "bg-white text-navy shadow-sm ring-1 ring-slate-200 hover:ring-teal",
                  )}
                >
                  <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full transition group-hover:scale-110", later ? "bg-teal text-white" : "bg-sky text-teal-700 ring-1 ring-teal/30")}>
                    {later ? <Check className="size-5" aria-hidden /> : <Bookmark className="size-5" aria-hidden />}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5 sm:items-center">
                    <span className="font-heading text-base font-bold">{later ? "Gardée pour plus tard" : "Oui, je la garde pour plus tard"}</span>
                    <span className="text-xs text-slate-500">{later ? "Cliquez pour décocher" : "Enregistrée dans Mes candidatures"}</span>
                  </span>
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => withdraw(later)}
                  className="group flex items-center gap-3 rounded-2xl bg-white p-4 text-left text-navy shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg hover:ring-rose-300 active:scale-[0.98] disabled:opacity-50 sm:flex-col sm:gap-2 sm:p-5 sm:text-center"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition group-hover:scale-110 group-hover:bg-rose-50 group-hover:text-rose-600">
                    <XCircle className="size-5" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5 sm:items-center">
                    <span className="font-heading text-base font-bold">{later ? "Ne m'intéresse plus" : "Non, pas pour moi"}</span>
                    <span className="text-xs text-slate-500">Retour à vos recherches, au même endroit</span>
                  </span>
                </button>
              </div>
            </section>
          )}

          {/* Réponse envoyée : le résultat d'abord */}
          {sent && (
            <section className="plan-in rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8" data-testid="result">
              {stage === "RESPONSE_SENT" && <AwardBanner award={data.award} watched={data.awardWatched} />}
              <Result stage={stage} pending={pending} onWon={() => act(() => answerApplicationResult(data.id, "WON"), "WON")} onLost={() => act(() => answerApplicationResult(data.id, "LOST"), "LOST")} submittedAt={data.submittedAt} rejection={rejectionTemplate(tpl)} />
              {stage === "RESPONSE_SENT" && <AfterDeposit id={data.id} reminder={data.reminder} followUp={followUpTemplate(tpl)} />}
            </section>
          )}

          {/* Préparation : où en est la candidature, puis une étape à la fois */}
          {!discovery && (
            <>
              <div className="plan-in">
                <StepsProgress done={done} sent={sent} />
              </div>
              <div className="space-y-3" data-testid="steps">
                <Step n={1} notes={notesFor(0)} title="Vérifier votre éligibilité" subtitle="Les conditions de l'acheteur, une par une." done={done.includes(0)} open={openStep === 0} onOpen={() => setOpenStep(openStep === 0 ? -1 : 0)} onToggle={(v) => toggleStep(0, v)} pending={pending}>
                  <BriefZone state={briefState} brief={brief} allowed={data.briefAllowed} upgradeHref={data.upgradeHref}>
                    {(b) => <Conditions brief={b} mine={data.mine} id={data.id} />}
                  </BriefZone>
                  {brief && (
                    <div>
                      <p className="mb-2 text-sm font-bold text-navy">Pour chaque condition : où en êtes-vous ?</p>
                      <ChecksList
                        opportunityId={data.id}
                        section="eligibility"
                        items={[...(brief.certifications ?? []), ...(brief.capacity ?? [])].map((x) => ({ key: x, label: x }))}
                        initial={data.journey.eligibility}
                        empty="L'annonce ne liste pas de condition particulière. Vérifiez le règlement de la consultation (sur le site de l'acheteur)."
                      />
                    </div>
                  )}
                  <HowTo items={APPLICATION_GUIDE[0].how} />
                </Step>

                <Step n={2} notes={notesFor(1)} title="Comprendre le besoin de l'acheteur" subtitle="Ce qu'il veut, le dossier, les questions et la visite." done={done.includes(1)} open={openStep === 1} onOpen={() => setOpenStep(openStep === 1 ? -1 : 1)} onToggle={(v) => toggleStep(1, v)} pending={pending}>
                  {brief && (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <p className="rounded-xl bg-sky px-3 py-2.5 text-sm text-navy ring-1 ring-slate-200 sm:col-span-3">
                        <span className="block text-xs font-bold tracking-wide text-teal-700 uppercase">Ce que veut l&apos;acheteur</span>
                        {brief.summary}
                      </p>
                      {brief.duration && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200"><span className="block text-xs font-semibold text-slate-500">Durée</span>{brief.duration}</p>}
                      {brief.pricing && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200 sm:col-span-2"><span className="block text-xs font-semibold text-slate-500">Prix</span>{brief.pricing}</p>}
                    </div>
                  )}
                  <InfoCard icon={FolderDown} title="Où aller" tone="teal">
                    <p>{brief?.submission ?? "Sur le site de l'acheteur, indiqué dans l'annonce officielle."}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {data.hasSource && (
                        <a href={`/go/${data.id}`} target="_blank" rel="noopener noreferrer nofollow" onClick={goToSource} className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5">
                          <ExternalLink className="size-4" aria-hidden /> Voir l&apos;annonce officielle
                        </a>
                      )}
                      {brief?.submission_url && (
                        <a href={brief.submission_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-teal-800 ring-1 ring-teal/40 transition hover:-translate-y-0.5">
                          <ExternalLink className="size-4" aria-hidden /> Site de dépôt de l&apos;acheteur
                        </a>
                      )}
                    </div>
                  </InfoCard>
                  {brief && brief.lots.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-bold text-navy">Les lots (on peut répondre à un seul)</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {brief.lots.map((l) => (
                          <p key={l} className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200">
                            {l}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {brief?.site_visit ? (
                    <InfoCard icon={MapPinned} title={visitHot ? "Visite obligatoire" : "Visite"} tone={visitHot ? "rose" : "teal"}>
                      <p>{brief.site_visit}</p>
                    </InfoCard>
                  ) : briefState === "ready" ? (
                    <p className="text-sm text-slate-600">L&apos;annonce ne parle pas de visite. Vérifiez dans le règlement de la consultation (sur le site de l&apos;acheteur).</p>
                  ) : null}
                  <TemplateCard icon={MessageSquareText} title="Modèle de question à l'acheteur" text={questionTemplate(tpl)} />
                  <HowTo items={APPLICATION_GUIDE[1].how} />
                </Step>

                <Step n={3} notes={notesFor(2)} title="Évaluer vos capacités" subtitle="Équipe, matériel, trésorerie, délais : avez-vous ce qu'il faut ?" done={done.includes(2)} open={openStep === 2} onOpen={() => setOpenStep(openStep === 2 ? -1 : 2)} onToggle={(v) => toggleStep(2, v)} pending={pending}>
                  <ChecksList opportunityId={data.id} section="capacities" items={CAPACITIES.map((c) => ({ key: c.key, label: c.label }))} initial={data.journey.capacities} />
                  <HowTo items={APPLICATION_GUIDE[2].how} />
                </Step>

                <Step n={4} notes={notesFor(3)} title="Rassembler les documents" subtitle="Cochez chaque document dès qu'il est prêt." done={done.includes(3)} open={openStep === 3} onOpen={() => setOpenStep(openStep === 3 ? -1 : 3)} onToggle={(v) => toggleStep(3, v)} pending={pending}>
                  <BriefZone state={briefState} brief={brief} allowed={data.briefAllowed} upgradeHref={data.upgradeHref}>
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
                        <p className="text-sm text-slate-600">La liste des pièces est dans le règlement de la consultation (sur le site de l&apos;acheteur).</p>
                      )
                    }
                  </BriefZone>
                  <HowTo items={APPLICATION_GUIDE[3].how} />
                </Step>

                <Step n={5} notes={notesFor(4)} title="Préparer votre offre" subtitle="Ce qui rapporte des points, et une trame déjà préparée pour vous." done={done.includes(4)} open={openStep === 4} onOpen={() => setOpenStep(openStep === 4 ? -1 : 4)} onToggle={(v) => toggleStep(4, v)} pending={pending}>
                  {brief && ((brief.criteria ?? []).length > 0 || (brief.tips ?? []).length > 0) && <Notation brief={brief} />}
                  <DraftEditor id={data.id} initial={data.draft} make={() => buildMemoirDraft({ title: data.title, buyer: data.buyer }, brief, data.company)} />
                  <HowTo items={APPLICATION_GUIDE[4].how} />
                </Step>

                <Step n={6} notes={notesFor(5)} title="Organiser et déposer votre candidature" subtitle="Vérifiez tout, déposez sur le site de l'acheteur, notez la référence." done={sent || done.includes(5)} open={openStep === 5} onOpen={() => setOpenStep(openStep === 5 ? -1 : 5)} pending={pending}>
                  {brief?.submission && (
                    <InfoCard icon={Send} title="Où déposer" tone="teal">
                      <p>{brief.submission}</p>
                    </InfoCard>
                  )}
                  <HowTo items={APPLICATION_GUIDE[5].how} />
                  <SubmissionForm
                    opportunityId={data.id}
                    initial={data.journey.submission ?? (sent ? { status: "submitted", date: data.submittedAt ?? undefined } : undefined)}
                    onSaved={(j) => {
                      if (j.submission?.status === "submitted" && !sent) setStage("RESPONSE_SENT");
                    }}
                  />
                </Step>

                <Step n={7} notes={notesFor(6)} title="Suivre le résultat" subtitle="Notez chaque nouvelle de l'acheteur, jusqu'à la décision finale." done={stage === "WON" || stage === "LOST"} open={openStep === 6} onOpen={() => setOpenStep(openStep === 6 ? -1 : 6)} pending={pending}>
                  <ResultTracker opportunityId={data.id} initial={data.journey.results ?? []} enabled={sent} />
                </Step>
              </div>
            </>
          )}
          {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-200">{error}</p>}

          {!discovery && essentials}

          {!discovery && <TeamFollow id={data.id} team={data.team} initial={data.followers} />}

          {stage !== "DETECTED" && <Journal id={data.id} entries={journal} setEntries={setJournal} />}

          {/* Une question ? L'assistant répond à partir de l'avis */}
          <ApplicationAssistant id={data.id} initial={data.questions} suggestions={assistantSuggestions(brief, data.mine)} backTo={backTo} />

          {/* Fin de page : l'annonce officielle */}
          {data.hasSource && (
            <section className="plan-in relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-navy-900 p-6 text-white shadow-xl sm:p-8" data-testid="official-section">
              <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 -z-10 size-64 animate-aurora rounded-full bg-teal/30 blur-3xl" />
              <div aria-hidden className="pointer-events-none absolute -bottom-24 left-10 -z-10 size-56 animate-aurora rounded-full bg-violet/25 blur-3xl [animation-delay:-5s]" />
              <h2 className="font-heading text-2xl font-extrabold text-white">Le dossier complet est sur le site de l&apos;acheteur</h2>
              <p className="mt-2 max-w-2xl text-white/75">Téléchargez-le depuis l&apos;annonce officielle. Votre candidature reste ici, enregistrée, pour suivre chaque étape.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={`/go/${data.id}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  onClick={goToSource}
                  className="btn-shine inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal to-electric px-5 py-3 font-semibold text-navy shadow-lg shadow-teal/25 transition hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <ExternalLink className="size-4" aria-hidden /> Voir l&apos;annonce officielle
                </a>
                <button
                  type="button"
                  onClick={() => goBackToSearch()}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 font-semibold text-white ring-1 ring-white/20 transition hover:-translate-y-0.5 hover:bg-white/15 active:scale-[0.98]"
                >
                  <Search className="size-4" aria-hidden /> Continuer mes recherches
                </button>
              </div>
            </section>
          )}
        </div>

        {/* Repères : le temps qui reste et le planning */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {days !== null && (
            <div className="plan-in relative overflow-hidden rounded-3xl bg-navy p-6 text-white shadow-xl">
              <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-teal/30 blur-3xl" />
              <p className="relative text-xs font-bold tracking-wide text-teal-200 uppercase">Avant la date limite</p>
              <p className="relative mt-1 font-heading text-6xl font-extrabold text-white tabular-nums">{Math.max(0, days)}</p>
              <p className="relative text-white/80">{days < 0 ? "date limite dépassée" : `jour${days > 1 ? "s" : ""} restant${days > 1 ? "s" : ""}`}</p>
            </div>
          )}
          {plan.length > 0 && !discovery && (
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
          {brief && brief.todo.length > 0 && <BuyerTodo id={data.id} items={brief.todo} initial={data.briefDone} />}
          {data.sourceLabel && <p className="px-2 text-xs text-slate-500">D&apos;après l&apos;annonce officielle ({data.sourceLabel}). En cas de doute, le dossier de l&apos;acheteur fait foi.</p>}
        </aside>
      </div>
    </div>
  );
}

/** Étape du guide, repliable : une seule ouverte à la fois, la prochaine à faire. */
function Step({ n, title, subtitle, done, open, onOpen, onToggle, pending, notes, children }: { n: number; title: string; subtitle: string; done: boolean; open: boolean; onOpen: () => void; onToggle?: (v: boolean) => void; pending: boolean; notes?: React.ReactNode; children: React.ReactNode }) {
  // Étape ouverte au clic : l'étape précédente se referme et la page « saute » ; on garde l'étape ouverte
  // en haut de l'écran pour que la personne reste là où elle a cliqué (pas au chargement de la page)
  const ref = useRef<HTMLElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      if (top < 64 || top > window.innerHeight * 0.5) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [open]);
  return (
    <section ref={ref} id={`etape-${n}`} className={cn("plan-in scroll-mt-24 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 transition", open ? "shadow-md ring-teal/40" : "ring-slate-200")} style={{ animationDelay: `${n * 50}ms` }}>
      <button type="button" onClick={onOpen} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50/70 sm:gap-4 sm:p-5">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl font-heading text-base font-extrabold transition-all duration-300", done ? "bg-gradient-to-br from-teal to-violet text-white" : open ? "bg-navy text-white" : "bg-slate-100 text-slate-500")}>
          {done ? <Check className="size-5" aria-hidden /> : n}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block font-heading text-lg leading-snug font-bold", done && !open ? "text-slate-500" : "text-navy")}>{title}</span>
          <span className="block text-sm text-slate-500">{done ? "Étape faite" : subtitle}</span>
        </span>
        <ChevronDown className={cn("size-5 shrink-0 text-slate-400 transition duration-300", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="animate-rise space-y-5 border-t border-slate-100 p-4 sm:p-8">
          {children}
          {notes}
          {onToggle &&
            (done ? (
              <button type="button" disabled={pending} onClick={() => onToggle(false)} className="text-sm font-semibold text-slate-500 underline-offset-2 hover:text-navy hover:underline disabled:opacity-50">
                Étape faite · la remettre à faire
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => onToggle(true)}
                className="btn-shine inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-navy px-5 py-3.5 font-semibold text-white shadow-lg shadow-navy/15 transition hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 sm:w-auto"
              >
                <Check className="size-5" aria-hidden /> C&apos;est fait : étape suivante
              </button>
            ))}
        </div>
      )}
    </section>
  );
}

/** Ligne de « En bref » : l'information en une phrase, le détail en un clic. */
function EssentialRow({ icon: Icon, title, text, tone = "neutral", children }: { icon: typeof Lightbulb; title: string; text: string; tone?: "ok" | "missing" | "check" | "neutral"; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const color = tone === "missing" ? "bg-rose-50 text-rose-600" : tone === "ok" ? "bg-teal-50 text-teal-700" : "bg-sky text-teal-700";
  const body = (
    <>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", color)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold tracking-wide text-slate-500 uppercase">{title}</span>
        <span className={cn("block text-[15px] leading-snug", tone === "missing" ? "font-semibold text-rose-800" : "text-navy")}>{text}</span>
      </span>
    </>
  );
  if (!children) return <div className="flex items-start gap-3 rounded-2xl bg-slate-50/70 p-3 ring-1 ring-slate-200">{body}</div>;
  return (
    <div className="rounded-2xl bg-slate-50/70 ring-1 ring-slate-200">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start gap-3 p-3 text-left">
        {body}
        <span className="mt-2 inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-teal-700">
          <span className="hidden sm:inline">{open ? "Masquer" : "Détail"}</span>
          <ChevronDown className={cn("size-4 transition duration-300", open && "rotate-180")} aria-hidden />
        </span>
      </button>
      {open && <div className="animate-rise border-t border-slate-200/70 px-3 pt-3 pb-4 sm:px-4">{children}</div>}
    </div>
  );
}

/** Ce qui compte dans la note : critères et poids, puis conseils tirés de l'annonce. */
function Notation({ brief }: { brief: TenderBrief }) {
  const criteria = (brief.criteria ?? []).filter((c) => c.label.trim());
  return (
    <div className="space-y-4">
      {criteria.length > 0 && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="mb-3 text-sm font-bold text-navy">Comment l&apos;offre sera notée</p>
          <div className="space-y-3">
            {criteria.map((c, i) => (
              <div key={c.label}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-slate-700">{c.label}</span>
                  {c.weight ? <span className="font-bold text-navy tabular-nums">{c.weight} %</span> : null}
                </div>
                {c.weight ? (
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="plan-in h-full rounded-full bg-gradient-to-r from-teal to-violet" style={{ width: `${Math.min(100, c.weight)}%`, animationDelay: `${i * 120}ms` }} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
      {(brief.tips ?? []).length > 0 && (
        <InfoCard icon={Lightbulb} title="Pour avoir la meilleure note" tone="teal">
          <Bullets items={(brief.tips ?? []).slice(0, 3)} />
        </InfoCard>
      )}
    </div>
  );
}

/** « À faire » tiré de l'annonce, à cocher (replié par défaut) : la première case cochée enregistre la candidature. */
function BuyerTodo({ id, items, initial }: { id: string; items: string[]; initial: number[] }) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<number[]>(initial);
  const [pending, start] = useTransition();
  const toggle = (i: number, value: boolean) => {
    const before = checked;
    setChecked(value ? [...checked, i].sort((a, b) => a - b) : checked.filter((x) => x !== i));
    start(async () => {
      const r = await toggleBriefStep(id, i, value);
      if (r.ok) setChecked(r.done);
      else setChecked(before);
    });
  };
  return (
    <div className="plan-in rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 [animation-delay:200ms]">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 p-5 text-left font-bold text-navy">
        <ClipboardCheck className="size-4 text-teal-700" aria-hidden />
        <span className="flex-1">À faire selon l&apos;annonce</span>
        <span className="text-xs font-semibold text-slate-500 tabular-nums">
          {checked.length}/{items.length}
        </span>
        <ChevronDown className={cn("size-4 text-slate-400 transition duration-300", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <ul className="animate-rise space-y-2 px-5 pb-5">
          {items.map((t, i) => {
            const ok = checked.includes(i);
            return (
              <li key={t}>
                <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                  <input type="checkbox" className="peer sr-only" checked={ok} disabled={pending} onChange={(e) => toggle(i, e.target.checked)} />
                  <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md ring-2 transition peer-focus-visible:ring-teal", ok ? "bg-gradient-to-br from-teal to-violet text-white ring-transparent" : "text-transparent ring-slate-300")}>
                    <Check className="size-3.5" aria-hidden />
                  </span>
                  <span className={ok ? "text-slate-400 line-through" : "text-slate-700"}>{t}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function conditionsTone(brief: TenderBrief, mine: string[]): "ok" | "missing" | "check" | "neutral" {
  const status = (brief.certifications ?? []).map((c) => certStatus(c, mine));
  if (status.includes("missing")) return "missing";
  if (status.includes("check")) return "check";
  return status.length ? "ok" : "neutral";
}

/** « Puis-je répondre ? » en une phrase. */
function conditionsLine(brief: TenderBrief, mine: string[]): string {
  const certs = brief.certifications ?? [];
  const status = certs.map((c) => certStatus(c, mine));
  const missing = status.filter((x) => x === "missing").length;
  const capacity = brief.capacity ?? [];
  if (missing) return `Il vous manque ${missing} exigence${missing > 1 ? "s" : ""} : c'est possible avec un partenaire.`;
  if (status.includes("check")) return "Certaines certifications sont à vérifier sur votre fiche.";
  if (certs.length) return `Vos certifications correspondent${capacity.length ? ", d'autres conditions sont à vérifier" : ""}.`;
  if (capacity.length) return `Pas de certification exigée. ${capacity.length} condition${capacity.length > 1 ? "s" : ""} à vérifier.`;
  return "Pas de condition particulière dans l'annonce.";
}

/** La notation en une phrase : « Prix 40 % · Qualité 60 % », sinon le texte de l'annonce. */
function notationLine(brief: TenderBrief): string {
  const criteria = (brief.criteria ?? []).filter((c) => c.label.trim());
  if (criteria.length) return criteria.map((c) => (c.weight ? `${c.label} ${c.weight} %` : c.label)).join(" · ");
  return brief.judging.length > 160 ? `${brief.judging.slice(0, 157).replace(/\s+\S*$/, "")}…` : brief.judging;
}

function BriefZone({ state, brief, allowed, upgradeHref, children }: { state: "ready" | "loading" | "none"; brief: TenderBrief | null; allowed: boolean; upgradeHref: string; children: (b: TenderBrief) => React.ReactNode }) {
  if (brief) return <>{children(brief)}</>;
  if (state === "loading")
    return (
      <div className="space-y-3" aria-live="polite">
        <p className="text-sm font-semibold text-teal-700">Lecture de l&apos;annonce officielle… (quelques secondes)</p>
        {[85, 65, 75].map((w) => (
          <div key={w} className="h-4 animate-pulse rounded-full bg-slate-100" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
      {allowed ? (
        "Ces informations sont dans l'annonce officielle et le règlement de la consultation (sur le site de l'acheteur)."
      ) : (
        <>
          Le résumé de l&apos;annonce (conditions, pièces, notation) est inclus dans l&apos;offre Pro.{" "}
          <Link href={upgradeHref} className="font-semibold text-teal-700 underline">
            Voir l&apos;offre Pro
          </Link>
        </>
      )}
    </div>
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
    pendingValue.current = value;
    timer.current = setTimeout(() => {
      pendingValue.current = null;
      saveDraft(id, value)
        .then((r) => setStatus(r.ok ? "saved" : "error"))
        .catch(() => setStatus("error"));
    }, 1000);
  };
  // La personne quitte la page (retour, autre onglet, fermeture) : le texte tapé à l'instant est enregistré tout de suite
  const pendingValue = useRef<string | null>(null);
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState !== "hidden" || pendingValue.current === null) return;
      if (timer.current) clearTimeout(timer.current);
      const value = pendingValue.current;
      pendingValue.current = null;
      void saveDraft(id, value).catch(() => undefined);
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [id]);
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

const noopSubscribe = () => () => {};

/** Résultat officiel détecté (ou surveillé) : l'entreprise n'a plus à aller vérifier elle-même. */
function AwardBanner({ award, watched }: { award: WorkspaceData["award"]; watched: boolean }) {
  if (award)
    return (
      <div className="plan-in mb-4 rounded-2xl bg-gradient-to-br from-navy to-navy-900 p-5 text-white shadow-lg" data-testid="award-found">
        <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-teal-400 uppercase">
          <BellRing className="size-4" aria-hidden /> {award.cancelled ? "Consultation annulée" : "Résultat publié"}
          {award.date ? ` · ${new Date(`${award.date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : ""}
        </p>
        <p className="mt-2 font-heading text-lg font-bold">
          {award.cancelled
            ? "L'acheteur a publié un avis d'annulation de cette consultation."
            : award.won
              ? `🎉 L'avis désigne ${award.titulaires.join(", ") || "votre entreprise"} comme titulaire`
              : award.titulaires.length
                ? `Marché attribué à ${award.titulaires.join(", ")}`
                : "L'avis de résultat est publié."}
        </p>
        {!award.cancelled && offersLabel(award.offers) && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white" data-testid="award-offers">
            <Users className="size-4 text-teal-400" aria-hidden /> Concurrence : {offersLabel(award.offers)}
          </p>
        )}
        {!award.cancelled && (
          <p className="mt-1 text-sm text-slate-300">
            {award.won ? "C'est votre entreprise : félicitations ! Confirmez-le juste en dessous avec « Gagné »." : "C'est votre entreprise ? Indiquez-le juste en dessous : Gagné ou Pas retenu."}
          </p>
        )}
        <a href={award.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-400 hover:underline">
          <ExternalLink className="size-4" aria-hidden /> Voir l&apos;avis officiel
        </a>
      </div>
    );
  if (!watched) return null;
  return (
    <p className="plan-in mb-4 flex items-start gap-2 rounded-2xl bg-teal-50 px-4 py-3 text-sm text-teal-900 ring-1 ring-teal/25" data-testid="award-watched">
      <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <strong>On surveille le résultat pour vous.</strong> Chaque jour, LinkProB2B vérifie au BOAMP si l&apos;avis de résultat est publié : vous serez prévenu ici
        et dans vos notifications, sans avoir à chercher.
      </span>
    </p>
  );
}

/** Date AAAA-MM-JJ dans `n` jours (heure de Paris). */
const inDays = (n: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(Date.now() + n * 86_400_000));
const QUICK_REMINDERS = [
  { label: "Relancer l'acheteur dans 3 semaines", days: 21, text: "Relancer l'acheteur" },
  { label: "Faire le point dans 1 mois", days: 30, text: "Faire le point sur ma candidature" },
];

const AFTER_DEPOSIT = [
  { t: "J'ai gardé l'accusé de réception du dépôt", d: "Le reçu (ou l'e-mail de confirmation) de la plateforme de l'acheteur prouve que votre offre est arrivée à temps." },
  { t: "Je surveille la messagerie de la plateforme de l'acheteur", d: "L'acheteur peut poser une question ou demander un document manquant, souvent avec un délai court pour répondre." },
  { t: "J'ai noté jusqu'à quand mon offre est valable", d: "La durée de validité des offres est indiquée dans le règlement de la consultation." },
];

/** Après le dépôt : petite liste à cocher, rappel à une date choisie et modèle de relance de l'acheteur. */
function AfterDeposit({ id, reminder, followUp }: { id: string; reminder: { date: string; text: string } | null; followUp: string }) {
  const key = `apres-depot-${id}`;
  // Cases cochées gardées dans ce navigateur (lues après l'affichage, pour un rendu serveur identique)
  const stored = useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return window.localStorage.getItem(key) ?? "[]";
      } catch {
        return "[]";
      }
    },
    () => "[]",
  );
  const [override, setChecked] = useState<number[] | null>(null);
  const checked = useMemo<number[]>(() => {
    if (override) return override;
    try {
      return JSON.parse(stored) as number[];
    } catch {
      return [];
    }
  }, [override, stored]);
  const [current, setCurrent] = useState(reminder);
  const [date, setDate] = useState(reminder?.date ?? "");
  const [text, setText] = useState(reminder?.text ?? "Relancer l'acheteur");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = (i: number) => {
    const next = checked.includes(i) ? checked.filter((x) => x !== i) : [...checked, i];
    setChecked(next);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // stockage indisponible : la case reste cochée pour cette visite
    }
  };
  const save = (d: string, t = text) =>
    start(async () => {
      const r = await setApplicationReminder(id, d, t);
      if (!r.ok) return setMsg(r.error);
      setCurrent(d ? { date: d, text: t } : null);
      if (d) {
        setDate(d);
        setText(t);
      } else setDate("");
      setMsg(d ? "Rappel enregistré." : "Rappel supprimé.");
    });
  return (
    <div className="mt-5 space-y-4" data-testid="after-deposit">
      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <p className="flex items-center gap-2 font-heading text-lg font-bold text-navy">
          <ClipboardCheck className="size-5 text-teal-600" aria-hidden /> En attendant le résultat
        </p>
        <ul className="mt-3 space-y-2">
          {AFTER_DEPOSIT.map((x, i) => (
            <li key={x.t}>
              <button type="button" onClick={() => toggle(i)} aria-pressed={checked.includes(i)} className="flex w-full items-start gap-3 rounded-xl p-2 text-left transition hover:bg-slate-50">
                <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md ring-1", checked.includes(i) ? "bg-teal text-white ring-teal" : "bg-white ring-slate-300")}>
                  {checked.includes(i) && <Check className="size-3.5" aria-hidden />}
                </span>
                <span>
                  <span className={cn("block font-semibold", checked.includes(i) ? "text-slate-500 line-through" : "text-navy")}>{x.t}</span>
                  <span className="block text-sm text-slate-600">{x.d}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-sky to-white p-5 ring-1 ring-slate-200" data-testid="after-deposit-reminder">
        <p className="flex items-center gap-2 font-heading text-lg font-bold text-navy">
          <BellRing className="size-5 text-teal-600" aria-hidden /> Me rappeler
        </p>
        {current ? (
          <p className="mt-2 text-sm text-slate-700">
            Rappel prévu le <strong className="text-navy">{fmtDay(`${current.date}T12:00:00`)}</strong> : {current.text || "faire le point sur ma candidature"}. Il apparaîtra dans « À faire maintenant » et dans vos
            notifications.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">Choisissez une date : le rappel apparaîtra dans « À faire maintenant » et dans vos notifications.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2" data-testid="quick-reminders">
          {QUICK_REMINDERS.map((q) => (
            <button
              key={q.days}
              type="button"
              disabled={pending}
              onClick={() => save(inDays(q.days), q.text)}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-navy ring-1 ring-teal/40 transition hover:-translate-y-0.5 hover:bg-teal-50 disabled:opacity-50"
            >
              <CalendarClock className="size-4 text-teal-600" aria-hidden /> {q.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-500">Ou choisissez vous-même :</p>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <label className="sr-only" htmlFor={`rappel-texte-${id}`}>
            Quoi
          </label>
          <input
            id={`rappel-texte-${id}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={200}
            placeholder="Ex. : relancer l'acheteur, résultat attendu"
            className="rounded-xl border-0 bg-white px-3 py-2.5 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-teal"
          />
          <label className="sr-only" htmlFor={`rappel-date-${id}`}>
            Date
          </label>
          <input
            id={`rappel-date-${id}`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border-0 bg-white px-3 py-2.5 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-teal"
            data-testid="reminder-date"
          />
          <button
            type="button"
            disabled={pending || !date}
            onClick={() => save(date)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50"
            data-testid="reminder-save"
          >
            <CalendarClock className="size-4" aria-hidden /> {current ? "Modifier" : "Me rappeler"}
          </button>
        </div>
        {current && (
          <button type="button" disabled={pending} onClick={() => save("")} className="mt-2 text-sm font-semibold text-slate-500 hover:text-rose-700">
            Supprimer le rappel
          </button>
        )}
        {msg && (
          <p className="mt-2 text-sm text-slate-700" role="status">
            {msg}
          </p>
        )}
      </div>

      <TemplateCard icon={MessageSquareText} title="Pas de nouvelles après plusieurs semaines ? Modèle de relance de l'acheteur" text={followUp} />
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

/** « Comment faire » d'une étape : ouvert d'emblée (l'étape est déjà dépliée), repliable. */
function HowTo({ items, open = true }: { items: string[]; open?: boolean }) {
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

/** Notes d'une étape du parcours : chacun de l'équipe peut noter où il en est (elles apparaissent aussi dans le journal). */
function StepNotes({ id, step, entries, onAdd, onRemove }: { id: string; step: number; entries: JournalEntry[]; onAdd: (e: JournalEntry) => void; onRemove: (id: string) => void }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const add = () =>
    start(async () => {
      setError(null);
      const r = await addJournalNote(id, text, step).catch(() => ({ ok: false as const, error: "Connexion perdue. Réessayez." }));
      if (r.ok) {
        onAdd(r.entry);
        setText("");
      } else setError(r.error);
    });
  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200" data-testid={`step-notes-${step + 1}`}>
      <p className="flex items-center gap-2 text-sm font-bold text-navy">
        <NotebookPen className="size-4 text-teal-700" aria-hidden /> Notes de cette étape
        <span className="text-xs font-normal text-slate-500">· visibles par votre équipe</span>
      </p>
      {entries.length > 0 && (
        <ul className="mt-3 space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="animate-rise flex items-start gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
              <p className="min-w-0 flex-1 text-slate-700 [overflow-wrap:anywhere]">
                {e.body}
                <span className="mt-0.5 block text-xs text-slate-400">
                  {new Date(e.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} à {new Date(e.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  {e.author ? ` · ${e.author}` : ""}
                </span>
              </p>
              {e.mine && (
                <button
                  type="button"
                  aria-label="Supprimer la note"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await deleteJournalNote(e.id);
                      if (r.ok) onRemove(e.id);
                    })
                  }
                  className="rounded-lg p-1 text-slate-300 transition hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={2000}
          aria-label={`Note pour l'étape ${step + 1}`}
          placeholder="Ex. : attestation demandée à l'assureur, réponse attendue jeudi…"
          className="min-h-12 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal focus:ring-2 focus:ring-teal/30 focus:outline-none"
        />
        <button type="button" disabled={pending || !text.trim()} onClick={add} className="h-12 shrink-0 rounded-xl bg-navy px-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50 sm:self-end">
          Ajouter la note
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}

/** Équipe sur ce dossier : ajouter un collègue au suivi de la candidature (il est prévenu). */
function TeamFollow({ id, team, initial }: { id: string; team: TeamMember[]; initial: string[] }) {
  const [followers, setFollowers] = useState<string[]>(initial);
  const [choice, setChoice] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const byId = new Map(team.map((m) => [m.id, m]));
  const following = followers.map((f) => byId.get(f)).filter((m): m is TeamMember => Boolean(m));
  const others = team.filter((m) => !followers.includes(m.id));
  const add = (uid: string) =>
    start(async () => {
      setMsg(null);
      const r = await addFollower(id, uid).catch(() => ({ ok: false as const, error: "Connexion perdue. Réessayez." }));
      if (r.ok) {
        setFollowers((f) => [...f, uid]);
        setChoice("");
        const m = byId.get(uid);
        setMsg({ ok: true, text: m?.you ? "Vous suivez ce dossier." : `${m?.name ?? "Votre collègue"} suit maintenant ce dossier : il est prévenu dans ses notifications.` });
      } else setMsg({ ok: false, text: r.error });
    });
  const remove = (uid: string) =>
    start(async () => {
      setMsg(null);
      const r = await removeFollower(id, uid).catch(() => ({ ok: false as const, error: "Connexion perdue. Réessayez." }));
      if (r.ok) setFollowers((f) => f.filter((x) => x !== uid));
      else setMsg({ ok: false, text: r.error });
    });
  return (
    <section className="plan-in rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6" data-testid="team-follow">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal to-violet text-white">
          <Users className="size-5" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block font-heading text-lg font-bold text-navy">Équipe sur ce dossier</span>
          <span className="block text-sm text-slate-500">Ajoutez un collègue : il retrouve la candidature, ses étapes et ses notes.</span>
        </span>
      </div>
      {following.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {following.map((m) => (
            <li key={m.id} className="animate-rise inline-flex items-center gap-2 rounded-full bg-teal-50 py-1 pr-1 pl-1 text-sm font-semibold text-teal-900 ring-1 ring-teal/30">
              <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-teal to-violet text-xs font-bold text-white">
                {m.name.trim().charAt(0).toUpperCase()}
              </span>
              {m.you ? `${m.name} (vous)` : m.name}
              <button type="button" disabled={pending} onClick={() => remove(m.id)} aria-label={`Retirer ${m.name} du suivi`} className="rounded-full p-1 text-teal-700 transition hover:bg-white hover:text-rose-600 disabled:opacity-50">
                <XCircle className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <select value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="Membre de l'équipe à ajouter" className="h-12 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm">
            <option value="">Choisir un membre de l&apos;équipe…</option>
            {others.map((m) => (
              <option key={m.id} value={m.id}>
                {m.you ? `${m.name} (vous)` : m.name}
              </option>
            ))}
          </select>
          <button type="button" disabled={pending || !choice} onClick={() => add(choice)} className="btn-shine inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-navy px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50">
            <UserPlus className="size-4" aria-hidden /> Ajouter au suivi
          </button>
        </div>
      )}
      {team.filter((m) => !m.you).length === 0 && (
        <p className="mt-4 text-sm text-slate-600">
          Vous êtes seul dans l&apos;équipe pour l&apos;instant.{" "}
          <Link href="/dashboard/entreprise#equipe" className="font-semibold text-teal-700 underline-offset-2 hover:underline">
            Inviter un collègue
          </Link>{" "}
          pour qu&apos;il puisse suivre ce dossier avec vous.
        </p>
      )}
      {msg && (
        <p className={cn("mt-3 text-sm font-semibold", msg.ok ? "text-teal-800" : "text-rose-700")} aria-live="polite">
          {msg.text}
        </p>
      )}
    </section>
  );
}

/** Journal de suivi jour par jour : notes de l'équipe et étapes franchies. */
function Journal({ id, entries, setEntries }: { id: string; entries: JournalEntry[]; setEntries: (e: JournalEntry[]) => void }) {
  const [open, setOpen] = useState(false);
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
    <section id="journal" className="plan-in scroll-mt-24 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-slate-50/70 sm:p-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal to-violet text-white">
          <BookOpen className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-lg font-bold text-navy">Journal de suivi</span>
          <span className="block text-sm text-slate-500">{entries.length ? `${entries.length} élément${entries.length > 1 ? "s" : ""} · visible par votre équipe` : "Vos notes, jour après jour · visible par votre équipe"}</span>
        </span>
        <ChevronDown className={cn("size-5 shrink-0 text-slate-400 transition duration-300", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
      <div className="animate-rise border-t border-slate-100 p-5 sm:p-8">
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
                      {e.kind === "NOTE" && e.step !== null && <span className="mr-1.5 font-semibold text-teal-800">Étape {e.step + 1} ·</span>}{e.kind === "NOTE" && e.step !== null && " "}
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
