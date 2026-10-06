import Link from "next/link";
import { Inbox, Lock } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { Notice } from "@/components/ui/notice";
import { PROPOSAL_STATUS_LABELS, type ProposalStatus } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Réponses" };

const TONES: Record<ProposalStatus, "slate" | "sky" | "amber" | "green" | "red" | "teal"> = {
  SUBMITTED: "sky",
  SHORTLISTED: "teal",
  INFO_REQUESTED: "amber",
  SELECTED: "green",
  DECLINED: "red",
  WITHDRAWN: "slate",
};

export default async function AdminProposalsPage(props: PageProps<"/admin/reponses">) {
  await requireStaff();
  const sp = await props.searchParams;
  const status = typeof sp.statut === "string" && sp.statut in PROPOSAL_STATUS_LABELS ? (sp.statut as ProposalStatus) : undefined;
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("admin_proposals_overview", { p_status: status, p_limit: 300 });
  const counts = new Map<string, number>();
  for (const r of rows ?? []) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Réponses aux opportunités</h1>
      <Notice tone="info">
        <span className="inline-flex items-start gap-2">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          Le contenu des réponses (message, prix, documents) est confidentiel entre le demandeur et le fournisseur : l&apos;administration ne voit que
          les métadonnées nécessaires au suivi et à la modération.
        </span>
      </Notice>
      <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/reponses" aria-current={!status ? "page" : undefined} className={`rounded-full border px-3 py-1 ${!status ? "border-navy bg-navy text-white" : "border-slate-200 bg-white"}`}>
          Toutes
        </Link>
        {(Object.keys(PROPOSAL_STATUS_LABELS) as ProposalStatus[]).map((s) => (
          <Link
            key={s}
            href={`/admin/reponses?statut=${s}`}
            aria-current={status === s ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${status === s ? "border-navy bg-navy text-white" : "border-slate-200 bg-white"}`}
          >
            {PROPOSAL_STATUS_LABELS[s]}
            {!status && counts.get(s) ? ` (${counts.get(s)})` : ""}
          </Link>
        ))}
      </nav>
      {error ? (
        <Notice tone="error">Impossible de charger les réponses.</Notice>
      ) : !rows?.length ? (
        <EmptyState icon={<Inbox className="size-6" aria-hidden />} title="Aucune réponse" description={status ? "Aucune réponse avec ce statut." : "Aucune réponse n'a encore été déposée."} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-2">Opportunité</th>
                <th scope="col" className="px-5 py-2">Demandeur</th>
                <th scope="col" className="px-5 py-2">Fournisseur</th>
                <th scope="col" className="px-5 py-2">Statut</th>
                <th scope="col" className="px-5 py-2">Documents</th>
                <th scope="col" className="px-5 py-2">Déposée</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-3">
                    <Link href={`/opportunites/${r.opportunity_id}`} className="font-semibold text-navy hover:underline">
                      {r.opportunity_title}
                    </Link>
                    {r.is_demo && <Badge tone="violet" className="ml-2">Démo</Badge>}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{r.buyer_name ?? "—"}</td>
                  <td className="px-5 py-3">
                    <Link href={`/entreprises/${r.supplier_slug}`} className="hover:underline">
                      {r.supplier_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={TONES[r.status]}>{PROPOSAL_STATUS_LABELS[r.status]}</Badge>
                  </td>
                  <td className="px-5 py-3">{r.documents}</td>
                  <td className="px-5 py-3 text-slate-500">{formatDateTime(r.submitted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
