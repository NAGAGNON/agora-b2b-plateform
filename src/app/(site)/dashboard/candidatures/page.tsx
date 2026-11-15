import { ClipboardList } from "lucide-react";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmptyState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/card";
import { BriefSchema } from "@/lib/tender-brief";
import { ApplicationCard, type ApplicationCardData } from "@/components/applications/application-card";

export const metadata = { title: "Mes candidatures" };

const STAGES = ["RESPONSE_PREPARING", "RESPONSE_SENT", "DISCUSSION", "NEGOTIATION", "WON", "LOST"] as const;

/**
 * Mes candidatures : chaque appel d'offres auquel l'entreprise répond, avec le guide étape par étape
 * jusqu'au dépôt, puis le résultat. Privé à l'entreprise.
 */
export default async function ApplicationsPage() {
  const session = await requireCompany("/dashboard/candidatures");
  const supabase = await createClient();
  const { data } = await supabase
    .from("pipeline_items")
    .select("stage, guide_done, brief_done, submitted_at, updated_at, opportunity:opportunities(id, title, origin, external_buyer_name, response_deadline)")
    .eq("company_id", session.activeCompany.company.id)
    .in("stage", [...STAGES])
    .order("updated_at", { ascending: false });
  const rows = (data ?? []).map((d) => ({ ...d, opportunity: Array.isArray(d.opportunity) ? d.opportunity[0] : d.opportunity })).filter((d) => d.opportunity);
  const ids = rows.map((r) => r.opportunity!.id);
  const { data: briefs } = ids.length ? await createAdminClient().from("tender_briefs").select("opportunity_id, content").in("opportunity_id", ids) : { data: [] };
  const brief = new Map((briefs ?? []).map((b) => [b.opportunity_id, BriefSchema.safeParse(b.content)]));

  const cards: ApplicationCardData[] = rows.map((r) => {
    const o = r.opportunity!;
    const b = brief.get(o.id);
    const content = b?.success ? b.data : null;
    return {
      opportunityId: o.id,
      title: o.title,
      buyer: o.external_buyer_name,
      deadline: o.response_deadline,
      stage: r.stage,
      submittedAt: r.submitted_at,
      guideDone: (r.guide_done ?? []).map(Number),
      briefTodo: { total: content?.todo.length ?? 0, done: (r.brief_done ?? []).length },
      submission: content?.submission ?? null,
      submissionUrl: content?.submission_url ?? null,
      external: o.origin === "EXTERNAL",
    };
  });
  const preparing = cards.filter((c) => c.stage === "RESPONSE_PREPARING");
  const sent = cards.filter((c) => ["RESPONSE_SENT", "DISCUSSION", "NEGOTIATION"].includes(c.stage));
  const finished = cards.filter((c) => c.stage === "WON" || c.stage === "LOST");
  const won = cards.filter((c) => c.stage === "WON").length;

  return (
    <div>
      <DashboardPageHeader
        icon={<ClipboardList />}
        image="/images/illustrations/plans.webp"
        title="Mes candidatures"
        description={<>Les appels d&apos;offres auxquels vous répondez, étape par étape jusqu&apos;au dépôt, puis le résultat. Visible seulement par votre entreprise.</>}
      />
      {cards.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-6" aria-hidden />}
          title="Aucune candidature pour l'instant"
          description="Quand vous consultez un appel d'offres, indiquez « Je prépare ma réponse » : il apparaît ici avec un guide étape par étape jusqu'au dépôt."
          action={<ButtonLink href="/opportunites">Trouver un appel d&apos;offres</ButtonLink>}
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <DashboardCard label="En préparation" value={preparing.length} />
            <DashboardCard label="Réponses envoyées" value={sent.length} />
            <DashboardCard label="Gagnés" value={won} />
            <DashboardCard label="Taux de réussite" value={finished.length ? `${Math.round((won / finished.length) * 100)} %` : "—"} />
          </div>
          {[
            { title: "En préparation", list: preparing },
            { title: "En attente du résultat", list: sent },
            { title: "Terminées", list: finished },
          ]
            .filter((s) => s.list.length)
            .map((s) => (
              <section key={s.title} className="mb-8">
                <h2 className="mb-3 text-lg font-bold text-navy">
                  {s.title} <span className="text-slate-400">({s.list.length})</span>
                </h2>
                <div className="space-y-4">
                  {s.list.map((c) => (
                    <ApplicationCard key={c.opportunityId} data={c} />
                  ))}
                </div>
              </section>
            ))}
        </>
      )}
    </div>
  );
}
