import Link from "next/link";
import { ArrowRight, BellRing, FileStack, Handshake, Heart, Inbox, PlusCircle, Send, Sparkles, Users } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardCard, Card, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { DemoBadge } from "@/components/demo";
import { OpportunityTypeBadge, OriginBadge } from "@/components/opportunities/opportunity-badge";
import { PIPELINE_STAGES, SECTOR_LABELS, type PipelineStage } from "@/lib/constants";
import { deadlineLabel, formatMoney, relativeTime } from "@/lib/format";

export const metadata = { title: "Tableau de bord" };

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const session = await requireSession("/dashboard");
  const sp = await props.searchParams;
  const company = session.activeCompany?.company;

  if (!company) {
    return (
      <EmptyState
        icon={<Users className="size-6" aria-hidden />}
        title="Créez le profil de votre entreprise"
        description="Il est nécessaire pour publier un besoin, manifester votre intérêt, répondre à une consultation et gérer votre pipeline."
        action={<ButtonLink href="/onboarding/entreprise">Créer mon entreprise</ButtonLink>}
      />
    );
  }

  const supabase = await createClient();
  const cid = company.id;
  const supplier = company.kind !== "BUYER";
  const buyer = company.kind !== "SUPPLIER";

  const [recommended, favs, alerts, interests, proposals, pipeline, myOpps, receivedInterests, receivedProposals, latestProposals] = await Promise.all([
    supplier ? supabase.rpc("recommended_opportunities", { p_company_id: cid, p_limit: 5 }) : null,
    supabase.from("favorites").select("id", { count: "exact", head: true }).eq("user_id", session.userId),
    supabase.from("alerts").select("id", { count: "exact", head: true }).eq("user_id", session.userId).eq("is_active", true),
    supabase.from("interests").select("id", { count: "exact", head: true }).eq("company_id", cid).neq("status", "WITHDRAWN"),
    supabase.from("proposals").select("id", { count: "exact", head: true }).eq("company_id", cid).neq("status", "WITHDRAWN"),
    supabase.from("pipeline_items").select("stage").eq("company_id", cid),
    buyer ? supabase.from("opportunities").select("id, title, type, status, response_deadline").eq("company_id", cid).order("updated_at", { ascending: false }) : null,
    buyer
      ? supabase.from("interests").select("id, opportunity:opportunities!inner(company_id)", { count: "exact", head: true }).eq("opportunity.company_id", cid).neq("status", "WITHDRAWN")
      : null,
    buyer
      ? supabase.from("proposals").select("id, opportunity:opportunities!proposals_opportunity_id_fkey!inner(company_id)", { count: "exact", head: true }).eq("opportunity.company_id", cid).neq("status", "WITHDRAWN")
      : null,
    buyer
      ? supabase
          .from("proposals")
          .select("id, status, price_amount, submitted_at, company:companies(name), opportunity:opportunities!proposals_opportunity_id_fkey!inner(id, title, company_id)")
          .eq("opportunity.company_id", cid)
          .neq("status", "WITHDRAWN")
          .order("submitted_at", { ascending: false })
          .limit(5)
      : null,
  ]);

  const stageCounts = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.stage, 0])) as Record<PipelineStage, number>;
  for (const p of pipeline.data ?? []) stageCounts[p.stage]++;
  const opps = myOpps?.data ?? [];
  const now = new Date();
  const active = opps.filter((o) => o.status === "PUBLISHED" && (!o.response_deadline || new Date(o.response_deadline) > now));
  const consultations = active.filter((o) => o.type !== "NEED");
  const pending = opps.filter((o) => ["PENDING_REVIEW", "CHANGES_REQUESTED", "DRAFT"].includes(o.status));
  const finished = opps.filter((o) => ["CLOSED", "EXPIRED"].includes(o.status) || (o.status === "PUBLISHED" && o.response_deadline && new Date(o.response_deadline) <= now));

  return (
    <div className="space-y-10">
      {sp.bienvenue && (
        <Notice tone="success" title="Bienvenue sur LinkProB2B !">
          Votre entreprise est créée. Complétez son profil pour apparaître dans l&apos;annuaire et recevoir des recommandations pertinentes.{" "}
          <Link href="/dashboard/entreprise" className="font-semibold underline">
            Compléter le profil
          </Link>
        </Notice>
      )}
      {sp.refus === "admin" && <Notice tone="error">Accès refusé : cet espace est réservé à l&apos;administration.</Notice>}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Tableau de bord</h1>
          <p className="mt-1 text-slate-600">{company.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/opportunites" variant="outline">
            Explorer les opportunités
          </ButtonLink>
          <ButtonLink href="/publier">
            <PlusCircle className="size-4" aria-hidden /> Publier un besoin
          </ButtonLink>
        </div>
      </div>

      {supplier && (
        <section aria-labelledby="fournisseur" className="space-y-5">
          <h2 id="fournisseur" className="text-xl font-bold">
            Espace fournisseur
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <DashboardCard label="Favoris" value={favs.count ?? 0} href="/dashboard/favoris" icon={<Heart className="size-5" aria-hidden />} />
            <DashboardCard label="Alertes actives" value={alerts.count ?? 0} href="/dashboard/alertes" icon={<BellRing className="size-5" aria-hidden />} />
            <DashboardCard label="Intérêts manifestés" value={interests.count ?? 0} href="/dashboard/opportunites?onglet=reponses" icon={<Handshake className="size-5" aria-hidden />} />
            <DashboardCard label="Réponses envoyées" value={proposals.count ?? 0} href="/dashboard/opportunites?onglet=reponses" icon={<Send className="size-5" aria-hidden />} />
          </div>

          <Card>
            <CardHeader
              title="Mon pipeline"
              description="Privé à votre entreprise."
              action={
                <Link href="/dashboard/pipeline" className="text-sm font-semibold text-teal-700 hover:underline">
                  Ouvrir le pipeline →
                </Link>
              }
            />
            <ul className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3 lg:grid-cols-5">
              {PIPELINE_STAGES.filter((s) => !["INTERESTED", "RESPONSE_SENT", "DISCUSSION", "LOST"].includes(s.stage)).map((s) => (
                <li key={s.stage} className="bg-white p-4">
                  <p className="font-heading text-2xl font-bold text-navy tabular-nums">{stageCounts[s.stage]}</p>
                  <p className="text-sm text-slate-600">{s.label}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Sparkles className="size-5 text-teal-600" aria-hidden /> Opportunités recommandées
                </span>
              }
              description="Selon les secteurs, la localisation et les compétences de votre profil."
            />
            {recommended?.data && recommended.data.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {recommended.data.map((o) => (
                  <li key={o.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-1.5">
                        <OriginBadge origin={o.origin} type={o.type} />
                        {o.type !== "EXTERNAL_OPPORTUNITY" && <OpportunityTypeBadge type={o.type} />}
                        {o.is_demo && <DemoBadge />}
                      </div>
                      <Link href={`/opportunites/${o.id}`} className="mt-1 block font-semibold text-navy hover:text-teal-700">
                        {o.title}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {[o.city, o.sector_slug && SECTOR_LABELS[o.sector_slug], deadlineLabel(o.response_deadline)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {o.reasons.map((r) => (
                        <Badge key={r} tone="teal">
                          {r}
                        </Badge>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-500">
                Aucune recommandation pour le moment. Renseignez vos secteurs et compétences dans{" "}
                <Link href="/dashboard/entreprise" className="font-semibold text-teal-700 underline">
                  le profil de l&apos;entreprise
                </Link>{" "}
                et créez une{" "}
                <Link href="/dashboard/alertes" className="font-semibold text-teal-700 underline">
                  alerte
                </Link>
                .
              </p>
            )}
          </Card>
        </section>
      )}

      {buyer && (
        <section aria-labelledby="demandeur" className="space-y-5">
          <h2 id="demandeur" className="text-xl font-bold">
            Espace demandeur
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <DashboardCard label="Besoins actifs" value={active.length} href="/dashboard/opportunites" icon={<FileStack className="size-5" aria-hidden />} />
            <DashboardCard label="Consultations en cours" value={consultations.length} href="/dashboard/opportunites" />
            <DashboardCard label="Fournisseurs intéressés" value={receivedInterests?.count ?? 0} icon={<Users className="size-5" aria-hidden />} />
            <DashboardCard label="Réponses reçues" value={receivedProposals?.count ?? 0} icon={<Inbox className="size-5" aria-hidden />} />
            <DashboardCard label="Terminées" value={finished.length} href="/dashboard/opportunites?statut=terminees" />
          </div>
          {pending.length > 0 && (
            <Notice tone="info">
              {pending.length} publication(s) en brouillon ou en attente de validation.{" "}
              <Link href="/dashboard/opportunites" className="font-semibold underline">
                Voir mes publications
              </Link>
            </Notice>
          )}
          <Card>
            <CardHeader title="Dernières réponses reçues" />
            {latestProposals?.data && latestProposals.data.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {latestProposals.data.map((p) => {
                  const opp = Array.isArray(p.opportunity) ? p.opportunity[0] : p.opportunity;
                  const comp = Array.isArray(p.company) ? p.company[0] : p.company;
                  return (
                    <li key={p.id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <Link href={`/dashboard/opportunites/${opp?.id}`} className="font-semibold text-navy hover:text-teal-700">
                          {comp?.name ?? "Fournisseur"}
                        </Link>
                        <p className="truncate text-sm text-slate-500">{opp?.title}</p>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        {p.price_amount != null && <span className="font-semibold text-navy">{formatMoney(p.price_amount)}</span>}
                        <StatusBadge kind="proposal" status={p.status} />
                        <span className="text-xs text-slate-400">{relativeTime(p.submitted_at)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-5 py-6 text-sm text-slate-500">
                Aucune réponse reçue pour le moment.{" "}
                <Link href="/publier" className="inline-flex items-center gap-1 font-semibold text-teal-700 underline">
                  Publier un besoin <ArrowRight className="size-3" aria-hidden />
                </Link>
              </div>
            )}
          </Card>
        </section>
      )}
    </div>
  );
}
