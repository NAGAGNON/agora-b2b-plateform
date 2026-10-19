"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/lib/validation";
import { runGrowthStrategy } from "@/lib/growth/engine";

/** Active ou suspend la stratégie automatique (le site reprend alors son comportement habituel). */
export async function setGrowthEnabled(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const enable = fd.get("enabled") === "1";
  const supabase = await createClient();
  // Fonction d'administration : vérifie les droits et trace la modification
  const { error } = await supabase.rpc("admin_update_setting", { p_key: "private.growth_enabled", p_value: { enabled: enable } });
  if (error) {
    logServerError("growth enable", error);
    return { ok: false, error: "Modification refusée (droits ou double authentification)." };
  }
  revalidatePath("/admin/strategie");
  return { ok: true, message: enable ? "Stratégie automatique activée : elle sera recalculée ce soir." : "Stratégie automatique suspendue : le site reprend son fonctionnement habituel." };
}

/** Recalcul immédiat (sinon chaque soir avec le bilan de 21 h). */
export async function recomputeGrowth(_prev: ActionResult | null): Promise<ActionResult> {
  await requireAdmin();
  if (!(await rateLimit("growth-recompute", 10, 3600))) return { ok: false, error: "10 recalculs par heure au maximum." };
  try {
    const r = await runGrowthStrategy();
    revalidatePath("/admin/strategie");
    if (r.skipped) return { ok: false, error: r.skipped };
    return { ok: true, message: r.changes.length ? `Stratégie recalculée : ${r.changes.length} changement(s).` : "Stratégie recalculée : aucun changement nécessaire." };
  } catch (e) {
    logServerError("growth recompute", e);
    return { ok: false, error: "Recalcul impossible pour le moment." };
  }
}
