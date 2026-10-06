"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { userMessage } from "@/lib/errors";
import { processAlertDigests, processEmailOutbox } from "@/lib/email/outbox";
import { flushEmailsAfterResponse } from "@/lib/email/flush";
import { externalOpportunitySchema, moderationSchema, parseForm, sourceSchema, type ActionResult } from "@/lib/validation";
import type { Database, Json } from "@/lib/database.types";

type Enums = Database["public"]["Enums"];

async function staff() {
  const session = await getSession();
  if (!session?.isStaff) throw new Error("Accès refusé");
  return { session, supabase: await createClient() };
}

export async function moderateOpportunity(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(moderationSchema, fd);
  if (!parsed.success) return parsed.result;
  const { supabase } = await staff();
  const { error } = await supabase.rpc("moderate_opportunity", {
    p_opportunity_id: parsed.data.opportunityId,
    p_action: parsed.data.action,
    p_reason: parsed.data.reason ?? "",
  });
  if (error) return { ok: false, error: userMessage(error) };
  flushEmailsAfterResponse();
  revalidatePath("/admin", "layout");
  const labels: Record<string, string> = {
    APPROVE: "Opportunité publiée.",
    REJECT: "Publication refusée.",
    REQUEST_CHANGES: "Modifications demandées.",
    SUSPEND: "Opportunité suspendue.",
    ARCHIVE: "Opportunité archivée.",
    REINSTATE: "Opportunité rétablie.",
  };
  return { ok: true, message: labels[parsed.data.action] };
}

const dupSchema = z.object({ opportunityId: z.uuid(), duplicateOf: z.uuid({ error: "Identifiant de l'original invalide" }) });

export async function markDuplicate(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(dupSchema, fd);
  if (!parsed.success) return parsed.result;
  const { supabase } = await staff();
  const { error } = await supabase.rpc("mark_opportunity_duplicate", { p_opportunity_id: parsed.data.opportunityId, p_duplicate_of: parsed.data.duplicateOf });
  if (error) return { ok: false, error: userMessage(error) };
  revalidatePath("/admin/opportunites");
  return { ok: true, message: "Marquée comme doublon et archivée." };
}

export async function verifyExternal(opportunityId: string, status: "VERIFIED" | "UNVERIFIABLE" | "REMOVED_AT_SOURCE"): Promise<ActionResult> {
  if (!z.uuid().safeParse(opportunityId).success) return { ok: false, error: "Identifiant invalide." };
  const { supabase } = await staff();
  const { error } = await supabase.rpc("admin_verify_external_opportunity", { p_opportunity_id: opportunityId, p_verification_status: status });
  if (error) return { ok: false, error: userMessage(error) };
  revalidatePath("/admin/opportunites");
  return { ok: true, message: "Vérification enregistrée." };
}

const userStatusSchema = z.object({ userId: z.uuid(), status: z.enum(["ACTIVE", "SUSPENDED"]), reason: z.string().trim().min(3, "Motif obligatoire").max(1000) });

export async function setUserStatus(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(userStatusSchema, fd);
  if (!parsed.success) return parsed.result;
  const { supabase } = await staff();
  const { error } = await supabase.rpc("admin_set_user_status", { p_user_id: parsed.data.userId, p_status: parsed.data.status, p_reason: parsed.data.reason });
  if (error) return { ok: false, error: userMessage(error) };
  if (parsed.data.status === "SUSPENDED") {
    // Révoque les sessions actives de l'utilisateur suspendu.
    await createAdminClient().auth.admin.signOut(parsed.data.userId).catch(() => {});
  }
  revalidatePath("/admin/utilisateurs");
  return { ok: true, message: parsed.data.status === "SUSPENDED" ? "Utilisateur suspendu." : "Utilisateur réactivé." };
}

export async function setUserRole(userId: string, role: Enums["platform_role"]): Promise<ActionResult> {
  if (!z.uuid().safeParse(userId).success) return { ok: false, error: "Identifiant invalide." };
  const { supabase } = await staff();
  const { error } = await supabase.rpc("admin_set_user_role", { p_user_id: userId, p_role: role });
  if (error) return { ok: false, error: userMessage(error) };
  revalidatePath("/admin/utilisateurs");
  return { ok: true, message: "Rôle mis à jour." };
}

const companyStatusSchema = z.object({ companyId: z.uuid(), status: z.enum(["ACTIVE", "SUSPENDED"]), reason: z.string().trim().min(3, "Motif obligatoire").max(1000) });

export async function setCompanyStatus(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(companyStatusSchema, fd);
  if (!parsed.success) return parsed.result;
  const { supabase } = await staff();
  const { error } = await supabase.rpc("admin_set_company_status", { p_company_id: parsed.data.companyId, p_status: parsed.data.status, p_reason: parsed.data.reason });
  if (error) return { ok: false, error: userMessage(error) };
  revalidatePath("/admin/entreprises");
  return { ok: true, message: "Statut de l'entreprise mis à jour." };
}

const verifySchema = z.object({ companyId: z.uuid(), verified: z.enum(["true", "false"]), note: z.string().max(1000).optional() });

export async function verifyCompany(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(verifySchema, fd);
  if (!parsed.success) return parsed.result;
  const { supabase } = await staff();
  const { error } = await supabase.rpc("admin_verify_company", {
    p_company_id: parsed.data.companyId,
    p_verified: parsed.data.verified === "true",
    p_note: parsed.data.note ?? "",
  });
  if (error) return { ok: false, error: userMessage(error) };
  revalidatePath("/admin/entreprises");
  return { ok: true, message: parsed.data.verified === "true" ? "Entreprise marquée comme vérifiée." : "Vérification retirée." };
}

const reportSchema = z.object({ reportId: z.uuid(), status: z.enum(["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"]), note: z.string().max(2000).optional() });

export async function resolveReport(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(reportSchema, fd);
  if (!parsed.success) return parsed.result;
  const { supabase } = await staff();
  const { error } = await supabase.rpc("resolve_report", { p_report_id: parsed.data.reportId, p_status: parsed.data.status, p_note: parsed.data.note ?? "" });
  if (error) return { ok: false, error: userMessage(error) };
  revalidatePath("/admin/signalements");
  return { ok: true, message: "Signalement mis à jour." };
}

export async function markContactHandled(id: string) {
  if (!z.uuid().safeParse(id).success) return;
  await staff();
  // Table sans droit d'écriture côté client : mise à jour via la clé serveur après contrôle du rôle.
  await createAdminClient().from("contact_messages").update({ handled: true }).eq("id", id);
  revalidatePath("/admin/signalements");
}

export async function upsertSource(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(sourceSchema, fd);
  if (!parsed.success) return parsed.result;
  const { supabase } = await staff();
  const d = parsed.data;
  const { error } = await supabase.rpc("admin_upsert_external_source", {
    p_id: (d.id ?? null) as unknown as string,
    p_name: d.name,
    p_base_url: d.baseUrl ?? "",
    p_description: d.description ?? "",
    p_license: d.license ?? "",
    p_terms_url: d.termsUrl ?? "",
    p_status: d.status,
    p_import_method: d.importMethod,
    p_notes: d.notes ?? "",
    p_legal_validation_confirmed: d.legalConfirmed,
  });
  if (error) return { ok: false, error: userMessage(error) };
  revalidatePath("/admin/sources");
  return { ok: true, message: "Source enregistrée." };
}

export async function createExternalOpportunity(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(externalOpportunitySchema, fd);
  if (!parsed.success) return parsed.result;
  const { supabase } = await staff();
  const d = parsed.data;
  const { data, error } = await supabase.rpc("admin_create_external_opportunity", {
    p_source_id: d.sourceId,
    p_type: d.type,
    p_title: d.title,
    p_summary: d.summary ?? "",
    p_description: d.description,
    p_external_buyer_name: d.externalBuyerName ?? "",
    p_sector_slug: d.sector,
    p_city: d.city ?? "",
    p_department_code: (d.departmentCode ?? null) as unknown as string,
    p_response_deadline: (d.responseDeadline ? new Date(`${d.responseDeadline}T23:59:00+02:00`).toISOString() : null) as unknown as string,
    p_original_url: d.originalUrl,
    p_external_id: d.externalId ?? "",
    p_source_published_at: (d.sourcePublishedAt ?? null) as unknown as string,
  });
  if (error || !data) return { ok: false, error: userMessage(error) };
  revalidatePath("/admin/opportunites");
  redirect(`/opportunites/${data}`);
}

const settingSchema = z.object({ key: z.enum(["moderation", "demo", "registrations", "security", "pilot"]), value: z.string().max(2000) });

export async function updateSetting(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(settingSchema, fd);
  if (!parsed.success) return parsed.result;
  const { supabase } = await staff();
  let value: Json;
  try {
    value = JSON.parse(parsed.data.value);
  } catch {
    return { ok: false, error: "Valeur JSON invalide." };
  }
  const { error } = await supabase.rpc("admin_update_setting", { p_key: parsed.data.key, p_value: value });
  if (error) return { ok: false, error: userMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Paramètre enregistré." };
}

/** Lance manuellement les traitements planifiés (expiration, alertes, e-mails). */
export async function runMaintenance(): Promise<ActionResult> {
  const { session } = await staff();
  if (!session.isAdmin) return { ok: false, error: "Réservé aux administrateurs." };
  const admin = createAdminClient();
  const { data: expired } = await admin.rpc("expire_opportunities");
  const digests = await processAlertDigests();
  const mails = await processEmailOutbox(100);
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message: `${expired ?? 0} opportunité(s) expirée(s) · ${digests.emails} résumé(s) d'alerte · e-mails : ${mails.sent} envoyé(s), ${mails.skipped} non envoyé(s) (aucun fournisseur configuré), ${mails.failed} en échec.`,
  };
}
