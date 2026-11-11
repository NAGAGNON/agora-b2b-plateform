"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, requireAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logServerError } from "@/lib/errors";
import { parseForm, testimonialSchema, type ActionResult } from "@/lib/validation";

/**
 * Avis d'un membre connecté : un seul par membre, modifiable tant qu'il n'est pas publié. Il n'est
 * affiché sur le site qu'avec son accord (case non cochée par défaut) et après relecture par l'équipe.
 */
export async function submitTestimonial(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Connectez-vous pour donner votre avis." };
  const parsed = parseForm(testimonialSchema, fd);
  if (!parsed.success) return parsed.result;
  if (!(await rateLimit("testimonial", 5, 3600))) return { ok: false, error: "Trop d'envois. Réessayez dans une heure." };
  const d = parsed.data;
  const db = createAdminClient();
  const { data: existing } = await db.from("testimonials").select("id, status").eq("user_id", session.userId).maybeSingle();
  if (existing?.status === "APPROVED") return { ok: true, message: "Votre avis est déjà publié. Merci beaucoup !" };
  const row = {
    user_id: session.userId,
    company_id: session.activeCompany?.company.id ?? null,
    author_name: d.authorName,
    author_role: d.authorRole ?? null,
    company_name: d.companyName ?? session.activeCompany?.company.name ?? null,
    quote: d.quote ?? null,
    rating: d.rating ? Number(d.rating) : null,
    consent_publish: d.consent === "on",
    status: "PENDING",
    updated_at: new Date().toISOString(),
  };
  const { error } = existing ? await db.from("testimonials").update(row).eq("id", existing.id) : await db.from("testimonials").insert(row);
  if (error) {
    logServerError("testimonial", error);
    return { ok: false, error: "Votre avis n'a pas pu être enregistré. Réessayez plus tard." };
  }
  return {
    ok: true,
    message: row.consent_publish
      ? "Merci beaucoup ! Votre avis sera relu par l'équipe avant d'être affiché sur le site."
      : "Merci beaucoup ! Votre avis reste privé : il nous aide à améliorer LinkProB2B.",
  };
}

/** Relecture par l'équipe : publier (si l'auteur l'a accepté) ou écarter un avis. */
export async function reviewTestimonial(fd: FormData) {
  const session = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  const decision = String(fd.get("decision") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id) || !["APPROVED", "REJECTED", "PENDING"].includes(decision)) return;
  const db = createAdminClient();
  const { data: t } = await db.from("testimonials").select("consent_publish").eq("id", id).maybeSingle();
  // Jamais publié sans l'accord de son auteur
  if (!t || (decision === "APPROVED" && !t.consent_publish)) return;
  await db.from("testimonials").update({ status: decision, reviewed_at: new Date().toISOString(), reviewed_by: session.userId }).eq("id", id);
  revalidatePath("/admin/temoignages");
  revalidatePath("/");
}
