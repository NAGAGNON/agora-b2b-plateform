import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { PageHead, Panel, fmtN } from "@/components/outreach/ui";
import { RemoveSuppression, SuppressionForm } from "@/components/outreach/prospect-forms";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/states";

export const metadata = { title: "Ne plus contacter" };
const PER_PAGE = 100;
const REASONS: Record<string, string> = { UNSUBSCRIBE: "Désinscription", MANUAL: "Exclusion manuelle", BOUNCE: "Adresse invalide", COMPLAINT: "Signalement spam", CUSTOMER: "Déjà client" };
const KINDS: Record<string, string> = { EMAIL: "E-mail", DOMAIN: "Domaine", SIREN: "SIREN" };

export default async function SuppressionsPage(props: PageProps<"/outreach/exclusions">) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  const { data, count } = await supabase
    .from("outreach_suppressions")
    .select("id, kind, value, reason, note, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  return (
    <>
      <PageHead
        title="Ne plus contacter"
        description="Liste globale d'exclusion : aucune adresse, aucun domaine et aucun SIREN de cette liste ne reçoit jamais de sélection. Les désinscriptions y sont ajoutées automatiquement et ne peuvent pas être retirées. Les entreprises déjà inscrites sur LinkProB2B sont aussi exclues d'office."
      />
      <Panel title="Ajouter une exclusion" className="mb-6">
        <SuppressionForm />
      </Panel>
      <Panel title={`${fmtN(count ?? 0)} exclusion(s)`}>
        {!data?.length ? (
          <EmptyState title="Liste vide" />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-left text-xs text-slate-500 uppercase">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Valeur</th>
                  <th className="py-2 pr-3 font-semibold">Motif</th>
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 pr-3">
                      <Badge tone="slate">{KINDS[s.kind]}</Badge> <span className="ml-1 font-medium text-navy">{s.value}</span>
                      {s.note && <p className="text-xs text-slate-500">{s.note}</p>}
                    </td>
                    <td className="py-2.5 pr-3">{REASONS[s.reason] ?? s.reason}</td>
                    <td className="py-2.5 pr-3 text-xs text-slate-500">{formatDateTime(s.created_at)}</td>
                    <td className="py-2.5 text-right">{s.reason !== "UNSUBSCRIBE" && <RemoveSuppression id={s.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageCount={Math.ceil((count ?? 0) / PER_PAGE)} basePath="/outreach/exclusions" params={sp} />
      </Panel>
    </>
  );
}
