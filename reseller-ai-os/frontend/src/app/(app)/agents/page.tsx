"use client";
import { useState } from "react";
import { Bot, ChevronDown, Play, RotateCcw } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { ago, dateTimeFr, eur } from "@/lib/format";
import { AGENT_STATUS } from "@/lib/labels";
import { Badge, Button, Card, CardHeader, ErrorBox, Field, Input, PageHeader, Spinner, StatCard, cn, useAction } from "@/components/ui";

type Job = { key: string; label: string; enabled: boolean; last_run_at: string | null; last_status: string | null };
type Agent = { key: string; name: string; mission: string; objectives: string[]; status: string; enabled: boolean; uses_ai: boolean; ai_budget_daily: number; ai_budget_monthly: number; ai_spent_today: number; ai_spent_month: number; last_run_at: string | null; last_error: string | null;
  tasks_done: number; tasks_error: number; jobs: Job[]; tasks: { id: number; title: string; status: string; trigger: string; created_at: string; error: string | null; result: Record<string, unknown> | null }[] };
type Data = { agents: Agent[]; messages: { id: number; from_agent: string; to_agent: string; subject: string; status: string; error: string | null; created_at: string }[];
  ai: { budget: { daily_limit: number; daily_spent: number; monthly_limit: number; monthly_spent: number }; by_agent: { agent: string; cost_eur: number; tokens: number; calls: number }[]; cache_hits_month: number } };
const tone = (s: string) => (s === "error" ? "red" : s === "running" ? "blue" : s === "disabled" ? "neutral" : "green") as "red" | "blue" | "neutral" | "green";

export default function Page() {
  const { data, error, loading, reload } = useApi<Data>("/agents");
  const [open, setOpen] = useState<string | null>(null);
  const { busy, run } = useAction();
  if (error) return <ErrorBox onRetry={reload}>{error}</ErrorBox>;
  if (loading && !data) return <Spinner />;
  if (!data) return null;
  const b = data.ai.budget;
  const name = (k: string) => data.agents.find((a) => a.key === k)?.name ?? k;
  return (
    <div className="space-y-5">
      <PageHeader title="Agents" sub="L'AI Operations Manager coordonne les agents, détecte les erreurs et relance les passations échouées. Seuls les agents marqués « IA » consomment des tokens ; calculs, stocks et statistiques n'en consomment jamais." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Budget IA du jour" value={`${b.daily_spent.toFixed(2)} / ${b.daily_limit ? b.daily_limit.toFixed(2) : "∞"} €`} /><StatCard label="Budget IA du mois" value={`${b.monthly_spent.toFixed(2)} / ${b.monthly_limit ? b.monthly_limit.toFixed(2) : "∞"} €`} />
        <StatCard label="Réponses servies par le cache" value={data.ai.cache_hits_month} sub="ce mois-ci, sans coût" /><StatCard label="Agents en erreur" value={data.agents.filter((a) => a.status === "error").length} tone={data.agents.some((a) => a.status === "error") ? "bad" : undefined} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {data.agents.map((a) => (
          <Card key={a.key} className={cn(a.status === "error" && "border-danger/50")}>
            <button className="flex w-full items-start gap-3 p-4 text-left" onClick={() => setOpen(open === a.key ? null : a.key)} aria-expanded={open === a.key}>
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accentsoft text-accent"><Bot className="size-5" /></span>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{a.name}</span><Badge tone={tone(a.status)}>{AGENT_STATUS[a.status]}</Badge>{a.uses_ai && <Badge tone="blue">IA</Badge>}</div>
                <p className="mt-0.5 text-sm text-muted">{a.mission}</p><p className="mt-1 text-xs text-muted">{a.tasks_done} tâche(s) réussie(s) · {a.tasks_error} en erreur · dernière activité {a.last_run_at ? ago(a.last_run_at) : "jamais"}</p></div>
              <ChevronDown className={cn("mt-1 size-4 text-muted transition", open === a.key && "rotate-180")} />
            </button>
            {open === a.key && (
              <div className="anim-in space-y-4 border-t border-line p-4 text-sm">
                {a.last_error && <ErrorBox onRetry={() => run("rs", async () => { await api(`/agents/${a.key}/reset`, { body: {} }); reload(); }, "Agent réinitialisé")}>{a.last_error}</ErrorBox>}
                <div><div className="mb-1 text-xs font-medium text-muted">Objectifs</div><ul className="list-disc pl-5">{a.objectives.map((o) => <li key={o}>{o}</li>)}</ul></div>
                {a.uses_ai && <div className="grid gap-2 sm:grid-cols-2">
                  <Field label={`Budget IA / jour (€) — dépensé ${eur(a.ai_spent_today)}`}><Input type="number" min={0} step="0.1" defaultValue={a.ai_budget_daily} onBlur={(e) => run("b", async () => { await api(`/agents/${a.key}`, { method: "PUT", body: { ai_budget_daily: Number(e.target.value) } }); reload(); }, "Budget mis à jour")} /></Field>
                  <Field label={`Budget IA / mois (€) — dépensé ${eur(a.ai_spent_month)}`}><Input type="number" min={0} step="0.5" defaultValue={a.ai_budget_monthly} onBlur={(e) => run("b", async () => { await api(`/agents/${a.key}`, { method: "PUT", body: { ai_budget_monthly: Number(e.target.value) } }); reload(); }, "Budget mis à jour")} /></Field></div>}
                <label className="flex items-center gap-2"><input type="checkbox" checked={a.enabled} onChange={(e) => run("en", async () => { await api(`/agents/${a.key}`, { method: "PUT", body: { enabled: e.target.checked } }); reload(); })} />Agent activé</label>
                {a.jobs.length > 0 && <div><div className="mb-1 text-xs font-medium text-muted">Tâches planifiées</div>
                  {a.jobs.map((j) => <div key={j.key} className="flex items-center justify-between gap-2 py-1"><span>{j.label}<span className="block text-xs text-muted">{j.last_status ? `${j.last_status} · ${dateTimeFr(j.last_run_at)}` : "jamais exécutée"}</span></span>
                    <Button size="sm" variant="secondary" loading={busy === j.key} onClick={() => run(j.key, async () => { await api(`/automation/jobs/${j.key}/run`, { body: {} }); reload(); }, "Tâche exécutée")}><Play className="size-3.5" />Lancer</Button></div>)}</div>}
                <div><div className="mb-1 text-xs font-medium text-muted">Historique</div>
                  {a.tasks.length === 0 ? <p className="text-muted">Aucune tâche.</p> : <ul className="divide-y divide-line">{a.tasks.map((t) => <li key={t.id} className="py-1.5"><div className="flex justify-between gap-2"><span>{t.title}</span><Badge tone={t.status === "error" ? "red" : "green"}>{t.status === "done" ? "OK" : t.status === "error" ? "Erreur" : t.status}</Badge></div>
                    <div className="text-xs text-muted">{dateTimeFr(t.created_at)} · {t.trigger}{t.result && ` · ${JSON.stringify(t.result).slice(0, 120)}`}{t.error && <span className="text-danger"> · {t.error}</span>}</div></li>)}</ul>}</div>
              </div>
            )}
          </Card>))}
      </div>
      <Card>
        <CardHeader title="Passations entre agents" sub="Dédoublonnées : un même fait n'est traité qu'une fois" action={<Button size="sm" variant="secondary" loading={busy === "ops"} onClick={() => run("ops", async () => { await api("/automation/jobs/ops_check/run", { body: {} }); reload(); }, "Supervision exécutée")}><RotateCcw className="size-3.5" />Superviser</Button>} />
        {data.messages.length === 0 ? <p className="p-4 text-sm text-muted">Aucun message pour l'instant.</p> : <ul className="max-h-80 divide-y divide-line overflow-y-auto text-sm">{data.messages.map((m) => <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2"><span>{name(m.from_agent)} → {name(m.to_agent)} · <span className="text-muted">{m.subject}</span>{m.error && <span className="text-danger"> · {m.error}</span>}</span><span className="flex shrink-0 items-center gap-2"><Badge tone={m.status === "handled" ? "green" : m.status === "error" ? "red" : "amber"}>{m.status === "handled" ? "traité" : m.status === "error" ? "erreur" : "en attente"}</Badge><span className="text-xs text-muted">{ago(m.created_at)}</span></span></li>)}</ul>}
      </Card>
      <Card><CardHeader title="Consommation IA par agent (ce mois)" />
        {data.ai.by_agent.length === 0 ? <p className="p-4 text-sm text-muted">Aucun appel IA ce mois-ci.</p> : <ul className="divide-y divide-line text-sm">{data.ai.by_agent.map((r) => <li key={r.agent} className="flex justify-between px-4 py-2"><span>{name(r.agent)}</span><span className="tabular-nums text-muted">{r.calls} appel(s) · {r.tokens.toLocaleString("fr-FR")} tokens · {r.cost_eur.toFixed(3)} €</span></li>)}</ul>}</Card>
    </div>
  );
}
