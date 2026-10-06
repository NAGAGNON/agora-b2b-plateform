import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { DemoBadge } from "@/components/demo";
import { SourceEditButton } from "@/components/admin/source-edit";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Sources externes" };

export default async function SourcesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("external_sources").select("*, opportunity_sources(count)").order("created_at");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Sources externes</h1>
        <SourceEditButton />
      </div>
      <Notice tone="warning" title="Aucune intégration automatique sans validation">
        Une source ne peut être utilisée qu&apos;au statut « Approuvée », après confirmation explicite de la validation juridique et technique de ses
        conditions de réutilisation. Les sources BOAMP et TED sont enregistrées en « Validation juridique en cours » : aucune donnée n&apos;en est importée.
        Suspendre une source retire ses opportunités de la publication.
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
                    <dt className="inline text-slate-500">Opportunités référencées : </dt>
                    <dd className="inline">{(s.opportunity_sources as unknown as { count: number }[])[0]?.count ?? 0}</dd>
                  </div>
                </dl>
                {s.terms_url && (
                  <Link href={s.terms_url} target="_blank" className="mt-1 inline-block text-xs text-teal-700 underline">
                    Conditions de réutilisation
                  </Link>
                )}
                {s.notes && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{s.notes}</p>}
              </div>
              <SourceEditButton v={s} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
