"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompany, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { DAILY_OPTIONS, DURATION_OPTIONS, FEATURED_OPTIONS, boostPriceWithIncluded, type Daily, type Duration, type Featured } from "@/lib/visibility";
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
