import { notFound } from "next/navigation";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/format";
import { BriefSchema, boampId, isFullBrief, tedId } from "@/lib/tender-brief";
import { CandidatureWorkspace } from "@/components/applications/candidature-workspace";
import { track } from "@/lib/analytics";

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
    db.from("pipeline_items").select("stage, guide_done, docs_done, draft, submitted_at, created_at").eq("company_id", company.id).eq("opportunity_id", id).maybeSingle(),
    db.from("opportunities").select("id, title, origin, external_buyer_name, response_deadline, city, department_code").eq("id", id).maybeSingle(),
    db.from("company_profiles").select("description, references_text, certifications, employees_range, founded_year").eq("company_id", company.id).maybeSingle(),
    db.from("companies").select("name, city").eq("id", company.id).maybeSingle(),
  ]);
  if (!o) notFound();
  // Mesure de la consultation (aucune donnée de candidature n'est écrite)
  void track("view_application", { opportunity_id: id, saved: Boolean(item), stage: item?.stage ?? "CONSULTEE" });
  // Pas encore enregistrée : simple consultation (« DETECTED »), rien n'est écrit tant que la personne ne choisit pas

  const admin = createAdminClient();
  const [{ data: sources }, { data: stored }, plan, { data: journal }, { data: questions }] = await Promise.all([
    admin.from("opportunity_sources").select("original_url, external_id, is_primary").eq("opportunity_id", id),
    admin.from("tender_briefs").select("content").eq("opportunity_id", id).maybeSingle(),
    db.rpc("user_plan").then((r) => r.data ?? "FREE"),
    db.from("application_journal").select("id, kind, body, created_at, user_id").eq("company_id", company.id).eq("opportunity_id", id).order("created_at", { ascending: false }).limit(100),
    db.from("application_questions").select("id, question, answer, created_at, user_id").eq("company_id", company.id).eq("opportunity_id", id).order("created_at", { ascending: true }).limit(50),
  ]);
  const authorIds = [...new Set((journal ?? []).map((j) => j.user_id).filter((x): x is string => Boolean(x)))];
  const { data: authors } = authorIds.length ? await admin.from("users").select("id, full_name").in("id", authorIds) : { data: [] as { id: string; full_name: string }[] };
  const authorName = new Map((authors ?? []).map((a) => [a.id, a.full_name]));
  const primary = (sources ?? []).find((s) => s.is_primary) ?? (sources ?? [])[0];
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
        stage: item?.stage ?? "DETECTED",
        submittedAt: item?.submitted_at ?? null,
        guideDone: (item?.guide_done ?? []).map(Number),
        docsDone: (item?.docs_done ?? []).map(Number),
        draft: item?.draft ?? null,
        brief,
        briefAllowed: allowed,
        // Avis officiel connu mais fiche absente ou ancienne : préparée à l'affichage
        canLoadBrief: allowed && Boolean(idweb || ted) && !isFullBrief(brief),
        sourceLabel: idweb ? `BOAMP n° ${idweb}` : ted ? `TED n° ${ted}` : null,
        hasSource: (sources ?? []).some((s) => s.original_url),
        mine: profile?.certifications ?? [],
        startedAt: item?.created_at ?? null,
        reference: primary?.external_id ?? null,
        journal: (journal ?? []).map((j) => ({
          id: j.id,
          kind: j.kind,
          body: j.body,
          created_at: j.created_at,
          author: j.user_id === session.userId ? "Vous" : j.user_id ? (authorName.get(j.user_id) ?? null) : null,
          mine: j.user_id === session.userId,
        })),
        questions: (questions ?? []).map((q) => ({ id: q.id, question: q.question, answer: q.answer, created_at: q.created_at, mine: q.user_id === session.userId })),
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
