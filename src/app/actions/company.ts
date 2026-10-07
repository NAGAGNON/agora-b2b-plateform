"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVE_COMPANY_COOKIE, getSession } from "@/lib/auth";
import { logServerError, actionError } from "@/lib/errors";
import { storagePath, validateUpload } from "@/lib/files";
import { ALLOWED_LOGO_TYPES, MAX_LOGO_BYTES } from "@/lib/constants";
import { companyProfileSchema, companySchema, emailSchema, parseForm, userProfileSchema, type ActionResult } from "@/lib/validation";

function safeNext(v: FormDataEntryValue | null, fallback: string) {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}

export async function createCompany(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(companySchema, fd);
  if (!parsed.success) return parsed.result;
  const session = await getSession();
  if (!session) return { ok: false, error: "Session expirée, reconnectez-vous." };
  const supabase = await createClient();
  const d = parsed.data;
  const { data: companyId, error } = await supabase.rpc("create_company", {
    p_name: d.name,
    p_kind: d.kind,
    p_size: d.size,
    p_city: d.city,
    p_postal_code: d.postalCode,
    p_siren: d.siren,
    p_website: d.website,
    p_tagline: d.tagline,
    p_description: d.description,
    p_sectors: d.sectors,
    p_skills: d.skills,
  });
  if (error || !companyId) return actionError(error);
  (await cookies()).set(ACTIVE_COMPANY_COOKIE, companyId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  revalidatePath("/", "layout");
  redirect(safeNext(fd.get("suite"), "/dashboard?bienvenue=1"));
}

export async function switchCompany(companyId: string) {
  const session = await getSession();
  if (!session || !session.memberships.some((m) => m.company.id === companyId)) return;
  (await cookies()).set(ACTIVE_COMPANY_COOKIE, companyId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  revalidatePath("/", "layout");
}

export async function updateCompanyProfile(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(companyProfileSchema, fd);
  if (!parsed.success) return parsed.result;
  const session = await getSession();
  const company = session?.activeCompany;
  if (!company) return { ok: false, error: "Aucune entreprise active." };
  if (company.role !== "COMPANY_ADMIN") return { ok: false, error: "Seul un administrateur de l'entreprise peut modifier le profil." };
  const supabase = await createClient();
  const d = parsed.data;
  const { error: e1 } = await supabase
    .from("companies")
    .update({
      name: d.name,
      kind: d.kind,
      size: d.size ?? null,
      city: d.city ?? null,
      postal_code: d.postalCode ?? null,
      department_code: d.departmentCode ?? null,
      siren: d.siren ?? null,
      website: d.website ?? null,
    })
    .eq("id", company.company.id);
  if (e1) return actionError(e1);
  const { error: e2 } = await supabase
    .from("company_profiles")
    .update({
      tagline: d.tagline ?? null,
      description: d.description ?? null,
      sectors: d.sectors,
      skills: d.skills,
      intervention_zone: d.interventionZone ?? null,
      intervention_radius_km: d.interventionRadiusKm ?? null,
      certifications: d.certifications,
      references_text: d.referencesText ?? null,
      employees_range: d.employeesRange ?? null,
      founded_year: d.foundedYear ?? null,
      contact_email: d.contactEmail ?? null,
      contact_phone: d.contactPhone ?? null,
      is_public: d.isPublic,
    })
    .eq("company_id", company.company.id);
  if (e2) return actionError(e2);

  const logo = fd.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const v = await validateUpload(logo, { allowed: ALLOWED_LOGO_TYPES, maxBytes: MAX_LOGO_BYTES });
    if (!v.ok) return { ok: false, error: v.error, fieldErrors: { logo: v.error } };
    const path = storagePath(company.company.id, v.file.name);
    const { error: upErr } = await supabase.storage.from("company-logos").upload(path, v.file.bytes, { contentType: v.file.mime });
    if (upErr) {
      logServerError("logo upload", upErr);
      return { ok: false, error: "Le logo n'a pas pu être envoyé." };
    }
    const { data: prev } = await supabase.from("companies").select("logo_path").eq("id", company.company.id).single();
    await supabase.from("companies").update({ logo_path: path }).eq("id", company.company.id);
    if (prev?.logo_path) await supabase.storage.from("company-logos").remove([prev.logo_path]);
  }

  if (d.description && d.sectors.length && d.skills.length) {
    await supabase.rpc("track_event", { p_event_name: "profile_completed" });
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Profil de l'entreprise enregistré." };
}

const inviteSchema = z.object({ email: emailSchema, role: z.enum(["COMPANY_MEMBER", "COMPANY_ADMIN"]) });

export async function inviteMember(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(inviteSchema, fd);
  if (!parsed.success) return parsed.result;
  const session = await getSession();
  if (!session?.activeCompany) return { ok: false, error: "Aucune entreprise active." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_company_member", {
    p_company_id: session.activeCompany.company.id,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error) return actionError(error);
  revalidatePath("/dashboard/entreprise");
  return {
    ok: true,
    message:
      data === "ADDED"
        ? "Cette personne a été ajoutée à votre entreprise."
        : "Invitation enregistrée : la personne rejoindra votre entreprise dès son inscription avec cette adresse.",
  };
}

export async function setMemberRole(memberId: string, role: "COMPANY_MEMBER" | "COMPANY_ADMIN"): Promise<ActionResult> {
  if (!z.uuid().safeParse(memberId).success) return { ok: false, error: "Identifiant invalide." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_company_member_role", { p_member_id: memberId, p_role: role });
  if (error) return actionError(error);
  revalidatePath("/dashboard/entreprise");
  return { ok: true, message: "Rôle mis à jour." };
}

export async function removeMember(memberId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(memberId).success) return { ok: false, error: "Identifiant invalide." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_company_member", { p_member_id: memberId });
  if (error) return actionError(error);
  revalidatePath("/", "layout");
  return { ok: true, message: "Membre retiré." };
}

export async function updateUserProfile(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(userProfileSchema, fd);
  if (!parsed.success) return parsed.result;
  const session = await getSession();
  if (!session) return { ok: false, error: "Session expirée." };
  const supabase = await createClient();
  const d = parsed.data;
  const { error } = await supabase
    .from("users")
    .update({ full_name: d.fullName, job_title: d.jobTitle ?? null, phone: d.phone ?? null, notify_email: d.notifyEmail, marketing_consent: d.marketingConsent })
    .eq("id", session.userId);
  if (error) return actionError(error);
  revalidatePath("/", "layout");
  return { ok: true, message: "Profil enregistré." };
}

/**
 * Suppression du compte (RGPD). Les entreprises dont l'utilisateur est l'unique
 * membre sont supprimées ; le compte d'authentification est ensuite supprimé
 * via l'API d'administration (clé serveur), ce qui efface les données liées.
 */
export async function deleteAccount(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  if (fd.get("confirm") !== "SUPPRIMER") return { ok: false, error: "Tapez SUPPRIMER pour confirmer.", fieldErrors: { confirm: "Saisie incorrecte" } };
  const session = await getSession();
  if (!session) return { ok: false, error: "Session expirée." };
  if (session.profile.platform_role === "SUPER_ADMIN") return { ok: false, error: "Un super administrateur ne peut pas supprimer son compte depuis cette page." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("prepare_account_deletion");
  if (error) return actionError(error);
  const { error: delErr } = await createAdminClient().auth.admin.deleteUser(session.userId);
  if (delErr) {
    logServerError("deleteUser", delErr);
    return { ok: false, error: "La suppression n'a pas pu aboutir. Contactez-nous." };
  }
  await supabase.auth.signOut();
  redirect("/?compte=supprime");
}
