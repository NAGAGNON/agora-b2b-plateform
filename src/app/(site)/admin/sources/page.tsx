import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { DemoBadge } from "@/components/demo";
import { SourceEditButton } from "@/components/admin/source-edit";
import { SourceSyncControls } from "@/components/admin/source-sync";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime, relativeTime } from "@/lib/format";

export const metadata = { title: "Sources externes" };

export default async function SourcesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data }, { data: stats }] = await Promise.all([
    supabase.from("external_sources").select("*").order("created_at"),
    supabase.rpc("admin_source_stats"),
  ]);
  const statBy = new Map((stats ?? []).map((s) => [s.source_id, s]));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Sources externes</h1>
        <SourceEditButton />
      </div>
      <Notice tone="warning" title="Aucune intégration automatique sans validation">
        Une source n&apos;est collectée qu&apos;au statut « Approuvée », après confirmation de la validation de ses conditions de réutilisation. BOAMP
        (Licence Ouverte 2.0) et TED (réutilisation libre) sont approuvées sur la base de leurs licences publiées ; une validation juridique formelle reste
        recommandée avant le lancement public. Suspendre une source retire ses opportunités de la publication. Voir docs/SOURCES-EXTERNES.md.
      </Notice>
      <ul className="space-y-3">
        {(data ?? []).map((s) => (
          <li key={s.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-lg font-bold text-navy">
                  {s.name} <StatusBadge kind="source" status={s.status} /> {s.is_demo && <DemoBadge />}
                </p>
                {s.base_url && (
                  <a href={s.base_url} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-700 underline">
                    {s.base_url}
                  </a>
                )}
                {s.description && <p className="mt-1 text-sm text-slate-600">{s.description}</p>}
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="inline text-slate-500">Licence : </dt>
                    <dd className="inline">{s.license ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">Intégration : </dt>
                    <dd className="inline">{s.import_method}</dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">Validation juridique : </dt>
                    <dd className="inline">{s.legal_validated_at ? formatDate(s.legal_validated_at) : "non validée"}</dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">Opportunités : </dt>
                    <dd className="inline">
                      {statBy.get(s.id)?.published ?? 0} active(s) · {statBy.get(s.id)?.expired ?? 0} expirée(s) · {statBy.get(s.id)?.total ?? 0} au total
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">Dernière synchronisation : </dt>
                    <dd className="inline">{s.last_sync_at ? `${formatDateTime(s.last_sync_at)} (${relativeTime(s.last_sync_at)})` : "jamais"}</dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">Prochaine : </dt>
                    <dd className="inline">{s.is_active ? (s.next_sync_at ? formatDateTime(s.next_sync_at) : "à la prochaine tâche planifiée") : "collecte désactivée"}</dd>
                  </div>
                </dl>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="slate">Connecteur : {s.connector}</Badge>
                  <Badge tone={s.is_active ? "green" : "outline"}>{s.is_active ? "Collecte active" : "Collecte inactive"}</Badge>
                  <Badge tone="slate">Fréquence : {s.sync_frequency === "daily" ? "quotidienne" : s.sync_frequency === "weekly" ? "hebdomadaire" : "horaire"}</Badge>
                </div>
                {s.last_error && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">Dernière erreur : {s.last_error}</p>}
                {s.attribution && <p className="mt-2 text-xs text-slate-500">Mention affichée : {s.attribution}</p>}
                {s.terms_url && (
                  <Link href={s.terms_url} target="_blank" className="mt-1 inline-block text-xs text-teal-700 underline">
                    Conditions de réutilisation
                  </Link>
                )}
                {s.notes && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{s.notes}</p>}
                <div className="mt-4">
                  <SourceSyncControls id={s.id} name={s.name} approved={s.status === "APPROVED"} automated={s.connector !== "manual"} isActive={s.is_active} frequency={s.sync_frequency} config={s.config} />
                </div>
              </div>
              <SourceEditButton v={s} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
