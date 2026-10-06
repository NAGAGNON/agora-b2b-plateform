import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { DemoBadge } from "@/components/demo";
import { ModerationButtons } from "@/components/admin/admin-actions";
import { OPPORTUNITY_TYPE_LABELS, SECTOR_LABELS } from "@/lib/constants";
import { formatBudget, formatDate, formatDateTime } from "@/lib/format";

export const metadata = { title: "Modération" };

export default async function ModerationPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase
    .from("opportunities")
    .select("*, company:companies(name, slug, verified_at, created_at, status), documents:opportunity_documents(id, file_name)")
    .eq("status", "PENDING_REVIEW")
    .order("updated_at", { ascending: true });
  return (
    <div>
      <h1 className="text-2xl font-bold">Modération</h1>
      <p className="mt-1 mb-6 text-slate-600">Publications en attente (statut PENDING_REVIEW), de la plus ancienne à la plus récente.</p>
      {!data?.length ? (
        <EmptyState icon={<ClipboardCheck className="size-6" aria-hidden />} title="Rien à modérer" description="Toutes les publications ont été traitées." />
      ) : (
        <ul className="space-y-4">
          {data.map((o) => {
            const c = Array.isArray(o.company) ? o.company[0] : o.company;
            return (
              <li key={o.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="sky">{OPPORTUNITY_TYPE_LABELS[o.type]}</Badge>
                  {o.sector_slug && <Badge tone="slate">{SECTOR_LABELS[o.sector_slug]}</Badge>}
                  {o.visibility === "MEMBERS_ONLY" && <Badge tone="slate">Membres uniquement</Badge>}
                  {o.is_demo && <DemoBadge />}
                  <span className="text-xs text-slate-500">Soumise le {formatDateTime(o.updated_at)}</span>
                </div>
                <h2 className="mt-2 text-lg font-bold">
                  <Link href={`/opportunites/${o.id}`} className="hover:text-teal-700">
                    {o.title}
                  </Link>
                </h2>
                <p className="text-sm text-slate-600">
                  {c?.name} · {c?.verified_at ? "entreprise vérifiée" : "entreprise non vérifiée"} · inscrite le {formatDate(c?.created_at)}
                </p>
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer font-semibold text-teal-700">Contenu complet</summary>
                  <div className="mt-2 space-y-2 text-slate-700">
                    {o.summary && <p className="font-medium">{o.summary}</p>}
                    <p className="whitespace-pre-line">{o.description}</p>
                    <p>
                      Lieu : {o.city ?? "—"} ({o.department_code ?? "—"}) · Budget : {formatBudget(o.budget_min, o.budget_max) ?? "—"} · Date limite :{" "}
                      {formatDate(o.response_deadline)}
                    </p>
                    {o.criteria && <p>Critères : {o.criteria}</p>}
                    <p>Documents : {o.documents.length ? o.documents.map((d) => d.file_name).join(", ") : "aucun"}</p>
                    <p>Attestation de l&apos;auteur : {o.publisher_attested_at ? `oui (${formatDateTime(o.publisher_attested_at)})` : "non"}</p>
                  </div>
                </details>
                <div className="mt-4">
                  <ModerationButtons id={o.id} actions={["APPROVE", "REQUEST_CHANGES", "REJECT"]} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
