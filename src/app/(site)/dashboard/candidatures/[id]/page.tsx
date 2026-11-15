import { notFound, redirect } from "next/navigation";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/format";
import { BriefSchema, boampId, isFullBrief, tedId } from "@/lib/tender-brief";
import { CandidatureWorkspace } from "@/components/applications/candidature-workspace";

export const metadata = { title: "Ma candidature" };

/**
 * Une candidature, tout au même endroit : conditions comparées à la fiche entreprise, dossier, visite,
 * pièces à cocher, notation, conseils, trame du mémoire technique, dépôt, résultat ; lien vers
 * l'annonce officielle et retour exact à la recherche.
 */
export default async function CandidaturePage(props: PageProps<"/dashboard/candidatures/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const session = await requireCompany(`/dashboard/candidatures/${id}`);
  const company = session.activeCompany.company;
  const db = await createClient();
  const [{ data: item }, { data: o }, { data: profile }, { data: co }] = await Promise.all([
    db.from("pipeline_items").select("stage, guide_done, docs_done, draft, submitted_at").eq("company_id", company.id).eq("opportunity_id", id).maybeSingle(),
    db.from("opportunities").select("id, title, origin, external_buyer_name, response_deadline, city, department_code").eq("id", id).maybeSingle(),
    db.from("company_profiles").select("description, references_text, certifications, employees_range, founded_year").eq("company_id", company.id).maybeSingle(),
    db.from("companies").select("name, city").eq("id", company.id).maybeSingle(),
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
  const brief = allowed && parsed.success ? parsed.data : null;

  return (
    <CandidatureWorkspace
      data={{
        id,
        title: o.title,
        buyer: o.origin === "EXTERNAL" ? o.external_buyer_name : null,
        place: [o.city, o.department_code ? `(${o.department_code})` : null].filter(Boolean).join(" ") || null,
        deadline: o.response_deadline,
        stage: item.stage,
        submittedAt: item.submitted_at,
        guideDone: (item.guide_done ?? []).map(Number),
        docsDone: (item.docs_done ?? []).map(Number),
        draft: item.draft,
        brief,
        briefAllowed: allowed,
        // Avis officiel connu mais fiche absente ou ancienne : préparée à l'affichage
        canLoadBrief: allowed && Boolean(idweb || ted) && !isFullBrief(brief),
        sourceLabel: idweb ? `BOAMP n° ${idweb}` : ted ? `TED n° ${ted}` : null,
        hasSource: (sources ?? []).some((s) => s.original_url),
        mine: profile?.certifications ?? [],
        company: {
          name: co?.name ?? company.name,
          city: co?.city ?? null,
          description: profile?.description ?? null,
          references: profile?.references_text ?? null,
          certifications: profile?.certifications ?? [],
          employees: profile?.employees_range ?? null,
          founded: profile?.founded_year ?? null,
        },
      }}
    />
  );
}
