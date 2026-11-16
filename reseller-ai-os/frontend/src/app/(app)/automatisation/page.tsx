"use client";
import { useMemo, useState } from "react";
import { Play } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { dateTimeFr } from "@/lib/format";
import { Badge, Button, Card, CardHeader, ErrorBox, Input, PageHeader, Select, Spinner, TableWrap, tdCls, thCls, useAction } from "@/components/ui";

type Job = { key: string; agent_key: string; label: string; enabled: boolean; schedule_type: "daily" | "interval"; hour: number; minute: number; days: string; interval_minutes: number | null; last_run_at: string | null; last_status: string | null };
type Cal = { upcoming: { job: string; label: string; agent: string; at: string }[]; past: { id: number; agent: string; title: string; status: string; at: string; trigger: string; error: string | null }[] };
const DAYS: [string, string][] = [["mon", "L"], ["tue", "M"], ["wed", "M"], ["thu", "J"], ["fri", "V"], ["sat", "S"], ["sun", "D"]];

export default function Page() {
  const jobs = useApi<Job[]>("/automation/jobs");
  const [horizon, setHorizon] = useState(7);
  const cal = useApi<Cal>(`/automation/calendar?days=${horizon}`);
  const { busy, run } = useAction();
  const byDay = useMemo(() => {
    const m = new Map<string, Cal["upcoming"]>();
    cal.data?.upcoming.forEach((u) => { const d = u.at.slice(0, 10); m.set(d, [...(m.get(d) ?? []), u]); });
    return [...m.entries()];
  }, [cal.data]);
  const patch = (key: string, body: Record<string, unknown>) => run(`p${key}`, async () => { await api(`/automation/jobs/${key}`, { method: "PUT", body }); jobs.reload(); cal.reload(); }, "Planification mise à jour");
  if (jobs.error) return <ErrorBox onRetry={jobs.reload}>{jobs.error}</ErrorBox>;
  if (!jobs.data) return <Spinner />;
  return (
    <div className="space-y-5">
      <PageHeader title="Automatisation" sub="Tâches planifiées dans le fuseau Europe/Paris. Les achats ne sont jamais payés automatiquement : les paniers préparés attendent votre validation." />
      <Card>
        <CardHeader title="Fréquence des tâches" sub="Modifiable par tâche — appliqué immédiatement" />
        <TableWrap><thead><tr className="border-b border-line">{["Tâche", "Actif", "Fréquence", "Dernière exécution", ""].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody>{jobs.data.map((j) => (
            <tr key={j.key} className="border-b border-line last:border-0">
              <td className={tdCls}><div className="font-medium">{j.label}</div><div className="text-xs text-muted">{j.agent_key}</div></td>
              <td className={tdCls}><input type="checkbox" aria-label={`Activer ${j.label}`} checked={j.enabled} onChange={(e) => patch(j.key, { enabled: e.target.checked })} /></td>
              <td className={tdCls}>
                <div className="flex flex-wrap items-center gap-2">
                  <Select className="!w-28 !py-1" value={j.schedule_type} onChange={(e) => patch(j.key, { schedule_type: e.target.value, ...(e.target.value === "interval" && !j.interval_minutes ? { interval_minutes: 60 } : {}) })} aria-label="Type"><option value="daily">Chaque jour</option><option value="interval">Intervalle</option></Select>
                  {j.schedule_type === "daily" ? <>
                    <Input type="time" className="!w-28 !py-1" defaultValue={`${String(j.hour).padStart(2, "0")}:${String(j.minute).padStart(2, "0")}`} onBlur={(e) => { const [h, m] = e.target.value.split(":").map(Number); if (!Number.isNaN(h)) patch(j.key, { hour: h, minute: m }); }} aria-label="Heure" />
                    <span className="flex gap-0.5">{DAYS.map(([d, l], i) => { const on = j.days.split(",").includes(d); return <button key={d + i} aria-pressed={on} aria-label={d} onClick={() => { const set = new Set(j.days.split(",")); on ? set.delete(d) : set.add(d); if (set.size) patch(j.key, { days: DAYS.map(([x]) => x).filter((x) => set.has(x)).join(",") }); }} className={`size-6 rounded text-xs ${on ? "bg-accent text-accentfg" : "bg-surface2 text-muted"}`}>{l}</button>; })}</span></>
                    : <span className="flex items-center gap-1 text-xs">toutes les <Input type="number" min={5} className="!w-20 !py-1" defaultValue={j.interval_minutes ?? 60} onBlur={(e) => patch(j.key, { interval_minutes: Number(e.target.value) })} aria-label="Minutes" /> min</span>}
                </div></td>
              <td className={tdCls}><div className="text-xs">{dateTimeFr(j.last_run_at)}</div><div className={`text-xs ${j.last_status?.startsWith("Erreur") ? "text-danger" : "text-muted"}`}>{j.last_status}</div></td>
              <td className={tdCls}><Button size="sm" variant="secondary" loading={busy === j.key} onClick={() => run(j.key, async () => { await api(`/automation/jobs/${j.key}/run`, { body: {} }); jobs.reload(); cal.reload(); }, "Tâche exécutée")}><Play className="size-3.5" />Lancer</Button></td>
            </tr>))}</tbody></TableWrap>
      </Card>
      <Card>
        <CardHeader title="Calendrier" sub="Prochaines exécutions et dernières tâches" action={<Select className="!w-32 !py-1" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} aria-label="Horizon">{[3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} jours</option>)}</Select>} />
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <div><div className="mb-2 text-xs font-medium text-muted">À venir</div>
            {byDay.length === 0 ? <p className="text-sm text-muted">Aucune exécution planifiée.</p> : <div className="max-h-96 space-y-3 overflow-y-auto">{byDay.map(([d, items]) => (
              <div key={d}><div className="text-sm font-semibold capitalize">{new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</div>
                <ul className="mt-1 space-y-1">{items.map((u, i) => <li key={i} className="flex gap-2 text-sm"><span className="w-12 shrink-0 tabular-nums text-muted">{new Date(u.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>{u.label}</li>)}</ul></div>))}</div>}</div>
          <div><div className="mb-2 text-xs font-medium text-muted">Dernières exécutions</div>
            {cal.data?.past.length === 0 ? <p className="text-sm text-muted">Aucune exécution.</p> : <ul className="max-h-96 divide-y divide-line overflow-y-auto text-sm">{cal.data?.past.map((p) => <li key={p.id} className="flex items-center justify-between gap-2 py-1.5"><span>{p.title}<span className="block text-xs text-muted">{dateTimeFr(p.at)} · {p.trigger}{p.error && <span className="text-danger"> · {p.error}</span>}</span></span><Badge tone={p.status === "done" ? "green" : "red"}>{p.status === "done" ? "OK" : "Erreur"}</Badge></li>)}</ul>}</div>
        </div>
      </Card>
    </div>
  );
}
