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
  } catch (e) {
    const m = e instanceof Error ? e.message : e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
    return { ok: false, error: `Analyse impossible pour le moment${m ? ` : ${m}` : "."}` };
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

/** Analyste du lundi : préparer le bilan de la semaine écoulée maintenant (sans e-mail). */
export async function refreshWeeklyReview(): Promise<ActionResult> {
  const session = await getStaffActionSession();
  if (!session?.isAdmin) return { ok: false, error: "Réservé aux administrateurs." };
  if (!(await rateLimit("weekly-review", 6, 3600))) return { ok: false, error: "6 analyses par heure au maximum. Réessayez un peu plus tard." };
  try {
    const { generateWeeklyReview } = await import("@/lib/weekly-review");
    const r = await generateWeeklyReview();
    revalidatePath("/admin");
    return { ok: true, message: r.error ? `Bilan préparé (${r.error}).` : "Bilan de la semaine préparé." };
  } catch {
    return { ok: false, error: "Analyse impossible pour le moment." };
  }
}

/** Analyste du lundi : recevoir le bilan de la semaine par e-mail tout de suite. */
export async function emailWeeklyReview(): Promise<ActionResult> {
  const session = await getStaffActionSession();
  if (!session?.isAdmin) return { ok: false, error: "Réservé aux administrateurs." };
  if (!(await rateLimit("weekly-review-email", 3, 3600))) return { ok: false, error: "3 envois par heure au maximum. Réessayez un peu plus tard." };
  try {
    const { sendWeeklyReview } = await import("@/lib/weekly-review");
    const r = await sendWeeklyReview({ force: true });
    revalidatePath("/admin");
    if (r.sent) return { ok: true, message: `Bilan envoyé à ${r.recipients.join(", ")}.` };
    return { ok: false, error: "skipped" in r && r.skipped ? r.skipped : `Envoi impossible : ${("errors" in r && r.errors?.join(" ; ")) || "erreur inconnue"}` };
  } catch {
    return { ok: false, error: "Envoi impossible pour le moment." };
  }
}
