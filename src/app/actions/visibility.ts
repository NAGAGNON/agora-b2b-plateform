"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompany, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { DAILY_OPTIONS, DURATION_OPTIONS, FEATURED_OPTIONS, boostPrice, type Daily, type Duration, type Featured } from "@/lib/visibility";
import type { ActionResult } from "@/lib/validation";

const schema = z
  .object({
    target: z.string().min(1),
    daily: z.coerce.number().refine((v) => (DAILY_OPTIONS as readonly number[]).includes(v), "Choix invalide"),
    featured: z.coerce.number().refine((v) => (FEATURED_OPTIONS as readonly number[]).includes(v), "Choix invalide"),
    duration: z.coerce.number().refine((v) => (DURATION_OPTIONS as readonly number[]).includes(v), "Choix invalide"),
  })
  .refine((v) => v.daily > 0 || v.featured > 0, { message: "Choisissez au moins des présentations ou une mise en avant." });

/** Demande de visibilité (administrateur de l'entreprise), validée ensuite par l'équipe avant tout démarrage. */
export async function requestBoost(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = schema.safeParse({ target: fd.get("target"), daily: fd.get("daily"), featured: fd.get("featured"), duration: fd.get("duration") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Choix invalide." };
  const session = await requireCompany("/dashboard/visibilite");
  if (session.activeCompany.role !== "COMPANY_ADMIN") return { ok: false, error: "Seul un administrateur de l'entreprise peut faire cette demande." };
  if (!(await rateLimit("visibility-request", 10, 3600))) return { ok: false, error: "Trop de demandes. Réessayez plus tard." };
  const { target, daily, featured, duration } = parsed.data;
  const need = target !== "COMPANY";
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_visibility_boost", {
    p_company_id: session.activeCompany.company.id,
    p_target: need ? "NEED" : "COMPANY",
    p_opportunity_id: need ? target : null,
    p_daily: daily,
    p_featured_days: featured,
    p_duration_days: duration,
    p_price_ht: boostPrice(daily as Daily, featured as Featured, duration as Duration),
  });
  if (error) {
    if (error.code === "P0001") return { ok: false, error: error.message };
    logServerError("visibility request", error);
    return { ok: false, error: "La demande n'a pas pu être enregistrée. Réessayez dans quelques instants." };
  }
  revalidatePath("/dashboard/visibilite");
  return { ok: true, message: "Demande envoyée : l'équipe la valide sous 24 h ouvrées, puis elle démarre automatiquement." };
}

export async function cancelBoost(id: string): Promise<ActionResult> {
  await requireCompany("/dashboard/visibilite");
  const { error } = await (await createClient()).rpc("cancel_visibility_boost", { p_id: id });
  if (error) return { ok: false, error: error.code === "P0001" ? error.message : "Annulation impossible pour le moment." };
  revalidatePath("/dashboard/visibilite");
  return { ok: true, message: "Demande annulée." };
}

/** Validation ou refus par l'équipe. */
export async function reviewBoost(id: string, approve: boolean, note?: string): Promise<ActionResult> {
  await requireStaff();
  const { error } = await (await createClient()).rpc("review_visibility_boost", { p_id: id, p_approve: approve, p_note: note?.trim() || null });
  if (error) return { ok: false, error: error.code === "P0001" || error.code === "42501" ? error.message : "Action impossible pour le moment." };
  revalidatePath("/admin/visibilite");
  return { ok: true, message: approve ? "Offre démarrée." : "Demande refusée." };
}
