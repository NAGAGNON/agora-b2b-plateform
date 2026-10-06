import Link from "next/link";
import { FileStack, PlusCircle, Send } from "lucide-react";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LinkTabs } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { DemoBadge } from "@/components/demo";
import { OPPORTUNITY_TYPE_LABELS } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";

export const metadata = { title: "Mes opportunités" };

export default async function MyOpportunitiesPage(props: PageProps<"/dashboard/opportunites">) {
  const session = await requireCompany("/dashboard/opportunites");
  const sp = await props.searchParams;
  const cid = session.activeCompany.company.id;
  const tab = sp.onglet === "reponses" ? "reponses" : "publications";
  const supabase = await createClient();

  const [{ data: opps }, { data: interests }, { data: proposals }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, title, type, status, response_deadline, published_at, updated_at, is_demo, interests(count), proposals!proposals_opportunity_id_fkey(count)")
      .eq("company_id", cid)
      .order("updated_at", { ascending: false }),
    supabase
      .from("interests")
      .select("id, status, created_at, opportunity:opportunities(id, title, status, response_deadline, is_demo, company:companies(name))")
      .eq("company_id", cid)
      .order("created_at", { ascending: false }),
    supabase
      .from("proposals")
      .select("id, status, price_amount, submitted_at, opportunity_id")
      .eq("company_id", cid),
  ]);
  const proposalByOpp = new Map((proposals ?? []).map((p) => [p.opportunity_id, p]));
  const now = new Date();
  const statusFilter = sp.statut === "terminees";
  const pubs = (opps ?? []).filter((o) =>
    statusFilter ? ["CLOSED", "EXPIRED"].includes(o.status) || (o.status === "PUBLISHED" && o.response_deadline && new Date(o.response_deadline) <= now) : true,
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Mes opportunités</h1>
        <ButtonLink href="/publier">
          <PlusCircle className="size-4" aria-hidden /> Publier un besoin
        </ButtonLink>
      </div>
      {sp.supprime && <Notice tone="success" className="mb-4">Brouillon supprimé.</Notice>}
      <LinkTabs
        active={tab}
        tabs={[
          { key: "publications", label: "Mes publications (demandeur)", href: "/dashboard/opportunites", count: opps?.length ?? 0 },
          { key: "reponses", label: "Mes intérêts et réponses (fournisseur)", href: "/dashboard/opportunites?onglet=reponses", count: interests?.length ?? 0 },
        ]}
      />
      {tab === "publications" ? (
        <>
          {statusFilter && (
            <p className="mb-3 text-sm text-slate-600">
              Filtre : consultations terminées ·{" "}
              <Link href="/dashboard/opportunites" className="font-semibold text-teal-700 underline">
                tout afficher
              </Link>
            </p>
          )}
          <DataTable
            rows={pubs}
            rowKey={(o) => o.id}
            caption="Mes publications"
            empty={
              <EmptyState
                icon={<FileStack className="size-6" aria-hidden />}
                title="Aucune publication"
                description="Publiez un besoin, une demande de devis, une consultation ou un appel d'offres privé."
                action={<ButtonLink href="/publier">Publier un besoin</ButtonLink>}
              />
            }
            columns={[
              {
                key: "title",
                header: "Titre",
                primary: true,
                cell: (o) => (
                  <Link href={`/dashboard/opportunites/${o.id}`} className="font-semibold text-navy hover:text-teal-700">
                    {o.title} {o.is_demo && <DemoBadge />}
                  </Link>
                ),
              },
              { key: "type", header: "Type", cell: (o) => OPPORTUNITY_TYPE_LABELS[o.type] },
              {
                key: "status",
                header: "Statut",
                cell: (o) => <StatusBadge kind="opportunity" status={o.status === "PUBLISHED" && o.response_deadline && new Date(o.response_deadline) <= now ? "EXPIRED" : o.status} />,
              },
              { key: "int", header: "Intérêts", cell: (o) => (o.interests as unknown as { count: number }[])[0]?.count ?? 0 },
              { key: "prop", header: "Réponses", cell: (o) => (o.proposals as unknown as { count: number }[])[0]?.count ?? 0 },
              { key: "deadline", header: "Échéance", cell: (o) => formatDate(o.response_deadline) },
            ]}
          />
        </>
      ) : (
        <DataTable
          rows={interests ?? []}
          rowKey={(i) => i.id}
          caption="Mes intérêts et réponses"
          empty={
            <EmptyState
              icon={<Send className="size-6" aria-hidden />}
              title="Aucune manifestation d'intérêt"
              description="Explorez les opportunités et cliquez sur « Je suis intéressé » pour entrer en relation avec un demandeur."
              action={<ButtonLink href="/opportunites">Explorer les opportunités</ButtonLink>}
            />
          }
          columns={[
            {
              key: "title",
              header: "Opportunité",
              primary: true,
              cell: (i) => {
                const o = Array.isArray(i.opportunity) ? i.opportunity[0] : i.opportunity;
                const c = o && (Array.isArray(o.company) ? o.company[0] : o.company);
                return (
                  <span>
                    <Link href={`/opportunites/${o?.id}`} className="font-semibold text-navy hover:text-teal-700">
                      {o?.title}
                    </Link>
                    <span className="block text-xs text-slate-500">{c?.name}</span>
                  </span>
                );
              },
            },
            { key: "interest", header: "Intérêt", cell: (i) => <StatusBadge kind="interest" status={i.status} /> },
            {
              key: "proposal",
              header: "Réponse",
              cell: (i) => {
                const o = Array.isArray(i.opportunity) ? i.opportunity[0] : i.opportunity;
                const p = o ? proposalByOpp.get(o.id) : undefined;
                return p ? (
                  <span className="flex items-center gap-2">
                    <StatusBadge kind="proposal" status={p.status} />
                    {p.price_amount != null && <span className="text-xs text-slate-500">{formatMoney(p.price_amount)}</span>}
                  </span>
                ) : (
                  <Link href={`/opportunites/${o?.id}/repondre`} className="text-sm font-semibold text-teal-700 underline">
                    Répondre
                  </Link>
                );
              },
            },
            {
              key: "opp",
              header: "Statut de l'opportunité",
              cell: (i) => {
                const o = Array.isArray(i.opportunity) ? i.opportunity[0] : i.opportunity;
                return o ? <StatusBadge kind="opportunity" status={o.status} /> : "—";
              },
            },
            { key: "date", header: "Depuis le", cell: (i) => formatDate(i.created_at) },
          ]}
        />
      )}
    </div>
  );
}
