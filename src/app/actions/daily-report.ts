"use server";

import { revalidatePath } from "next/cache";
import { getStaffActionSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { generateDailyReport } from "@/lib/daily-report";
import { sendDailyReportEmail } from "@/lib/daily-report-email";
import type { ActionResult } from "@/lib/validation";

/** Bouton « Analyser maintenant » du tableau de bord (administrateurs). */
export async function refreshDailyReport(): Promise<ActionResult> {
  const session = await getStaffActionSession();
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

/** Bouton « Recevoir le rapport par e-mail » : rapport complet et détaillé, envoyé tout de suite. */
export async function emailDailyReport(): Promise<ActionResult> {
  const session = await getStaffActionSession();
  if (!session?.isAdmin) return { ok: false, error: "Réservé aux administrateurs." };
  if (!(await rateLimit("daily-report-email", 3, 3600))) return { ok: false, error: "3 envois par heure au maximum. Réessayez un peu plus tard." };
  try {
    const r = await sendDailyReportEmail({ force: true });
    revalidatePath("/admin");
    if (r.sent) return { ok: true, message: `Rapport envoyé à ${r.recipients.join(", ")}.` };
    return { ok: false, error: "skipped" in r && r.skipped ? r.skipped : `Envoi impossible : ${("errors" in r && r.errors?.join(" ; ")) || "erreur inconnue"}` };
  } catch {
    return { ok: false, error: "Envoi impossible pour le moment." };
  }
}
