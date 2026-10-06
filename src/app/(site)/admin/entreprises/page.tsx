import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";
import { DemoBadge } from "@/components/demo";
import { AdminFilter, adminInput } from "@/components/admin/admin-filter";
import { StatusWithReason, VerifyCompanyButton } from "@/components/admin/admin-actions";
import { COMPANY_KIND_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Entreprises" };
const PER = 25;

export default async function AdminCompanies(props: PageProps<"/admin/entreprises">) {
  const session = await requireStaff();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().replace(/[%_,()]/g, "").slice(0, 100) : "";
  const status = sp.statut === "ACTIVE" || sp.statut === "SUSPENDED" || sp.statut === "PENDING" ? sp.statut : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  let query = supabase
    .from("companies")
    .select("id, slug, name, siren, kind, city, department_code, status, verified_at, verification_note, created_at, is_demo, company_members(count), opportunities(count)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PER, page * PER - 1);
  if (q) query = query.or(`name.ilike.%${q}%,siren.ilike.%${q}%`);
  if (status) query = query.eq("status", status);
  const { data, count } = await query;
  const n = (v: unknown) => (v as { count: number }[])[0]?.count ?? 0;
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Entreprises</h1>
      <AdminFilter action="/admin/entreprises">
        <input name="q" defaultValue={q} placeholder="Nom ou SIREN" className={adminInput} aria-label="Rechercher" />
        <select name="statut" defaultValue={status ?? ""} className={adminInput} aria-label="Statut">
          <option value="">Tous statuts</option>
          <option value="ACTIVE">Actives</option>
          <option value="SUSPENDED">Suspendues</option>
        </select>
      </AdminFilter>
      <p className="mb-3 text-sm text-slate-600">{count ?? 0} entreprise(s)</p>
      <DataTable
        rows={data ?? []}
        rowKey={(c) => c.id}
        caption="Entreprises"
        empty={<EmptyState title="Aucune entreprise" />}
        columns={[
          {
            key: "name",
            header: "Entreprise",
            primary: true,
            cell: (c) => (
              <div>
                <Link href={`/entreprises/${c.slug}`} className="inline-flex items-center gap-1 font-semibold text-navy hover:text-teal-700">
                  {c.name} {c.verified_at && <BadgeCheck className="size-4 text-teal-600" aria-label="Vérifiée" />}
                </Link>{" "}
                {c.is_demo && <DemoBadge />}
                <p className="text-xs text-slate-500">
                  {COMPANY_KIND_LABELS[c.kind]} · {c.city ?? "—"} {c.department_code && `(${c.department_code})`} · SIREN {c.siren ?? "non renseigné"}
                </p>
                {c.verification_note && <p className="text-xs text-teal-700">Vérification : {c.verification_note}</p>}
              </div>
            ),
          },
          { key: "status", header: "Statut", cell: (c) => <StatusBadge kind="account" status={c.status} /> },
          { key: "counts", header: "Membres / publications", hideOnMobile: true, cell: (c) => `${n(c.company_members)} / ${n(c.opportunities)}` },
          { key: "date", header: "Créée", hideOnMobile: true, cell: (c) => formatDate(c.created_at) },
          {
            key: "actions",
            header: "Actions",
            cell: (c) => (
              <div className="flex flex-wrap gap-2">
                <StatusWithReason kind="company" id={c.id} current={c.status} />
                {session.isAdmin && <VerifyCompanyButton id={c.id} verified={Boolean(c.verified_at)} />}
              </div>
            ),
          },
        ]}
      />
      <Pagination page={page} pageCount={Math.ceil((count ?? 0) / PER)} basePath="/admin/entreprises" params={sp} />
    </div>
  );
}
