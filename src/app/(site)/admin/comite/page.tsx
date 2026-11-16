import Link from "next/link";
import { AlertTriangle, CalendarClock, Gavel, MessageSquareQuote, Moon, ScrollText, Sun, UserRound } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUTHOR_LABEL, STATUS } from "@/lib/board-core";
import { KIND_LABEL, type BoardKind } from "@/lib/board";
import { launchReadiness } from "@/lib/launch-readiness";
import { DecisionActions, ConvokeForm } from "@/components/board/decision-actions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata = { title: "Comité de direction" };
// « Réunir le comité » : la réunion dure 1 à 2 minutes
export const maxDuration = 300;

const TONE: Record<string, string> = {
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  orange: "bg-orange-50 text-orange-700 ring-orange-200",
  teal: "bg-teal-50 text-teal-700 ring-teal-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
  slate: "bg-slate-50 text-slate-600 ring-slate-200",
  navy: "bg-sky text-navy ring-slate-200",
};
const AUTHOR_COLOR: Record<string, string> = {
  DAF: "from-emerald-500 to-teal-600",
  CMO: "from-fuchsia-500 to-violet-600",
  CPO: "from-sky-500 to-blue-600",
  CTO: "from-slate-600 to-navy",
  CEO: "from-navy to-violet-700",
  FONDATEUR: "from-teal-500 to-teal-700",
  SYSTEME: "from-rose-500 to-rose-700",
};
const KIND_ICON = { MATIN: Sun, SOIR: Moon, EXCEPTIONNELLE: AlertTriangle } as const;
const URGENCY: Record<string, string> = { haute: "text-rose-700", moyenne: "text-orange-700", basse: "text-slate-500" };
const VERDICT: Record<string, string> = { a_valider: "Soumise au fondateur", refusee: "Refusée", plus_d_infos: "Plus d'infos demandées", VALIDEE: "Validée", REFUSEE: "Refusée", PLUS_INFO: "Plus d'infos" };

type Decision = {
  id: string;
  session_id: string;
  created_at: string;
  proposer: string;
  problem: string;
  decision: string;
  justification: string;
  data_used: string | null;
  expected: string | null;
  budget_eur: number | null;
  risks: string | null;
  urgency: string;
  metric: string | null;
  target: string | null;
  check_after_days: number | null;
  critic: string | null;
  critic_opinion: string | null;
  critique: string | null;
  ceo_verdict: string | null;
  ceo_reason: string | null;
  status: string;
  founder_comment: string | null;
};
type Message = { id: number; author: string; kind: string; decision_id: string | null; created_at: string; content: Record<string, unknown> };

function Avatar({ who, size = "md" }: { who: string; size?: "sm" | "md" }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br font-heading font-bold text-white shadow-sm", AUTHOR_COLOR[who] ?? "from-slate-500 to-slate-700", size === "sm" ? "size-8 text-[11px]" : "size-10 text-xs")}>
      {who === "FONDATEUR" ? <UserRound className="size-4" aria-hidden /> : who === "SYSTEME" ? <AlertTriangle className="size-4" aria-hidden /> : who}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, tone: "slate" };
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", TONE[s.tone])}>{s.label}</span>;
}

/** Fiche de décision complète (problème, justification, données, risques, critique, avis du CEO). */
function DecisionCard({ d, actions, work = [] }: { d: Decision; actions?: boolean; work?: Message[] }) {
  const rows: [string, string | null][] = [
    ["Problème identifié", d.problem],
    ["Justification", d.justification],
    ["Données utilisées", d.data_used],
    ["Effet attendu", d.expected],
    ["Risques", d.risks],
    ["Indicateur à suivre", d.metric ? `${d.metric}${d.target ? ` · cible : ${d.target}` : ""}${d.check_after_days ? ` · vérification dans ${d.check_after_days} jours` : ""}` : null],
  ];
  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200" data-testid="decision-card">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-start sm:p-5">
        <Avatar who={d.proposer} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-navy">{AUTHOR_LABEL[d.proposer] ?? d.proposer}</span>
            <span>·</span>
            <span>{formatDateTime(d.created_at)}</span>
            <span>·</span>
            <span className={cn("font-semibold", URGENCY[d.urgency])}>urgence {d.urgency}</span>
            {d.budget_eur ? <span className="font-semibold text-navy">· budget {d.budget_eur} €</span> : null}
          </div>
          <h3 className="mt-1 font-heading text-base font-bold text-navy sm:text-lg">{d.decision}</h3>
        </div>
        <StatusChip status={d.status} />
      </div>
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
        <dl className="min-w-0 space-y-3 text-sm">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{k}</dt>
                <dd className="mt-0.5 text-slate-700">{v}</dd>
              </div>
            ))}
        </dl>
        <div className="min-w-0 space-y-3">
          {d.critique && (
            <div className="rounded-xl bg-orange-50/70 p-3 text-sm ring-1 ring-orange-100">
              <p className="flex items-center gap-2 text-xs font-semibold text-orange-800">
                <MessageSquareQuote className="size-4" aria-hidden /> Contradicteur · {AUTHOR_LABEL[d.critic ?? ""] ?? d.critic} · avis {d.critic_opinion}
              </p>
              <p className="mt-1 text-slate-700">{d.critique}</p>
            </div>
          )}
          {d.ceo_reason && (
            <div className="rounded-xl bg-violet-50/70 p-3 text-sm ring-1 ring-violet-100">
              <p className="flex items-center gap-2 text-xs font-semibold text-violet-800">
                <Gavel className="size-4" aria-hidden /> Le CEO · {VERDICT[d.ceo_verdict ?? ""] ?? d.ceo_verdict}
              </p>
              <p className="mt-1 text-slate-700">{d.ceo_reason}</p>
            </div>
          )}
          {d.founder_comment && (
            <div className="rounded-xl bg-teal-50/70 p-3 text-sm ring-1 ring-teal-100">
              <p className="text-xs font-semibold text-teal-800">Votre commentaire</p>
              <p className="mt-1 text-slate-700">{d.founder_comment}</p>
            </div>
          )}
          {work.length > 0 && (
            <div className="rounded-xl bg-sky p-3 text-sm ring-1 ring-slate-200">
              <p className="text-xs font-semibold text-navy">Mise en œuvre</p>
              <ul className="mt-1 space-y-2">
                {work.map((w) => (
                  <li key={w.id} className="text-slate-700">
                    <span className="text-xs text-slate-500">{formatDateTime(w.created_at)} · </span>
                    <span className="whitespace-pre-line">{String(w.content.texte ?? "")}</span>
                    {typeof w.content.lien === "string" && (
                      <a href={w.content.lien} className="ml-1 font-semibold text-teal-700 underline" target="_blank" rel="noreferrer">
                        voir
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {actions && <DecisionActions id={d.id} />}
        </div>
      </div>
    </article>
  );
}

export default async function BoardPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await props.searchParams;
  const db = createAdminClient();
  const [{ data: sessions }, { data: pendingRaw }, { data: journalRaw }, { data: workRaw }, launch] = await Promise.all([
    db.from("board_sessions").select("id, day, kind, started_at, status, title, ceo_message, error").order("started_at", { ascending: false }).limit(12),
    db.from("board_decisions").select("*").in("status", ["A_VALIDER", "PLUS_INFO"]).order("created_at", { ascending: false }).limit(30),
    db.from("board_decisions").select("*").order("created_at", { ascending: false }).limit(60),
    // Suivi de la mise en œuvre des décisions validées (développement, livrables)
    db.from("board_messages").select("id, author, kind, decision_id, created_at, content").eq("kind", "SYSTEME").not("decision_id", "is", null).order("id").limit(300),
    launchReadiness().catch(() => null),
  ]);
  const work = (workRaw ?? []) as unknown as Message[];
  const workOf = (id: string) => work.filter((w) => w.decision_id === id);
  const pending = (pendingRaw ?? []) as Decision[];
  const toValidate = pending.filter((d) => d.status === "A_VALIDER");
  const waitingInfo = pending.filter((d) => d.status === "PLUS_INFO");
  const journal = (journalRaw ?? []) as Decision[];
  const selected = (sessions ?? []).find((s) => s.id === sp.reunion) ?? (sessions ?? [])[0] ?? null;
  const { data: messagesRaw } = selected ? await db.from("board_messages").select("id, author, kind, decision_id, created_at, content").eq("session_id", selected.id).order("id") : { data: [] };
  const messages = (messagesRaw ?? []) as unknown as Message[];
  const sessionDecisions = selected ? journal.filter((d) => d.session_id === selected.id) : [];
  const notes = messages.filter((m) => m.kind === "NOTE");
  const opening = messages.find((m) => (m.kind === "SYSTEME" || m.kind === "FONDATEUR") && !m.decision_id);

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-navy-900 to-violet-900 p-5 text-white shadow-xl sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-bold tracking-wider text-teal-200 uppercase">Comité de direction</p>
          <h1 className="mt-1 font-heading text-2xl font-extrabold text-white sm:text-3xl">{selected?.title ?? "Le comité ne s'est pas encore réuni"}</h1>
          <p className="mt-2 max-w-3xl text-sm text-white/75 sm:text-base">
            Réunion chaque matin à 8 h et chaque soir à 19 h, plus une réunion exceptionnelle dès qu&apos;une alerte se déclenche. Les directeurs lisent les vrais chiffres, se contredisent, le CEO tranche, et rien n&apos;est exécuté sans votre accord. Bilan par e-mail après chaque réunion.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["À valider", toValidate.length],
              ["Plus d'infos demandées", waitingInfo.length],
              ["Décisions (30 dernières)", journal.length > 30 ? "30+" : journal.length],
              ["Dernière réunion", selected ? formatDateTime(selected.started_at) : "—"],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
                <p className="font-heading text-xl font-bold sm:text-2xl">{v}</p>
                <p className="text-xs text-white/70">{k}</p>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <ConvokeForm />
          </div>
        </div>
      </section>

      {/* Seuils du lancement payant */}
      {launch && (
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6" data-testid="launch-thresholds">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h2 className="font-heading text-lg font-bold text-navy">Seuils du lancement payant</h2>
            <p className={cn("text-sm font-semibold", launch.pret ? "text-teal-700" : "text-slate-500")}>
              {launch.pret ? "Tous atteints : la décision vous revient" : `${launch.atteints} sur ${launch.criteres.length} atteints · alerte par e-mail dès que tout est atteint · réexamen le ${new Date(`${launch.reexamen}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`}
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {launch.criteres.map((c) => (
              <div key={c.libelle} className={cn("rounded-2xl p-4 ring-1", c.atteint ? "bg-teal-50 ring-teal-200" : "bg-slate-50 ring-slate-200")}>
                <p className="text-xs font-semibold text-slate-500">{c.libelle}</p>
                <p className="mt-1 font-heading text-xl font-bold text-navy">{c.actuel}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {c.atteint ? "✓ atteint · " : ""}seuil : {c.seuil}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* À valider */}
      <section data-testid="to-validate">
        <h2 className="mb-3 flex items-center gap-2 font-heading text-xl font-bold text-navy">
          <Gavel className="size-5 text-violet-600" aria-hidden /> À valider {toValidate.length > 0 && <span className="rounded-full bg-violet-600 px-2 py-0.5 text-xs text-white">{toValidate.length}</span>}
        </h2>
        {toValidate.length ? (
          <div className="space-y-4">
            {toValidate.map((d) => (
              <DecisionCard key={d.id} d={d} actions />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-white p-5 text-sm text-slate-500 ring-1 ring-slate-200">Aucune décision n&apos;attend votre validation.</p>
        )}
      </section>

      {/* Compte rendu */}
      <section data-testid="minutes">
        <h2 className="mb-3 flex items-center gap-2 font-heading text-xl font-bold text-navy">
          <ScrollText className="size-5 text-teal-600" aria-hidden /> Compte rendu des réunions
        </h2>
        {(sessions ?? []).length > 0 && (
          <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
            {(sessions ?? []).map((s) => {
              const Icon = KIND_ICON[s.kind as BoardKind] ?? CalendarClock;
              return (
                <Link
                  key={s.id}
                  href={`/admin/comite?reunion=${s.id}`}
                  className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition", s.id === selected?.id ? "bg-navy text-white ring-navy" : "bg-white text-navy ring-slate-200 hover:ring-navy")}
                >
                  <Icon className="size-3.5" aria-hidden /> {KIND_LABEL[s.kind as BoardKind] ?? s.kind} · {formatDateTime(s.started_at)}
                  {s.status !== "DONE" && <span className="text-rose-300">({s.status === "RUNNING" ? "en cours" : "échec"})</span>}
                </Link>
              );
            })}
          </div>
        )}
        {!selected ? (
          <p className="rounded-2xl bg-white p-5 text-sm text-slate-500 ring-1 ring-slate-200">La première réunion aura lieu ce matin à 8 h (ou ce soir à 19 h). Vous pouvez aussi réunir le comité maintenant.</p>
        ) : (
          <div className="space-y-4">
            {opening && (
              <div className="flex items-start gap-3 rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200">
                <Avatar who={opening.author} size="sm" />
                <p className="text-sm text-rose-900">
                  <strong>Motif de la réunion :</strong> {String(opening.content.texte ?? "")}
                </p>
              </div>
            )}
            {selected.error && <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200">Réunion interrompue : {selected.error}</p>}
            <div className="grid gap-4 lg:grid-cols-2">
              {notes.map((m) => {
                const c = m.content as { constat?: string; points?: string[]; propositions?: string[]; controle?: string[] };
                return (
                  <article key={m.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
                    <div className="flex items-center gap-3">
                      <Avatar who={m.author} />
                      <div className="min-w-0">
                        <p className="font-heading font-bold text-navy">{AUTHOR_LABEL[m.author] ?? m.author}</p>
                        <p className="text-xs text-slate-500">{(c.propositions ?? []).length ? `${(c.propositions ?? []).length} proposition(s)` : "Aucune proposition"}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-700">{c.constat}</p>
                    {(c.points ?? []).length > 0 && (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                        {(c.points ?? []).map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    )}
                    {(c.controle ?? []).length > 0 && <p className="mt-2 text-xs text-slate-400">Contrôle : {(c.controle ?? []).join(" ; ")}</p>}
                  </article>
                );
              })}
            </div>
            {sessionDecisions.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-heading text-base font-bold text-navy">Propositions, critiques et arbitrages</h3>
                {sessionDecisions.map((d) => (
                  <DecisionCard key={d.id} d={d} work={workOf(d.id)} />
                ))}
              </div>
            )}
            {selected.ceo_message && (
              <div className="flex items-start gap-3 rounded-2xl bg-gradient-to-br from-violet-50 to-white p-4 ring-1 ring-violet-200 sm:p-5">
                <Avatar who="CEO" />
                <div className="min-w-0">
                  <p className="font-heading font-bold text-navy">Le CEO conclut</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">{selected.ceo_message}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Journal */}
      <section data-testid="journal">
        <h2 className="mb-3 flex items-center gap-2 font-heading text-xl font-bold text-navy">
          <CalendarClock className="size-5 text-navy" aria-hidden /> Journal des décisions
        </h2>
        {journal.length ? (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            {journal.map((d) => (
              <li key={d.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
                <Avatar who={d.proposer} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-navy">{d.decision}</p>
                  <p className="text-xs text-slate-500">
                    {AUTHOR_LABEL[d.proposer] ?? d.proposer} · {formatDateTime(d.created_at)}
                    {d.founder_comment ? ` · votre commentaire : « ${d.founder_comment} »` : ""}
                  </p>
                  {workOf(d.id).slice(-1).map((w) => (
                    <p key={w.id} className="mt-1 text-xs text-teal-800">
                      Mise en œuvre : {String(w.content.texte ?? "").slice(0, 220)}
                    </p>
                  ))}
                </div>
                <StatusChip status={d.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-white p-5 text-sm text-slate-500 ring-1 ring-slate-200">Aucune décision pour l&apos;instant.</p>
        )}
      </section>
    </div>
  );
}
