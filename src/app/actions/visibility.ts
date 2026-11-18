"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompany, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { AD_LIMITS, DAILY_OPTIONS, DURATION_OPTIONS, FEATURED_OPTIONS, OBJECTIVES, adIssues, boostPriceWithIncluded, type Daily, type Duration, type Featured } from "@/lib/visibility";
import { includedPresentationsLeft } from "@/lib/visibility-credit";
import { SECTOR_PROFILES } from "@/lib/outreach/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/validation";

const schema = z
  .object({
    target: z.string().min(1),
    daily: z.coerce.number().refine((v) => (DAILY_OPTIONS as readonly number[]).includes(v), "Choix invalide"),
    featured: z.coerce.number().refine((v) => (FEATURED_OPTIONS as readonly number[]).includes(v), "Choix invalide"),
    duration: z.coerce.number().refine((v) => (DURATION_OPTIONS as readonly number[]).includes(v), "Choix invalide"),
  })
  .refine((v) => v.daily > 0 || v.featured > 0, { message: "Choisissez au moins des présentations ou une mise en avant." });

/** Ciblage choisi (métiers, régions, tailles, types d'entreprise), valeurs limitées et contrôlées. */
function readTargeting(fd: FormData) {
  const list = (k: string, re: RegExp, max = 40) => [...new Set(fd.getAll(k).map(String).filter((v) => re.test(v)))].slice(0, max);
  const sectors = list("t_sector", /^[a-z0-9-]{2,60}$/);
  return {
    sectors,
    // Codes NAF de ces métiers : la plupart des entreprises de la base ont un code NAF, pas de métier enregistré
    nafs: [...new Set(sectors.flatMap((s) => SECTOR_PROFILES[s]?.naf ?? []))],
    regions: list("t_region", /^[\p{L} '-]{2,60}$/u),
    sizes: list("t_size", /^(INDEPENDANT|TPE|PME|ETI|GE)$/),
    kinds: list("t_kind", /^(SUPPLIER|BUYER|BOTH)$/),
  };
}

/** Aperçu : nombre d'entreprises inscrites correspondant au ciblage (aucune donnée nominative). */
export async function boostAudience(targeting: { sectors?: string[]; regions?: string[]; sizes?: string[]; kinds?: string[] }): Promise<{ members: number; prospects: number }> {
  const session = await requireCompany("/dashboard/visibilite");
  const fd = new FormData();
  for (const [k, vals] of Object.entries({ t_sector: targeting.sectors, t_region: targeting.regions, t_size: targeting.sizes, t_kind: targeting.kinds }))
    for (const v of vals ?? []) fd.append(k, v);
  const { data } = await (await createClient()).rpc("boost_audience", { p_company_id: session.activeCompany.company.id, p_targeting: readTargeting(fd) });
  const d = (data ?? {}) as { members?: number; prospects?: number };
  return { members: Number(d.members ?? 0), prospects: Number(d.prospects ?? 0) };
}

/** Demande de visibilité (administrateur de l'entreprise) : démarre aussitôt pendant la phase gratuite. */
export async function requestBoost(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = schema.safeParse({ target: fd.get("target"), daily: fd.get("daily"), featured: fd.get("featured"), duration: fd.get("duration") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Choix invalide." };
  const session = await requireCompany("/dashboard/visibilite");
  if (session.activeCompany.role !== "COMPANY_ADMIN") return { ok: false, error: "Seul un administrateur de l'entreprise peut faire cette demande." };
  if (!(await rateLimit("visibility-request", 10, 3600))) return { ok: false, error: "Trop de demandes. Réessayez plus tard." };
  const { target, daily, featured, duration } = parsed.data;
  // Campagne (entreprise) : objectif et annonce rédigée par l'entreprise, relue par l'équipe avant le 1er e-mail
  const objective = OBJECTIVES.some((o) => o.value === fd.get("objective")) ? String(fd.get("objective")) : null;
  const clean = (v: FormDataEntryValue | null, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const ad = {
    title: clean(fd.get("ad_title"), AD_LIMITS.title),
    points: fd.getAll("ad_point").map((v) => clean(v, AD_LIMITS.point)).filter(Boolean).slice(0, 3),
    text: clean(fd.get("ad_text"), AD_LIMITS.text),
  };
  const withAd = target === "COMPANY" && ad.title.length >= 5;
  if (withAd) {
    const issues = adIssues(ad);
    if (issues.length) return { ok: false, error: issues[0] };
  }
  const need = target !== "COMPANY";
  const supabase = await createClient();
  const targeting = need ? {} : readTargeting(fd);
  const companyId = session.activeCompany.company.id;
  // Présentations incluses dans l'abonnement (Pro / Business) : déduites du prix
  const credit = await includedPresentationsLeft(companyId);
  const { price, covered } = boostPriceWithIncluded(daily as Daily, featured as Featured, duration as Duration, credit.left);
  const { data: boostId, error } = await supabase.rpc("request_visibility_boost", {
    p_company_id: companyId,
    p_target: need ? "NEED" : "COMPANY",
    p_opportunity_id: need ? target : null,
    p_daily: daily,
    p_featured_days: featured,
    p_duration_days: duration,
    p_price_ht: price,
    p_targeting: targeting,
  });
  if (error) {
    if (error.code === "P0001") return { ok: false, error: error.message };
    logServerError("visibility request", error);
    return { ok: false, error: "La demande n'a pas pu être enregistrée. Réessayez dans quelques instants." };
  }
  if (boostId && covered) await createAdminClient().from("visibility_boosts").update({ included_presentations: covered }).eq("id", boostId);
  if (boostId && (objective || withAd)) {
    await createAdminClient()
      .from("visibility_boosts")
      .update({
        objective,
        ...(withAd ? { ad_title: ad.title, ad_points: ad.points, ad_text: ad.text || null, ad_status: "PENDING_REVIEW" } : {}),
      })
      .eq("id", boostId)
      .eq("company_id", companyId);
  }
  revalidatePath("/dashboard/visibilite");
  revalidatePath("/admin/visibilite");
  return {
    ok: true,
    message: withAd
      ? "C'est parti : votre campagne a démarré. Votre annonce est relue par notre équipe (en général sous 24 h ouvrées) avant les premiers e-mails."
      : "C'est parti : votre campagne a démarré. Suivez-la jour après jour ci-dessous.",
  };
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

/** Arrêt d'une offre en cours par l'équipe (en cas de souci). */
export async function stopBoost(id: string, note?: string): Promise<ActionResult> {
  await requireStaff();
  const { error } = await (await createClient()).rpc("stop_visibility_boost", { p_id: id, p_note: note?.trim() || null });
  if (error) return { ok: false, error: error.code === "P0001" || error.code === "42501" ? error.message : "Action impossible pour le moment." };
  revalidatePath("/admin/visibilite");
  return { ok: true, message: "Offre arrêtée." };
}

/** Relecture de l'annonce d'une campagne par l'équipe : validée (les e-mails partent) ou à corriger. */
export async function reviewBoostAd(id: string, approve: boolean, note?: string): Promise<ActionResult> {
  const session = await requireStaff();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Campagne introuvable." };
  const reason = (note ?? "").trim().slice(0, 500);
  if (!approve && reason.length < 5) return { ok: false, error: "Indiquez ce qu'il faut corriger (le message est transmis à l'entreprise)." };
  const db = createAdminClient();
  const { data: b } = await db.from("visibility_boosts").select("id, company_id, ad_title").eq("id", id).maybeSingle();
  if (!b?.ad_title) return { ok: false, error: "Campagne introuvable." };
  const { error } = await db
    .from("visibility_boosts")
    .update({ ad_status: approve ? "APPROVED" : "REJECTED", ad_review_note: approve ? null : reason, ad_reviewed_at: new Date().toISOString(), reviewed_by: session.userId })
    .eq("id", id);
  if (error) return { ok: false, error: "Action impossible pour le moment." };
  await db.from("audit_logs").insert({ action: approve ? "visibility.ad_approved" : "visibility.ad_rejected", entity_type: "visibility_boost", entity_id: id, actor_user_id: session.userId, metadata: { note: reason || null } });
  const { data: members } = await db.from("company_members").select("user_id").eq("company_id", b.company_id);
  if (members?.length)
    await db.from("notifications").insert(
      members.map((m) => ({
        user_id: m.user_id,
        type: approve ? "visibility_ad_approved" : "visibility_ad_rejected",
        title: approve ? "Votre annonce est validée : la campagne envoie ses présentations" : "Votre annonce est à corriger",
        body: approve ? b.ad_title : `${b.ad_title} : ${reason}`.slice(0, 500),
        link: "/dashboard/visibilite",
      })),
    );
  revalidatePath("/admin/visibilite");
  revalidatePath("/dashboard/visibilite");
  return { ok: true, message: approve ? "Annonce validée." : "Annonce renvoyée pour correction." };
}

/** Correction de l'annonce par l'entreprise (après « à corriger », ou avant la relecture) : renvoyée en relecture. */
export async function updateBoostAd(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const session = await requireCompany("/dashboard/visibilite");
  if (session.activeCompany.role !== "COMPANY_ADMIN") return { ok: false, error: "Seul un administrateur de l'entreprise peut modifier l'annonce." };
  const id = String(fd.get("id") ?? "");
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Campagne introuvable." };
  const clean = (v: FormDataEntryValue | null, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const ad = {
    title: clean(fd.get("ad_title"), AD_LIMITS.title),
    points: fd.getAll("ad_point").map((v) => clean(v, AD_LIMITS.point)).filter(Boolean).slice(0, 3),
    text: clean(fd.get("ad_text"), AD_LIMITS.text),
  };
  if (ad.title.length < 5) return { ok: false, error: "Donnez un titre à votre annonce (5 caractères au moins)." };
  const issues = adIssues(ad);
  if (issues.length) return { ok: false, error: issues[0] };
  const { data, error } = await createAdminClient()
    .from("visibility_boosts")
    .update({ ad_title: ad.title, ad_points: ad.points, ad_text: ad.text || null, ad_status: "PENDING_REVIEW", ad_review_note: null })
    .eq("id", id)
    .eq("company_id", session.activeCompany.company.id)
    .in("status", ["PENDING", "ACTIVE"])
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Modification impossible pour cette campagne." };
  revalidatePath("/dashboard/visibilite");
  revalidatePath("/admin/visibilite");
  return { ok: true, message: "Annonce renvoyée en relecture." };
}
