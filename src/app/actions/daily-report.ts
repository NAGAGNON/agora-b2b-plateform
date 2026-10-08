"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { generateDailyReport } from "@/lib/daily-report";
import type { ActionResult } from "@/lib/validation";

/** Bouton « Analyser maintenant » du tableau de bord (administrateurs). */
export async function refreshDailyReport(): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.isAdmin) return { ok: false, error: "Réservé aux administrateurs." };
  if (!(await rateLimit("daily-report", 6, 3600))) return { ok: false, error: "6 analyses par heure au maximum. Réessayez un peu plus tard." };
  try {
    const r = await generateDailyReport();
    revalidatePath("/admin");
    return r.error ? { ok: false, error: r.error } : { ok: true, message: "Bilan mis à jour." };
  } catch {
    return { ok: false, error: "Analyse impossible pour le moment." };
  }
}
