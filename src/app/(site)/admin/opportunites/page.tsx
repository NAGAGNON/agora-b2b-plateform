import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { DemoBadge } from "@/components/demo";
import { AdminFilter, adminInput } from "@/components/admin/admin-filter";
import { DuplicateButton, ExternalVerifyButtons, ModerationButtons } from "@/components/admin/admin-actions";
import { OPPORTUNITY_STATUS_LABELS, OPPORTUNITY_TYPE_LABELS, VERIFICATION_STATUS_LABELS, type OpportunityStatus } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Opportunités" };
const PER = 25;

export default async function AdminOpportunities(props: PageProps<"/admin/opportunites">) {
  await requireStaff();
  const sp = await props.searchParams;
  const status = typeof sp.statut === "string" && sp.statut in OPPORTUNITY_STATUS_LABELS ? (sp.statut as OpportunityStatus) : undefined;
  const origin = sp.origine === "INTERNAL" || sp.origine === "EXTERNAL" ? sp.origine : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  let query = supabase
    .from("opportunities")
    .select("id, title, type, origin, status, created_at, published_at, response_deadline, is_demo, duplicate_of, company:companies(name), source:opportunity_sources(last_verified_at, verification_status, external_source:external_sources(name))", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PER, page * PER - 1);
  if (status) query = query.eq("status", status);
  if (origin) query = query.eq("origin", origin);
  if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "")}%`);
  const { data, count } = await query;
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Opportunités</h1>
        <ButtonLink href="/admin/opportunites/externe" size="sm">
          <PlusCircle className="size-4" aria-hidden /> Référencer une opportunité externe
        </ButtonLink>
      </div>
      <AdminFilter action="/admin/opportunites">
        <input name="q" defaultValue={q} placeholder="Titre…" className={adminInput} aria-label="Rechercher par titre" />
        <select name="statut" defaultValue={status ?? ""} className={adminInput} aria-label="Statut">
          <option value="">Tous statuts</option>
          {Object.entries(OPPORTUNITY_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="origine" defaultValue={origin ?? ""} className={adminInput} aria-label="Origine">
          <option value="">Internes et externes</option>
          <option value="INTERNAL">Internes</option>
          <option value="EXTERNAL">Externes</option>
        </select>
      </AdminFilter>
      <p className="mb-3 text-sm text-slate-600">{count ?? 0} résultat(s)</p>
      <DataTable
        rows={data ?? []}
        rowKey={(o) => o.id}
        caption="Opportunités"
        empty={<EmptyState title="Aucune opportunité" />}
        columns={[
          {
            key: "title",
            header: "Titre",
            primary: true,
            cell: (o) => {
              const src = one(o.source);
              return (
                <div className="min-w-56">
                  <Link href={`/opportunites/${o.id}`} className="font-semibold text-navy hover:text-teal-700">
                    {o.title}
                  </Link>{" "}
                  {o.is_demo && <DemoBadge />}
                  <p className="text-xs text-slate-500">
                    {o.origin === "EXTERNAL" ? `Externe · ${one(src?.external_source ?? null)?.name ?? "source"}` : one(o.company)?.name} · {OPPORTUNITY_TYPE_LABELS[o.type]}
                  </p>
                  {src && (
                    <p className="text-xs text-slate-500">
                      Vérifiée le {formatDate(src.last_verified_at)} — {VERIFICATION_STATUS_LABELS[src.verification_status] ?? src.verification_status}
                    </p>
                  )}
                  {o.duplicate_of && <Badge tone="slate">Doublon</Badge>}
                </div>
              );
            },
          },
          { key: "status", header: "Statut", cell: (o) => <StatusBadge kind="opportunity" status={o.status} /> },
          { key: "date", header: "Créée", cell: (o) => formatDate(o.created_at), hideOnMobile: true },
          {
            key: "actions",
            header: "Actions",
            cell: (o) => (
              <div className="flex flex-col items-start gap-2">
                <ModerationButtons
                  id={o.id}
                  actions={
                    o.status === "PENDING_REVIEW"
                      ? ["APPROVE", "REQUEST_CHANGES", "REJECT"]
                      : o.status === "SUSPENDED"
                        ? ["REINSTATE", "ARCHIVE"]
                        : o.status === "ARCHIVED"
                          ? []
                          : ["SUSPEND", "ARCHIVE"]
                  }
                />
                {o.status !== "ARCHIVED" && <DuplicateButton id={o.id} />}
                {o.origin === "EXTERNAL" && o.status !== "ARCHIVED" && <ExternalVerifyButtons id={o.id} />}
              </div>
            ),
          },
        ]}
      />
      <Pagination page={page} pageCount={Math.ceil((count ?? 0) / PER)} basePath="/admin/opportunites" params={sp} />
    </div>
  );
}
