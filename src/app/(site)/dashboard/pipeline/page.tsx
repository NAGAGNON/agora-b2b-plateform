import { KanbanSquare } from "lucide-react";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PipelineBoard, type PipelineCard } from "@/components/dashboard/pipeline-board";
import { EmptyState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const session = await requireCompany("/dashboard/pipeline");
  const supabase = await createClient();
  const { data } = await supabase
    .from("pipeline_items")
    .select("id, stage, notes, next_action, next_action_at, estimated_value, updated_at, opportunity:opportunities(id, title, origin, type, response_deadline, is_demo, status)")
    .eq("company_id", session.activeCompany.company.id)
    .order("updated_at", { ascending: false });
  const items = (data ?? []).map((d) => ({ ...d, opportunity: Array.isArray(d.opportunity) ? d.opportunity[0] : d.opportunity })) as PipelineCard[];
  const open = items.filter((i) => !["WON", "LOST"].includes(i.stage));
  const won = items.filter((i) => i.stage === "WON");
  const lost = items.filter((i) => i.stage === "LOST");
  const openValue = open.reduce((s, i) => s + (i.estimated_value ?? 0), 0);
  return (
    <div>
      <h1 className="text-2xl font-bold">Pipeline commercial</h1>
      <p className="mt-1 mb-6 text-slate-600">
        Suivi privé de vos opportunités, de la détection au résultat. Seuls les membres de {session.activeCompany.company.name} y ont accès — ni les
        demandeurs ni l&apos;équipe LinkProB2B.
      </p>
      {items.length === 0 ? (
        <EmptyState
          icon={<KanbanSquare className="size-6" aria-hidden />}
          title="Votre pipeline est vide"
          description="Depuis une fiche opportunité, cliquez sur « Suivre dans mon pipeline ». Les intérêts et réponses envoyés y sont ajoutés automatiquement."
          action={<ButtonLink href="/opportunites">Explorer les opportunités</ButtonLink>}
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <DashboardCard label="En cours" value={open.length} />
            <DashboardCard label="Valeur estimée en cours" value={formatMoney(openValue)} />
            <DashboardCard label="Gagnées" value={won.length} />
            <DashboardCard label="Perdues" value={lost.length} />
          </div>
          <PipelineBoard items={items} />
        </>
      )}
    </div>
  );
}
