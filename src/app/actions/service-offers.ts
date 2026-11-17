"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionError, logServerError } from "@/lib/errors";
import { flushEmailsAfterResponse } from "@/lib/email/flush";
import { parseForm, type ActionResult } from "@/lib/validation";
import { parisDay, serviceOfferSchema } from "@/lib/service-offers-core";

const refresh = (id?: string) => {
  revalidatePath("/disponibilites");
  revalidatePath("/dashboard/disponibilites");
  if (id) revalidatePath(`/disponibilites/${id}`);
};

/** Publie une nouvelle disponibilité, ou enregistre les modifications d'une disponibilité existante. */
export async function saveServiceOffer(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(serviceOfferSchema, fd);
  if (!parsed.success) return parsed.result;
  const session = await getSession();
  if (!session) return { ok: false, error: "Connectez-vous pour publier." };
  if (!session.activeCompany) return { ok: false, error: "Créez d'abord le profil de votre entreprise." };
  const id = String(fd.get("id") ?? "");
  const from = String(fd.get("from_opportunity_id") ?? "");
  const d = parsed.data;
  const row = {
    title: d.title,
    description: d.description,
    sector_slug: d.sector_slug,
    department_code: d.nationwide ? null : d.department_code,
    city: d.city,
    nationwide: d.nationwide,
    available_from: d.available_from,
    available_until: d.available_until,
    capacity: d.capacity,
  };
  const supabase = await createClient();
  if (id) {
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "Disponibilité introuvable." };
    const { error } = await supabase.from("service_offers").update(row).eq("id", id);
    if (error) return actionError(error);
    refresh(id);
    redirect(`/dashboard/disponibilites?modifiee=${id}`);
  }
  const { data, error } = await supabase
    .from("service_offers")
    .insert({ ...row, company_id: session.activeCompany.company.id, from_opportunity_id: z.uuid().safeParse(from).success ? from : null })
    .select("id")
    .single();
  if (error || !data) {
    if (error && error.code !== "22023" && error.code !== "P0429") logServerError("saveServiceOffer", error);
    return actionError(error);
  }
  refresh(data.id);
  redirect(`/disponibilites/${data.id}?publiee=1`);
}

/** Retirer (archiver), remettre en ligne ou prolonger une disponibilité de son entreprise. */
export async function setServiceOfferStatus(id: string, status: "PUBLISHED" | "ARCHIVED"): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Disponibilité introuvable." };
  const supabase = await createClient();
  const { data: offer } = await supabase.from("service_offers").select("available_until").eq("id", id).maybeSingle();
  if (!offer) return { ok: false, error: "Disponibilité introuvable." };
  // Remise en ligne d'une disponibilité dont la date de fin est passée : « jusqu'à nouvel ordre » (60 jours)
  const reset = status === "PUBLISHED" && offer.available_until && offer.available_until < parisDay() ? { available_until: null } : {};
  const { error } = await supabase.from("service_offers").update({ status, ...reset }).eq("id", id);
  if (error) return actionError(error);
  refresh(id);
  return { ok: true, message: status === "PUBLISHED" ? "Votre disponibilité est en ligne pour 60 jours." : "Votre disponibilité est retirée du site." };
}

const contactSchema = z.object({ offerId: z.uuid(), body: z.string().trim().min(10, "Votre message est trop court (10 caractères au moins).").max(5000) });

/** Contacter l'entreprise d'une disponibilité : la conversation s'ouvre dans la messagerie. */
export async function contactServiceOffer(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(contactSchema, fd);
  if (!parsed.success) return parsed.result;
  const session = await getSession();
  if (!session) return { ok: false, error: "Connectez-vous pour contacter cette entreprise." };
  if (!session.activeCompany) return { ok: false, error: "Créez d'abord le profil de votre entreprise." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("contact_service_offer", { p_offer_id: parsed.data.offerId, p_company_id: session.activeCompany.company.id, p_body: parsed.data.body });
  if (error || !data) return actionError(error);
  flushEmailsAfterResponse();
  redirect(`/dashboard/messages/${data}`);
}

/** Équipe : retirer une disponibilité (motif transmis à l'entreprise) ou la remettre en ligne. */
export async function moderateServiceOffer(id: string, action: "REMOVE" | "RESTORE", reason = ""): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.isStaff) return { ok: false, error: "Action réservée à l'équipe." };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Disponibilité introuvable." };
  if (action === "REMOVE" && reason.trim().length < 5) return { ok: false, error: "Indiquez le motif du retrait (il est transmis à l'entreprise)." };
  const db = createAdminClient();
  const { data: offer } = await db.from("service_offers").select("id, title, company_id").eq("id", id).maybeSingle();
  if (!offer) return { ok: false, error: "Disponibilité introuvable." };
  const { error } = await db
    .from("service_offers")
    .update(action === "REMOVE" ? { status: "REMOVED", removed_reason: reason.trim().slice(0, 500) } : { status: "PUBLISHED", removed_reason: null })
    .eq("id", id);
  if (error) return actionError(error);
  await db.from("audit_logs").insert({ action: action === "REMOVE" ? "service_offer.removed" : "service_offer.restored", entity_type: "service_offer", entity_id: id, actor_user_id: session.userId, metadata: { reason } });
  if (action === "REMOVE") {
    const { data: members } = await db.from("company_members").select("user_id").eq("company_id", offer.company_id);
    if (members?.length)
      await db.from("notifications").insert(
        members.map((m) => ({ user_id: m.user_id, type: "service_offer_removed", title: "Disponibilité retirée par la modération", body: `${offer.title} : ${reason.trim()}`.slice(0, 500), link: "/dashboard/disponibilites" })),
      );
  }
  refresh(id);
  revalidatePath("/admin/disponibilites");
  return { ok: true, message: action === "REMOVE" ? "Disponibilité retirée." : "Disponibilité remise en ligne." };
}

/**
 * Équipe : recatégoriser en disponibilité un « besoin » qui présente en fait les services de
 * l'entreprise (texte repris tel quel, besoin archivé sans rien supprimer, entreprise prévenue).
 */
export async function convertNeedToServiceOffer(opportunityId: string): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session?.isStaff) return { ok: false, error: "Action réservée à l'équipe." };
  if (!z.uuid().safeParse(opportunityId).success) return { ok: false, error: "Besoin introuvable." };
  const db = createAdminClient();
  const { data, error } = await db.rpc("convert_need_to_service_offer", { p_opportunity_id: opportunityId });
  if (error || !data) return actionError(error);
  flushEmailsAfterResponse();
  refresh(data);
  revalidatePath("/admin/disponibilites");
  revalidatePath("/opportunites");
  return { ok: true, message: "Recatégorisé en disponibilité.", data: { id: data } };
}
