import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { getSectorLabels } from "@/lib/queries/platform";
import { OpportunityOverview, type Overview, type SourceState } from "@/components/admin/opportunity-overview";

export const metadata = { title: "Synchronisations" };

const TONES: Record<string, BadgeTone> = { SUCCESS: "green", PARTIAL: "amber", FAILED: "red", RUNNING: "sky" };
const LABELS: Record<string, string> = { SUCCESS: "Réussie", PARTIAL: "Partielle", FAILED: "En échec", RUNNING: "En cours" };
const TRIGGERS: Record<string, string> = { cron: "Planifiée", manual: "Manuelle", test: "Test" };

export default async function SyncRunsPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data }, { data: cronRow }, { data: overview }, { data: sourceRows }, sectorLabels] = await Promise.all([
    supabase.from("source_sync_runs").select("*, source:external_sources(name)").order("started_at", { ascending: false }).limit(100),
    supabase.from("platform_settings").select("value").eq("key", "private.cron").maybeSingle(),
    supabase.rpc("admin_opportunity_overview"),
    supabase.from("external_sources").select("id, name, next_sync_at, last_error, source_sync_runs(status, finished_at, started_at)").eq("is_active", true).neq("connector", "manual")
      .order("started_at", { referencedTable: "source_sync_runs", ascending: false }).limit(1, { referencedTable: "source_sync_runs" }),
    getSectorLabels(),
  ]);
  const sources: SourceState[] = (sourceRows ?? []).map((s) => {
    const last = (s.source_sync_runs as { status: string; finished_at: string | null }[])[0];
    return { name: s.name, status: last?.status ?? null, finished_at: last?.finished_at ?? null, next_sync_at: s.next_sync_at, last_error: s.last_error };
  });
  const cron = cronRow?.value as { last_run_at?: string; failed_steps?: string[] } | undefined;
  return (
    <div>
      <h1 className="text-2xl font-bold">Synchronisations des sources</h1>
      <p className="mt-1 mb-6 text-slate-600">
        Journal de chaque collecte : annonces lues, créées, mises à jour, doublons rattachés, ignorées, et erreurs.{" "}
        <Link href="/admin/sources" className="font-semibold text-teal-700 underline">
          Gérer les sources
        </Link>
      </p>
      <p className="-mt-3 mb-6 text-sm text-slate-600">
        Tâche planifiée quotidienne (04:00 UTC, Vercel Cron) — collecte France entière :{" "}
        {cron?.last_run_at ? (
          <>
            dernière exécution le <strong>{formatDateTime(cron.last_run_at)}</strong>{" "}
            {cron.failed_steps?.length ? <Badge tone="red">Étapes en échec : {cron.failed_steps.join(", ")}</Badge> : <Badge tone="green">OK</Badge>}
          </>
        ) : (
          <Badge tone="amber">jamais exécutée sur cet environnement</Badge>
        )}
      </p>
      {overview && (
        <div className="mb-10">
          <OpportunityOverview o={overview as unknown as Overview} sources={sources} sectorLabel={(k) => sectorLabels[k] ?? k} />
        </div>
      )}
      <h2 className="mb-3 text-lg font-bold">Journal des synchronisations</h2>
      <DataTable
        rows={data ?? []}
        rowKey={(r) => r.id}
        caption="Synchronisations"
        empty={<EmptyState icon={<RefreshCw className="size-6" aria-hidden />} title="Aucune synchronisation" description="Lancez une collecte depuis la page Sources ou attendez la tâche planifiée quotidienne." />}
        columns={[
          {
            key: "source",
            header: "Source",
            primary: true,
            cell: (r) => (
              <span>
                <span className="font-semibold text-navy">{(Array.isArray(r.source) ? r.source[0] : r.source)?.name}</span>
                <span className="block text-xs text-slate-500">
                  {formatDateTime(r.started_at)} · {TRIGGERS[r.trigger] ?? r.trigger}
                </span>
              </span>
            ),
          },
          { key: "status", header: "Statut", cell: (r) => <Badge tone={TONES[r.status] ?? "slate"}>{LABELS[r.status] ?? r.status}</Badge> },
          {
            key: "counts",
            header: "Lues / créées / mises à jour / doublons / ignorées",
            cell: (r) => (
              <span className="tabular-nums">
                {r.fetched} / {r.created} / {r.updated} / {r.duplicates} / {r.skipped}
              </span>
            ),
          },
          {
            key: "errors",
            header: "Erreurs",
            hideOnMobile: true,
            cell: (r) => {
              const errs = (r.errors as string[]) ?? [];
              return errs.length ? (
                <details className="max-w-md text-xs">
                  <summary className="cursor-pointer text-red-700">{errs.length} erreur(s)</summary>
                  <ul className="mt-1 list-disc pl-4 text-slate-600">
                    {errs.slice(0, 10).map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </details>
              ) : (
                <span className="text-xs text-slate-500">—</span>
              );
            },
          },
        ]}
      />
    </div>
  );
}
