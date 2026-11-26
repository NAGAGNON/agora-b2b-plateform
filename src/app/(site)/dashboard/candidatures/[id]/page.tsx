import { readJourney } from "@/lib/journey";
import { notFound } from "next/navigation";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/format";
import { BriefSchema, boampId, isCurrentBrief, tedId } from "@/lib/tender-brief";
import { CandidatureWorkspace } from "@/components/applications/candidature-workspace";
import type { Award } from "@/lib/award-watch";
import { track } from "@/lib/analytics";
import { founderOffer, founderOpen } from "@/lib/billing/founder";

export const metadata = { title: "Ma candidature" };

/**
 * Une candidature, tout au même endroit : conditions comparées à la fiche entreprise, dossier, visite,
 * pièces à cocher, notation, conseils, trame du mémoire technique, dépôt, résultat ; lien vers
 * l'annonce officielle et retour exact à la recherche.
 */
// Heure courante (hors rendu React : appel d'une fonction du module)
const nowMs = () => Date.now();

export default async function CandidaturePage(props: PageProps<"/dashboard/candidatures/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const session = await requireCompany(`/dashboard/candidatures/${id}`);
  const company = session.activeCompany.company;
  const db = await createClient();
  const [{ data: item }, { data: o }, { data: profile }, { data: co }] = await Promise.all([
    db.from("pipeline_items").select("stage, guide_done, docs_done, brief_done, draft, submitted_at, created_at, next_action, next_action_at, award, journey").eq("company_id", company.id).eq("opportunity_id", id).maybeSingle(),
    db.from("opportunities").select("id, title, origin, external_buyer_name, response_deadline, city, department_code").eq("id", id).maybeSingle(),
    db.from("company_profiles").select("description, references_text, certifications, employees_range, founded_year").eq("company_id", company.id).maybeSingle(),
    db.from("companies").select("name, city").eq("id", company.id).maybeSingle(),
  ]);
  if (!o) notFound();
  // Mesure de la consultation (aucune donnée de candidature n'est écrite)
  // Une seule consultation par membre et par offre sur 30 minutes : chaque action sur la fiche (étape cochée,
  // note, question) recharge la page, ce qui comptait plusieurs « consultations » pour une seule visite
  const { count: seen } = await createAdminClient()
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("event_name", "view_application")
    .eq("user_id", session.userId)
    .eq("properties->>opportunity_id", id)
    .gte("created_at", new Date(nowMs() - 30 * 60_000).toISOString());
  if (!seen) void track("view_application", { opportunity_id: id, saved: Boolean(item), stage: item?.stage ?? "CONSULTEE" });
  // Pas encore enregistrée : simple consultation (« DETECTED »), rien n'est écrit tant que la personne ne choisit pas

  const admin = createAdminClient();
  const [{ data: sources }, { data: stored }, plan, { data: journal }, { data: questions }, { data: members }, { data: followers }] = await Promise.all([
    admin.from("opportunity_sources").select("original_url, external_id, is_primary").eq("opportunity_id", id),
    admin.from("tender_briefs").select("content").eq("opportunity_id", id).maybeSingle(),
    db.rpc("user_plan").then((r) => r.data ?? "FREE"),
    db.from("application_journal").select("id, kind, body, created_at, user_id, step").eq("company_id", company.id).eq("opportunity_id", id).order("created_at", { ascending: false }).limit(100),
    db.from("application_questions").select("id, question, answer, created_at, user_id").eq("company_id", company.id).eq("opportunity_id", id).order("created_at", { ascending: true }).limit(50),
    // Équipe de l'entreprise (pour ajouter un collègue au suivi) et membres qui suivent déjà ce dossier
    admin.from("company_members").select("user_id, user:users(full_name)").eq("company_id", company.id).order("created_at").limit(50),
    db.from("application_followers").select("user_id").eq("company_id", company.id).eq("opportunity_id", id),
  ]);
  const authorIds = [...new Set((journal ?? []).map((j) => j.user_id).filter((x): x is string => Boolean(x)))];
  const { data: authors } = authorIds.length ? await admin.from("users").select("id, full_name").in("id", authorIds) : { data: [] as { id: string; full_name: string }[] };
  const authorName = new Map((authors ?? []).map((a) => [a.id, a.full_name]));
  const primary = (sources ?? []).find((s) => s.is_primary) ?? (sources ?? [])[0];
  const allowed = (await db.rpc("plan_feature", { p_plan: plan, p_key: "tender_brief" })).data === true;
  // Fiche réservée : où découvrir l'offre Pro (offre fondateur quand elle est ouverte)
  const upgradeHref = allowed ? "/tarifs" : founderOpen(await founderOffer(admin)) ? "/offre-fondateur" : "/tarifs";
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
        external: o.origin === "EXTERNAL",
        place: [o.city, o.department_code ? `(${o.department_code})` : null].filter(Boolean).join(" ") || null,
        deadline: o.response_deadline,
        stage: item?.stage ?? "DETECTED",
        submittedAt: item?.submitted_at ?? null,
        award: (item?.award as Award | null) ?? null,
        reminder: item?.next_action_at ? { date: item.next_action_at, text: item.next_action ?? "" } : null,
        guideDone: (item?.guide_done ?? []).map(Number),
        journey: readJourney(item?.journey),
        docsDone: (item?.docs_done ?? []).map(Number),
        briefDone: (item?.brief_done ?? []).map(Number),
        upgradeHref,
        draft: item?.draft ?? null,
        // Fiche absente ou d'un style plus ancien : rédigée à l'ouverture (la personne voit « Lecture de l'annonce… »)
        brief: allowed && Boolean(idweb || ted) && !isCurrentBrief(brief) ? null : brief,
        briefAllowed: allowed,
        canLoadBrief: allowed && Boolean(idweb || ted) && !isCurrentBrief(brief),
        sourceLabel: idweb ? `BOAMP n° ${idweb}` : ted ? `TED n° ${ted}` : null,
        awardWatched: Boolean(idweb),
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
          step: j.step,
        })),
        team: (members ?? []).map((m) => {
          const u = (Array.isArray(m.user) ? m.user[0] : m.user) as { full_name: string | null } | null;
          return { id: m.user_id, name: u?.full_name?.trim() || "Membre de l'équipe", you: m.user_id === session.userId };
        }),
        followers: (followers ?? []).map((f) => f.user_id),
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
