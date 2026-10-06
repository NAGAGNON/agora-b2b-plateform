import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";
import { DemoBadge } from "@/components/demo";
import { AdminFilter, adminInput } from "@/components/admin/admin-filter";
import { RoleSelect, StatusWithReason } from "@/components/admin/admin-actions";
import { PLATFORM_ROLE_LABELS, type PlatformRole } from "@/lib/constants";
import { formatDate, relativeTime } from "@/lib/format";

export const metadata = { title: "Utilisateurs" };
const PER = 25;

export default async function AdminUsers(props: PageProps<"/admin/utilisateurs">) {
  const session = await requireAdmin();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().replace(/[%_,()]/g, "").slice(0, 100) : "";
  const role = typeof sp.role === "string" && sp.role in PLATFORM_ROLE_LABELS ? (sp.role as PlatformRole) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  let query = supabase
    .from("users")
    .select("id, email, full_name, platform_role, status, created_at, last_seen_at, is_demo, company_members(company:companies(name))", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PER, page * PER - 1);
  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  if (role) query = query.eq("platform_role", role);
  const { data, count } = await query;
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Utilisateurs</h1>
      <AdminFilter action="/admin/utilisateurs">
        <input name="q" defaultValue={q} placeholder="Nom ou e-mail" className={adminInput} aria-label="Rechercher" />
        <select name="role" defaultValue={role ?? ""} className={adminInput} aria-label="Rôle">
          <option value="">Tous les rôles</option>
          {Object.entries(PLATFORM_ROLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </AdminFilter>
      <p className="mb-3 text-sm text-slate-600">{count ?? 0} utilisateur(s)</p>
      <DataTable
        rows={data ?? []}
        rowKey={(u) => u.id}
        caption="Utilisateurs"
        empty={<EmptyState title="Aucun utilisateur" />}
        columns={[
          {
            key: "name",
            header: "Utilisateur",
            primary: true,
            cell: (u) => (
              <div>
                <p className="font-semibold text-navy">
                  {u.full_name || "—"} {u.is_demo && <DemoBadge />}
                </p>
                <p className="text-xs text-slate-500">{u.email}</p>
                <p className="text-xs text-slate-500">
                  {(u.company_members as unknown as { company: { name: string } | null }[]).map((m) => m.company?.name).filter(Boolean).join(", ")}
                </p>
              </div>
            ),
          },
          { key: "role", header: "Rôle", cell: (u) => <RoleSelect id={u.id} role={u.platform_role} canEdit={u.id !== session.userId} /> },
          { key: "status", header: "Statut", cell: (u) => <StatusBadge kind="account" status={u.status} /> },
          { key: "dates", header: "Inscription / activité", hideOnMobile: true, cell: (u) => <span className="text-xs">{formatDate(u.created_at)}<br />{u.last_seen_at ? relativeTime(u.last_seen_at) : "—"}</span> },
          { key: "actions", header: "Actions", cell: (u) => (u.id !== session.userId ? <StatusWithReason kind="user" id={u.id} current={u.status} /> : <span className="text-xs text-slate-500">Vous</span>) },
        ]}
      />
      <Pagination page={page} pageCount={Math.ceil((count ?? 0) / PER)} basePath="/admin/utilisateurs" params={sp} />
    </div>
  );
}
