"use server";

import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { logServerError } from "@/lib/errors";
import { BriefSchema } from "@/lib/tender-brief";
import { askAssistant, buildAssistantContext } from "@/lib/application-assistant";

export type AssistantMessage = { id: string; question: string; answer: string; created_at: string; mine: boolean };
type Result = { ok: true; message: AssistantMessage } | { ok: false; error: string };

const Input = z.object({ opportunityId: z.uuid(), question: z.string().trim().min(3, "Votre question est trop courte.").max(1000, "Votre question est trop longue (1 000 caractères au plus).") });
const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/** Question à l'assistant d'une candidature : réponse tirée de l'avis, de la fiche synthèse et de la fiche entreprise. */
export async function askApplicationQuestion(opportunityId: string, question: string): Promise<Result> {
  const parsed = Input.safeParse({ opportunityId, question });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Question invalide." };
  const session = await getSession();
  if (!session?.activeCompany) return { ok: false, error: "Connectez-vous avec votre entreprise." };
  // Garde-fous de coût : par heure et par jour
  if (!(await rateLimit("application-assistant", 20, 3600)) || !(await rateLimit("application-assistant-day", 60, 86_400)))
    return { ok: false, error: "Vous avez posé beaucoup de questions. Réessayez un peu plus tard." };
  const companyId = session.activeCompany.company.id;
  const db = await createClient();
  const [{ data: item }, { data: o }, { data: profile }, { data: co }, { data: history }] = await Promise.all([
    db.from("pipeline_items").select("stage").eq("company_id", companyId).eq("opportunity_id", parsed.data.opportunityId).maybeSingle(),
    db
      .from("opportunities")
      .select("title, origin, external_buyer_name, response_deadline, city, department_code, description, criteria, constraints, budget_min, budget_max, budget_visible")
      .eq("id", parsed.data.opportunityId)
      .maybeSingle(),
    db.from("company_profiles").select("description, references_text, certifications, employees_range, founded_year").eq("company_id", companyId).maybeSingle(),
    db.from("companies").select("name").eq("id", companyId).maybeSingle(),
    db.from("application_questions").select("question, answer").eq("company_id", companyId).eq("opportunity_id", parsed.data.opportunityId).order("created_at", { ascending: false }).limit(4),
  ]);
  if (!o) return { ok: false, error: "Offre introuvable." };
  const admin = createAdminClient();
  const [{ data: sources }, { data: stored }] = await Promise.all([
    admin.from("opportunity_sources").select("original_url").eq("opportunity_id", parsed.data.opportunityId),
    admin.from("tender_briefs").select("content").eq("opportunity_id", parsed.data.opportunityId).maybeSingle(),
  ]);
  const brief = BriefSchema.safeParse(stored?.content);
  const budget =
    o.budget_visible && (o.budget_min || o.budget_max)
      ? o.budget_min && o.budget_max
        ? `${eur(o.budget_min)} à ${eur(o.budget_max)}`
        : eur((o.budget_max ?? o.budget_min) as number)
      : null;
  try {
    const context = await buildAssistantContext({
      opportunity: {
        title: o.title,
        buyer: o.origin === "EXTERNAL" ? o.external_buyer_name : "Entreprise inscrite sur LinkProB2B",
        deadline: o.response_deadline,
        place: [o.city, o.department_code ? `(${o.department_code})` : null].filter(Boolean).join(" ") || null,
        description: o.description,
        criteria: o.criteria,
        constraints: o.constraints,
        budget,
      },
      sources: (sources ?? []).map((s) => s.original_url).filter((u): u is string => Boolean(u)),
      brief: brief.success ? brief.data : null,
      company: {
        name: co?.name ?? session.activeCompany.company.name,
        description: profile?.description ?? null,
        references: profile?.references_text ?? null,
        certifications: profile?.certifications ?? [],
        employees: profile?.employees_range ?? null,
        founded: profile?.founded_year ?? null,
      },
      stage: item?.stage ?? "DETECTED",
    });
    const answer = await askAssistant(context, [...(history ?? [])].reverse(), parsed.data.question);
    if (!answer) return { ok: false, error: "L'assistant n'est pas disponible pour le moment. Réessayez dans quelques minutes." };
    const { data: row, error } = await admin
      .from("application_questions")
      .insert({ company_id: companyId, opportunity_id: parsed.data.opportunityId, user_id: session.userId, question: parsed.data.question, answer })
      .select("id, created_at")
      .single();
    if (error) logServerError("application assistant save", error);
    return { ok: true, message: { id: row?.id ?? crypto.randomUUID(), question: parsed.data.question, answer, created_at: row?.created_at ?? new Date().toISOString(), mine: true } };
  } catch (e) {
    logServerError("application assistant", e);
    return { ok: false, error: "L'assistant n'a pas pu répondre. Réessayez dans quelques minutes." };
  }
}
