"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVE_COMPANY_COOKIE, getSession } from "@/lib/auth";
import { logServerError, actionError } from "@/lib/errors";
import { safeInternalPath } from "@/lib/safe-path";
import { storagePath, validateUpload } from "@/lib/files";
import { autoLogoFor } from "@/lib/company-logos";
import { ALLOWED_LOGO_TYPES, MAX_LOGO_BYTES } from "@/lib/constants";
import { companyProfileSchema, companySchema, emailSchema, parseForm, userProfileSchema, type ActionResult } from "@/lib/validation";

const safeNext = (v: FormDataEntryValue | null, fallback: string) => safeInternalPath(v, fallback);

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
  fetchLogoAfterResponse(companyId);
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
    const saved = await saveLogo(supabase, company.company.id, logo);
    if (!saved.ok) return saved;
  }

  // Pas de logo : recherche sur le site de l'entreprise (une fois par adresse de site)
  fetchLogoAfterResponse(company.company.id);

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

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Enregistre un nouveau logo puis supprime l'ancien fichier. */
async function saveLogo(supabase: Supabase, companyId: string, logo: File): Promise<ActionResult> {
  const v = await validateUpload(logo, { allowed: ALLOWED_LOGO_TYPES, maxBytes: MAX_LOGO_BYTES });
  if (!v.ok) return { ok: false, error: v.error, fieldErrors: { logo: v.error } };
  const path = storagePath(companyId, v.file.name);
  const { error: upErr } = await supabase.storage.from("company-logos").upload(path, v.file.bytes, { contentType: v.file.mime });
  if (upErr) {
    logServerError("logo upload", upErr);
    return { ok: false, error: "Le logo n'a pas pu être envoyé." };
  }
  const { data: prev } = await supabase.from("companies").select("logo_path").eq("id", companyId).single();
  const { error } = await supabase.from("companies").update({ logo_path: path }).eq("id", companyId);
  if (error) return actionError(error);
  if (prev?.logo_path) await supabase.storage.from("company-logos").remove([prev.logo_path]);
  await createAdminClient().from("companies").update({ logo_source: null }).eq("id", companyId);
  return { ok: true, message: "Logo enregistré. Il apparaît sur votre fiche, dans l'annuaire et sur vos opportunités." };
}

async function logoAdmin(): Promise<{ companyId: string } | { error: string }> {
  const session = await getSession();
  const company = session?.activeCompany;
  if (!company) return { error: "Aucune entreprise active." };
  if (company.role !== "COMPANY_ADMIN") return { error: "Seul un administrateur de l'entreprise peut modifier le logo." };
  return { companyId: company.company.id };
}

/** Ajout ou remplacement du logo (bloc « Logo » de l'espace entreprise). */
export async function updateCompanyLogo(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const who = await logoAdmin();
  if ("error" in who) return { ok: false, error: who.error };
  const logo = fd.get("logo");
  if (!(logo instanceof File) || logo.size === 0) return { ok: false, error: "Choisissez une image.", fieldErrors: { logo: "Choisissez une image." } };
  const r = await saveLogo(await createClient(), who.companyId, logo);
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

/** Retire le logo (les initiales de l'entreprise s'affichent à la place). */
export async function removeCompanyLogo(): Promise<ActionResult> {
  const who = await logoAdmin();
  if ("error" in who) return { ok: false, error: who.error };
  const supabase = await createClient();
  const { data: prev } = await supabase.from("companies").select("logo_path").eq("id", who.companyId).single();
  if (!prev?.logo_path) return { ok: true, message: "Aucun logo à retirer." };
  const { error } = await supabase.from("companies").update({ logo_path: null }).eq("id", who.companyId);
  if (error) return actionError(error);
  // Retrait volontaire : le logo n'est plus recherché automatiquement sur le site
  const { data: c } = await supabase.from("companies").select("website").eq("id", who.companyId).single();
  await createAdminClient().from("companies").update({ logo_source: null, logo_auto_checked_at: new Date().toISOString(), logo_auto_site: c?.website ?? "", logo_auto_note: "Logo retiré par l'entreprise" }).eq("id", who.companyId);
  await supabase.storage.from("company-logos").remove([prev.logo_path]);
  revalidatePath("/", "layout");
  return { ok: true, message: "Logo retiré." };
}

function fetchLogoAfterResponse(companyId: string) {
  after(async () => {
    try {
      await autoLogoFor(createAdminClient(), companyId);
    } catch (e) {
      logServerError("auto logo", e);
    }
  });
}
