import { DashboardCard } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

type Row = { key: string; n: number };
export type Overview = {
  total: number; active: number; expired: number; external: number; internal: number; new_24h: number; new_7d: number;
  updated_7d: number; duplicates_7d: number; errors_7d: number; without_location: number; next_sync_at: string | null;
  by_region: Row[]; by_department: Row[]; by_sector: Row[]; by_source: Row[];
};
export type SourceState = { name: string; status: string | null; finished_at: string | null; next_sync_at: string | null; last_error: string | null };

const STATE: Record<string, string> = { SUCCESS: "🟢 Synchronisation réussie", PARTIAL: "🟠 Synchronisation partielle", FAILED: "🔴 Synchronisation en erreur", RUNNING: "⏳ En cours" };

function Bars({ title, rows, label = (k: string) => k }: { title: string; rows: Row[]; label?: (k: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-navy">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune donnée.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {rows.slice(0, 18).map((r) => (
            <li key={r.key} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_3rem] items-center gap-2">
              <span className="truncate text-slate-700" title={label(r.key)}>
                {label(r.key)}
              </span>
              <span className="h-2 rounded-full bg-teal" style={{ width: `${Math.max(2, (r.n / max) * 100)}%` }} aria-hidden />
              <span className="text-right font-semibold text-navy tabular-nums">{r.n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Vue d'ensemble nationale des opportunités et de l'état des synchronisations. */
export function OpportunityOverview({ o, sources, sectorLabel }: { o: Overview; sources: SourceState[]; sectorLabel: (k: string) => string }) {
  return (
    <section className="space-y-6" aria-labelledby="overview">
      <h2 id="overview" className="text-lg font-bold">
        Base nationale d&apos;opportunités
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DashboardCard label="Opportunités (total)" value={o.total} />
        <DashboardCard label="Actives" value={o.active} />
        <DashboardCard label="Expirées" value={o.expired} />
        <DashboardCard label="Nouvelles (24 h)" value={o.new_24h} hint={`${o.new_7d} sur 7 jours`} />
        <DashboardCard label="Mises à jour (7 j)" value={o.updated_7d} />
        <DashboardCard label="Doublons détectés (7 j)" value={o.duplicates_7d} hint="Rattachés à l'annonce existante" />
        <DashboardCard label="Synchronisations en erreur (7 j)" value={o.errors_7d} />
        <DashboardCard label="Prochaine synchronisation" value={o.next_sync_at ? formatDateTime(o.next_sync_at) : "—"} hint="Tâche planifiée quotidienne" />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-navy">État des sources</h3>
        <ul className="divide-y divide-slate-100 text-sm">
          {sources.map((s) => (
            <li key={s.name} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-semibold text-navy">{s.name}</span>
              <span className="text-slate-600">
                {s.status ? STATE[s.status] ?? s.status : "⚪ Jamais synchronisée"}
                {s.finished_at && ` · ${formatDateTime(s.finished_at)}`}
                {s.next_sync_at && ` · prochaine : ${formatDateTime(s.next_sync_at)}`}
              </span>
              {s.last_error && <span className="text-xs text-red-700 sm:basis-full">{s.last_error}</span>}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Bars title="Opportunités actives par région" rows={o.by_region} />
        <Bars title="Par source" rows={o.by_source} />
        <Bars title="Par département (25 premiers)" rows={o.by_department} />
        <Bars title="Par secteur" rows={o.by_sector} label={sectorLabel} />
      </div>
      {o.without_location > 0 && <p className="text-xs text-slate-500">{o.without_location} opportunité(s) active(s) sans localisation régionale connue (marchés nationaux ou lieu non précisé par la source).</p>}
    </section>
  );
}
