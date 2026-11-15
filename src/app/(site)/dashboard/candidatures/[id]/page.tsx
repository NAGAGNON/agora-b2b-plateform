import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarClock, Landmark } from "lucide-react";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/format";
import { BriefSchema, boampId, isFullBrief, tedId } from "@/lib/tender-brief";
import { TenderBriefPanel } from "@/components/opportunities/tender-brief";
import { ApplicationCard } from "@/components/applications/application-card";
import { CandidatureNav } from "@/components/applications/candidature-nav";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { title: "Ma candidature" };

const fmt = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/**
 * Une candidature, tout au même endroit : étapes à cocher, conditions pour candidater, notation,
 * conseils, où déposer, lien vers l'annonce officielle et retour exact à la recherche.
 */
export default async function CandidaturePage(props: PageProps<"/dashboard/candidatures/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const session = await requireCompany(`/dashboard/candidatures/${id}`);
  const companyId = session.activeCompany.company.id;
  const db = await createClient();
  const [{ data: item }, { data: o }, { data: profile }] = await Promise.all([
    db.from("pipeline_items").select("stage, guide_done, brief_done, submitted_at").eq("company_id", companyId).eq("opportunity_id", id).maybeSingle(),
    db.from("opportunities").select("id, title, origin, external_buyer_name, response_deadline, city, department_code").eq("id", id).maybeSingle(),
    db.from("company_profiles").select("certifications").eq("company_id", companyId).maybeSingle(),
  ]);
  if (!o) notFound();
  // Pas encore de candidature : la fiche de l'offre propose « Ça m'intéresse »
  if (!item) redirect(`/opportunites/${id}`);

  const admin = createAdminClient();
  const [{ data: sources }, { data: stored }, plan] = await Promise.all([
    admin.from("opportunity_sources").select("original_url").eq("opportunity_id", id),
    admin.from("tender_briefs").select("content").eq("opportunity_id", id).maybeSingle(),
    db.rpc("user_plan").then((r) => r.data ?? "FREE"),
  ]);
  const allowed = (await db.rpc("plan_feature", { p_plan: plan, p_key: "tender_brief" })).data === true;
  const idweb = (sources ?? []).map((s) => boampId(s.original_url)).find(Boolean);
  const ted = idweb ? null : (sources ?? []).map((s) => tedId(s.original_url)).find(Boolean);
  const parsed = BriefSchema.safeParse(stored?.content);
  const brief = parsed.success ? parsed.data : null;
  const hasSource = (sources ?? []).some((s) => s.original_url);
  const days = o.response_deadline ? Math.ceil((new Date(o.response_deadline).getTime() - new Date().getTime()) / 86_400_000) : null;

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-navy p-6 text-white shadow-xl sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 animate-aurora rounded-full bg-teal/25 blur-3xl" />
        <div className="relative">
          <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-teal-200 uppercase">
            <Landmark className="size-4" aria-hidden /> Ma candidature
          </p>
          <h1 className="mt-2 max-w-3xl animate-rise font-heading text-2xl font-extrabold text-white sm:text-3xl">{o.title}</h1>
          <p className="mt-1 text-white/70">{o.external_buyer_name ?? "Besoin publié sur LinkProB2B"}</p>
          {o.response_deadline && (
            <p className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${days !== null && days >= 0 && days <= 5 ? "bg-rose-500/20 text-rose-100" : "bg-white/10 text-white"}`}>
              <CalendarClock className="size-4" aria-hidden />
              Date limite : {fmt(o.response_deadline)}
              {days !== null && days >= 0 ? ` · plus que ${days} jour${days > 1 ? "s" : ""}` : days !== null ? " · dépassée" : ""}
            </p>
          )}
          <div className="mt-5 [&_a]:shadow-none">
            <CandidatureNav opportunityId={id} hasSource={hasSource} dark />
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <ApplicationCard
            detail
            data={{
              opportunityId: id,
              title: o.title,
              buyer: o.external_buyer_name,
              deadline: o.response_deadline,
              stage: item.stage,
              submittedAt: item.submitted_at,
              guideDone: (item.guide_done ?? []).map(Number),
              briefTodo: { total: brief?.todo.length ?? 0, done: (item.brief_done ?? []).length },
              submission: brief?.submission ?? null,
              submissionUrl: brief?.submission_url ?? null,
              external: o.origin === "EXTERNAL",
            }}
          />
        </div>
        <div className="min-w-0">
          {idweb || ted ? (
            <div className="-mt-8">
              <TenderBriefPanel
                opportunityId={id}
                initial={allowed && isFullBrief(brief) ? brief : null}
                source={idweb ? `BOAMP n° ${idweb}` : `TED n° ${ted}`}
                allowed={allowed}
                teaser={allowed ? null : (brief?.summary ?? null)}
                mine={profile?.certifications ?? []}
                upgrade={
                  <Link href="/tarifs" className={buttonClasses({ full: true, className: "btn-shine" })}>
                    Voir l&apos;offre Pro
                  </Link>
                }
              />
            </div>
          ) : (
            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="font-bold text-navy">Les informations de l&apos;offre</h2>
              <p className="mt-2 text-sm text-slate-600">
                Retrouvez la description complète, les pièces et la date limite sur{" "}
                <Link href={`/opportunites/${id}`} className="font-semibold text-teal-700 hover:underline">
                  la fiche de l&apos;offre
                </Link>
                .
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
