"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { logServerError, userMessage } from "@/lib/errors";
import { storagePath, validateUpload } from "@/lib/files";
import { interestSchema, opportunitySchema, parseForm, proposalSchema, reportSchema, type ActionResult } from "@/lib/validation";
import type { Database } from "@/lib/database.types";

type Enums = Database["public"]["Enums"];
const uuid = z.uuid();

async function ctx() {
  const session = await getSession();
  const supabase = await createClient();
  return { session, supabase };
}

function files(fd: FormData, name = "files"): File[] {
  return fd.getAll(name).filter((f): f is File => f instanceof File && f.size > 0);
}

// ---------------------------------------------------------------------------
// Fournisseur : intérêt, réponse, pipeline
// ---------------------------------------------------------------------------

export async function expressInterest(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(interestSchema, fd);
  if (!parsed.success) return parsed.result;
  const { session, supabase } = await ctx();
  if (!session) return { ok: false, error: "Connectez-vous pour manifester votre intérêt." };
  if (!session.activeCompany) return { ok: false, error: "Créez d'abord le profil de votre entreprise." };
  const { error } = await supabase.rpc("express_interest", {
    p_opportunity_id: parsed.data.opportunityId,
    p_company_id: session.activeCompany.company.id,
    p_message: parsed.data.message,
  });
  if (error) return { ok: false, error: userMessage(error) };
  revalidatePath(`/opportunites/${parsed.data.opportunityId}`);
  return { ok: true, message: "Votre intérêt a été transmis au demandeur." };
}

export async function withdrawInterest(interestId: string, opportunityId: string): Promise<ActionResult> {
  if (!uuid.safeParse(interestId).success) return { ok: false, error: "Identifiant invalide." };
  const { supabase } = await ctx();
  const { error } = await supabase.rpc("withdraw_interest", { p_interest_id: interestId });
  if (error) return { ok: false, error: userMessage(error) };
  revalidatePath(`/opportunites/${opportunityId}`);
  revalidatePath("/dashboard/opportunites");
  return { ok: true, message: "Intérêt retiré." };
}

export async function submitProposal(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(proposalSchema, fd);
  if (!parsed.success) return parsed.result;
  const { session, supabase } = await ctx();
  if (!session) return { ok: false, error: "Connectez-vous pour répondre." };
  if (!session.activeCompany) return { ok: false, error: "Créez d'abord le profil de votre entreprise." };

  const uploads = files(fd);
  if (uploads.length > 5) return { ok: false, error: "5 pièces jointes maximum." };
  const validated = [];
  for (const f of uploads) {
    const v = await validateUpload(f);
    if (!v.ok) return { ok: false, error: v.error, fieldErrors: { files: v.error } };
    validated.push(v.file);
  }

  const d = parsed.data;
  const { data: proposalId, error } = await supabase.rpc("submit_proposal", {
    p_opportunity_id: d.opportunityId,
    p_company_id: session.activeCompany.company.id,
    p_message: d.message,
    p_proposal_text: d.proposalText,
    p_price_amount: d.priceAmount,
    p_price_details: d.priceDetails,
    p_lead_time: d.leadTime,
    p_valid_until: d.validUntil,
    p_additional_info: d.additionalInfo,
  });
  if (error || !proposalId) return { ok: false, error: userMessage(error) };

  for (const f of validated) {
    const path = storagePath(proposalId, f.name);
    const { error: upErr } = await supabase.storage.from("proposal-documents").upload(path, f.bytes, { contentType: f.mime });
    if (upErr) {
      logServerError("proposal upload", upErr);
      return { ok: false, error: "Votre réponse est enregistrée mais un document n'a pas pu être envoyé. Réessayez depuis votre espace." };
    }
    await supabase.rpc("register_proposal_document", {
      p_proposal_id: proposalId,
      p_storage_path: path,
      p_file_name: f.name,
      p_mime_type: f.mime,
      p_size_bytes: f.size,
    });
  }
  revalidatePath(`/opportunites/${d.opportunityId}`);
  redirect(`/opportunites/${d.opportunityId}?reponse=envoyee`);
}

export async function withdrawProposal(proposalId: string, opportunityId: string): Promise<ActionResult> {
  if (!uuid.safeParse(proposalId).success) return { ok: false, error: "Identifiant invalide." };
  const { supabase } = await ctx();
  const { error } = await supabase.rpc("withdraw_proposal", { p_proposal_id: proposalId });
  if (error) return { ok: false, error: userMessage(error) };
  revalidatePath(`/opportunites/${opportunityId}`);
  revalidatePath("/dashboard/opportunites");
  return { ok: true, message: "Réponse retirée." };
}

/** Ajoute une opportunité (interne ou externe) au pipeline privé de l'entreprise. */
export async function trackInPipeline(opportunityId: string): Promise<ActionResult> {
  if (!uuid.safeParse(opportunityId).success) return { ok: false, error: "Identifiant invalide." };
  const { session, supabase } = await ctx();
  if (!session) return { ok: false, error: "Connectez-vous pour suivre cette opportunité." };
  if (!session.activeCompany) return { ok: false, error: "Créez d'abord le profil de votre entreprise." };
  const { error } = await supabase.from("pipeline_items").upsert(
    { company_id: session.activeCompany.company.id, opportunity_id: opportunityId, stage: "DETECTED", updated_by: session.userId },
    { onConflict: "company_id,opportunity_id", ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: userMessage(error) };
  revalidatePath("/dashboard/pipeline");
  return { ok: true, message: "Ajoutée à votre pipeline." };
}

const pipelineUpdateSchema = z.object({
  id: z.uuid(),
  stage: z.enum(["DETECTED", "QUALIFIED", "INTERESTED", "RESPONSE_PREPARING", "RESPONSE_SENT", "DISCUSSION", "NEGOTIATION", "WON", "LOST"]),
  notes: z.string().max(5000).optional(),
  nextAction: z.string().max(300).optional(),
  nextActionAt: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  estimatedValue: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().min(0).max(1e10).optional()),
});

export async function updatePipelineItem(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(pipelineUpdateSchema, fd);
  if (!parsed.success) return parsed.result;
  const { session, supabase } = await ctx();
  if (!session) return { ok: false, error: "Session expirée." };
  const d = parsed.data;
  const patch: Database["public"]["Tables"]["pipeline_items"]["Update"] = { stage: d.stage, updated_by: session.userId };
  if (fd.has("notes")) patch.notes = d.notes?.trim() || null;
  if (fd.has("nextAction")) patch.next_action = d.nextAction?.trim() || null;
  if (fd.has("nextActionAt")) patch.next_action_at = d.nextActionAt ?? null;
  if (fd.has("estimatedValue")) patch.estimated_value = d.estimatedValue ?? null;
  const { error } = await supabase.from("pipeline_items").update(patch).eq("id", d.id);
  if (error) return { ok: false, error: userMessage(error) };
  revalidatePath("/dashboard/pipeline");
  revalidatePath("/dashboard");
  return { ok: true, message: "Pipeline mis à jour." };
}

export async function movePipelineItem(id: string, stage: Enums["pipeline_stage"]): Promise<ActionResult> {
  const fd = new FormData();
  fd.set("id", id);
  fd.set("stage", stage);
  return updatePipelineItem(null, fd);
}

export async function removePipelineItem(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Identifiant invalide." };
  const { supabase } = await ctx();
  const { error } = await supabase.from("pipeline_items").delete().eq("id", id);
  if (error) return { ok: false, error: userMessage(error) };
  revalidatePath("/dashboard/pipeline");
  return { ok: true, message: "Retirée du pipeline." };
}

// ---------------------------------------------------------------------------
// Signalement
// ---------------------------------------------------------------------------
export async function createReport(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(reportSchema, fd);
  if (!parsed.success) return parsed.result;
  const { session, supabase } = await ctx();
  if (!session) return { ok: false, error: "Connectez-vous pour signaler un contenu." };
  const { error } = await supabase.rpc("create_report", {
    p_target_type: parsed.data.targetType,
    p_target_id: parsed.data.targetId,
    p_reason: parsed.data.reason,
    p_details: parsed.data.details ?? "",
  });
  if (error) return { ok: false, error: userMessage(error) };
  return { ok: true, message: "Merci, votre signalement a été transmis à l'équipe de modération." };
}

// ---------------------------------------------------------------------------
// Demandeur : création, édition, publication
// ---------------------------------------------------------------------------

function toRow(d: z.output<typeof opportunitySchema>) {
  return {
    type: d.type,
    title: d.title,
    summary: d.summary ?? null,
    description: d.description,
    sector_slug: d.sector,
    city: d.city ?? null,
    postal_code: d.postalCode ?? null,
    department_code: d.departmentCode ?? null,
    budget_min: d.budgetMin ?? null,
    budget_max: d.budgetMax ?? null,
    budget_visible: d.budgetVisible,
    start_date: d.startDate ?? null,
    response_deadline: d.responseDeadline ? new Date(`${d.responseDeadline}T23:59:00+02:00`).toISOString() : null,
    skills: d.skills,
    services: d.services ?? null,
    constraints: d.constraints ?? null,
    criteria: d.criteria ?? null,
    max_suppliers: d.maxSuppliers ?? null,
    visibility: d.visibility,
    target_company_size: d.targetCompanySize ?? null,
    keywords: d.keywords,
    contact_name: d.contactName ?? null,
    publisher_attested_at: d.attest ? new Date().toISOString() : null,
  };
}

async function uploadOpportunityDocs(supabase: Awaited<ReturnType<typeof createClient>>, opportunityId: string, userId: string, fd: FormData): Promise<string | null> {
  const uploads = files(fd);
  if (uploads.length === 0) return null;
  const { count } = await supabase.from("opportunity_documents").select("id", { count: "exact", head: true }).eq("opportunity_id", opportunityId);
  if ((count ?? 0) + uploads.length > 10) return "10 documents maximum par opportunité.";
  for (const f of uploads) {
    const v = await validateUpload(f);
    if (!v.ok) return v.error;
    const path = storagePath(opportunityId, v.file.name);
    const { error } = await supabase.storage.from("opportunity-documents").upload(path, v.file.bytes, { contentType: v.file.mime });
    if (error) {
      logServerError("opportunity upload", error);
      return "Un document n'a pas pu être envoyé.";
    }
    const { error: insErr } = await supabase.from("opportunity_documents").insert({
      opportunity_id: opportunityId,
      storage_path: path,
      file_name: v.file.name,
      mime_type: v.file.mime,
      size_bytes: v.file.size,
      uploaded_by: userId,
    });
    if (insErr) return userMessage(insErr);
  }
  return null;
}

export async function createOpportunity(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(opportunitySchema, fd);
  if (!parsed.success) return parsed.result;
  const { session, supabase } = await ctx();
  if (!session) return { ok: false, error: "Connectez-vous pour publier." };
  if (!session.activeCompany) return { ok: false, error: "Créez d'abord le profil de votre entreprise." };
  const d = parsed.data;
  const { data, error } = await supabase
    .from("opportunities")
    .insert({ ...toRow(d), company_id: session.activeCompany.company.id, status: d.intent === "submit" ? "PENDING_REVIEW" : "DRAFT" })
    .select("id")
    .single();
  if (error || !data) {
    logServerError("createOpportunity", error);
    return { ok: false, error: userMessage(error) };
  }
  const uploadError = await uploadOpportunityDocs(supabase, data.id, session.userId, fd);
  revalidatePath("/dashboard/opportunites");
  redirect(`/dashboard/opportunites/${data.id}?${uploadError ? `erreur=${encodeURIComponent(uploadError)}` : `cree=${d.intent}`}`);
}

export async function updateOpportunity(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = String(fd.get("id") ?? "");
  if (!uuid.safeParse(id).success) return { ok: false, error: "Identifiant invalide." };
  const parsed = parseForm(opportunitySchema, fd);
  if (!parsed.success) return parsed.result;
  const { session, supabase } = await ctx();
  if (!session) return { ok: false, error: "Session expirée." };
  const { data: current } = await supabase.from("opportunities").select("status").eq("id", id).maybeSingle();
  if (!current) return { ok: false, error: "Opportunité introuvable." };
  const d = parsed.data;
  let status = current.status;
  if (d.intent === "submit" && ["DRAFT", "CHANGES_REQUESTED"].includes(current.status)) status = "PENDING_REVIEW";
  const { error } = await supabase.from("opportunities").update({ ...toRow(d), status }).eq("id", id);
  if (error) return { ok: false, error: userMessage(error) };
  const uploadError = await uploadOpportunityDocs(supabase, id, session.userId, fd);
  revalidatePath(`/dashboard/opportunites/${id}`);
  revalidatePath(`/opportunites/${id}`);
  redirect(`/dashboard/opportunites/${id}?${uploadError ? `erreur=${encodeURIComponent(uploadError)}` : "modifie=1"}`);
}

const statusChange = z.object({ id: z.uuid(), to: z.enum(["PENDING_REVIEW", "DRAFT", "ARCHIVED"]) });

/** Changements de statut autorisés au demandeur (contrôlés aussi en base). */
export async function changeOpportunityStatus(id: string, to: "PENDING_REVIEW" | "DRAFT" | "ARCHIVED"): Promise<ActionResult> {
  const parsed = statusChange.safeParse({ id, to });
  if (!parsed.success) return { ok: false, error: "Requête invalide." };
  const { supabase } = await ctx();
  if (to === "PENDING_REVIEW") {
    const { data } = await supabase.from("opportunities").select("publisher_attested_at").eq("id", id).maybeSingle();
    if (!data?.publisher_attested_at) {
      await supabase.from("opportunities").update({ publisher_attested_at: new Date().toISOString() }).eq("id", id);
    }
  }
  const { error } = await supabase.from("opportunities").update({ status: to }).eq("id", id);
  if (error) return { ok: false, error: userMessage(error) };
  revalidatePath(`/dashboard/opportunites/${id}`);
  revalidatePath("/dashboard/opportunites");
  const labels = { PENDING_REVIEW: "Envoyée en validation.", DRAFT: "Repassée en brouillon.", ARCHIVED: "Archivée." };
  return { ok: true, message: labels[to] };
}

export async function deleteDraft(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Identifiant invalide." };
  const { supabase } = await ctx();
  const { data: docs } = await supabase.from("opportunity_documents").select("storage_path").eq("opportunity_id", id);
  const { error } = await supabase.from("opportunities").delete().eq("id", id).eq("status", "DRAFT");
  if (error) return { ok: false, error: userMessage(error) };
  if (docs?.length) await supabase.storage.from("opportunity-documents").remove(docs.map((d) => d.storage_path));
  revalidatePath("/dashboard/opportunites");
  redirect("/dashboard/opportunites?supprime=1");
}

export async function deleteOpportunityDocument(docId: string, opportunityId: string): Promise<ActionResult> {
  if (!uuid.safeParse(docId).success) return { ok: false, error: "Identifiant invalide." };
  const { supabase } = await ctx();
  const { data: doc } = await supabase.from("opportunity_documents").select("storage_path").eq("id", docId).maybeSingle();
  if (!doc) return { ok: false, error: "Document introuvable." };
  const { error } = await supabase.from("opportunity_documents").delete().eq("id", docId);
  if (error) return { ok: false, error: userMessage(error) };
  await supabase.storage.from("opportunity-documents").remove([doc.storage_path]);
  revalidatePath(`/dashboard/opportunites/${opportunityId}`);
  return { ok: true, message: "Document supprimé." };
}

const closeSchema = z.object({
  id: z.uuid(),
  outcome: z.enum(["AWARDED", "NOT_AWARDED", "CANCELLED", "UNKNOWN"]),
  selectedProposalId: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
  note: z.string().max(2000).optional(),
});

export async function closeOpportunity(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(closeSchema, fd);
  if (!parsed.success) return parsed.result;
  const { supabase } = await ctx();
  const d = parsed.data;
  if (d.outcome === "AWARDED" && !d.selectedProposalId) {
    return { ok: false, error: "Sélectionnez la réponse retenue.", fieldErrors: { selectedProposalId: "Obligatoire si la consultation est attribuée" } };
  }
  const { error } = await supabase.rpc("close_opportunity", {
    p_opportunity_id: d.id,
    p_outcome: d.outcome,
    p_selected_proposal_id: d.outcome === "AWARDED" ? d.selectedProposalId : undefined,
    p_note: d.note ?? "",
  });
  if (error) return { ok: false, error: userMessage(error) };
  revalidatePath(`/dashboard/opportunites/${d.id}`);
  return { ok: true, message: "Consultation clôturée. Les fournisseurs ayant répondu ont été informés." };
}

// ---------------------------------------------------------------------------
// Demandeur : traitement des intérêts et réponses
// ---------------------------------------------------------------------------
const decisionSchema = z.object({
  targetId: z.uuid(),
  opportunityId: z.uuid(),
  kind: z.enum(["interest", "proposal"]),
  status: z.enum(["PENDING", "SUBMITTED", "SHORTLISTED", "INFO_REQUESTED", "ACCEPTED", "DECLINED", "SELECTED"]),
  message: z.string().max(2000).optional(),
});

export async function buyerDecision(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(decisionSchema, fd);
  if (!parsed.success) return parsed.result;
  const { supabase } = await ctx();
  const d = parsed.data;
  const { error } =
    d.kind === "interest"
      ? await supabase.rpc("buyer_set_interest_status", {
          p_interest_id: d.targetId,
          p_status: d.status as Enums["interest_status"],
          p_message: d.message ?? "",
        })
      : await supabase.rpc("buyer_set_proposal_status", {
          p_proposal_id: d.targetId,
          p_status: d.status as Enums["proposal_status"],
          p_message: d.message ?? "",
        });
  if (error) return { ok: false, error: userMessage(error) };
  revalidatePath(`/dashboard/opportunites/${d.opportunityId}`);
  return { ok: true, message: "Décision enregistrée. Le fournisseur a été notifié." };
}

const evaluationSchema = z.object({
  proposalId: z.uuid(),
  opportunityId: z.uuid(),
  score: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().int().min(0).max(5).optional()),
  note: z.string().max(5000).optional(),
});

export async function saveEvaluation(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(evaluationSchema, fd);
  if (!parsed.success) return parsed.result;
  const { supabase } = await ctx();
  const d = parsed.data;
  const { error } = await supabase.rpc("save_proposal_evaluation", { p_proposal_id: d.proposalId, p_score: (d.score ?? null) as unknown as number, p_note: d.note ?? "" });
  if (error) return { ok: false, error: userMessage(error) };
  revalidatePath(`/dashboard/opportunites/${d.opportunityId}`);
  return { ok: true, message: "Évaluation enregistrée (visible uniquement par votre entreprise)." };
}
