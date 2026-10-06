import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { AdminFilter, adminInput } from "@/components/admin/admin-filter";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Journal d'audit" };
const PER = 50;

export default async function AuditPage(props: PageProps<"/admin/audit">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const action = typeof sp.action === "string" ? sp.action.replace(/[^a-z_.]/g, "").slice(0, 60) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  let q = supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, metadata, created_at, actor:users(email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PER, page * PER - 1);
  if (action) q = q.ilike("action", `${action}%`);
  const { data, count } = await q;
  return (
    <div>
      <h1 className="text-2xl font-bold">Journal d&apos;audit</h1>
      <p className="mt-1 mb-4 text-slate-600">Toutes les actions importantes (modération, administration, entreprises, réponses) sont journalisées. Lecture seule.</p>
      <AdminFilter action="/admin/audit">
        <input name="action" defaultValue={action} placeholder="ex. moderation, admin, company" className={adminInput} aria-label="Filtrer par action" />
      </AdminFilter>
      <DataTable
        rows={data ?? []}
        rowKey={(r) => String(r.id)}
        caption="Journal d'audit"
        empty={<EmptyState title="Journal vide" />}
        columns={[
          { key: "date", header: "Date", primary: true, cell: (r) => formatDateTime(r.created_at) },
          { key: "action", header: "Action", cell: (r) => <code className="text-xs">{r.action}</code> },
          { key: "actor", header: "Auteur", cell: (r) => (Array.isArray(r.actor) ? r.actor[0] : r.actor)?.email ?? "système" },
          { key: "entity", header: "Objet", cell: (r) => <span className="text-xs">{r.entity_type} {r.entity_id?.slice(0, 8)}</span> },
          { key: "meta", header: "Détails", hideOnMobile: true, cell: (r) => <code className="block max-w-xs truncate text-xs text-slate-500">{JSON.stringify(r.metadata)}</code> },
        ]}
      />
      <Pagination page={page} pageCount={Math.ceil((count ?? 0) / PER)} basePath="/admin/audit" params={sp} />
    </div>
  );
}
