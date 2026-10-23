"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/errors";
import { processEmailOutbox } from "@/lib/email/outbox";
import { env } from "@/lib/env";
import { processNeedCampaigns, runNeedCampaign } from "@/lib/needs";
import { runSendPass } from "@/lib/outreach/pipeline";
import type { ActionResult } from "@/lib/validation";

/** Relance la mise en relation d'un besoin (nouvelles entreprises inscrites, campagne en échec). */
export async function rerunNeed(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = z.uuid().safeParse(fd.get("opportunityId"));
  if (!id.success) return { ok: false, error: "Besoin invalide." };
  try {
    const r = await runNeedCampaign(createAdminClient(), id.data, { deadline: Date.now() + 90_000 });
    if (env.emailTransport) await processEmailOutbox(40);
    revalidatePath("/admin/besoins");
    if (r.status !== "RUNNING") return { ok: false, error: r.note ?? `Statut : ${r.status}` };
    return {
      ok: true,
      message: `${r.members?.identified ?? 0} entreprise(s) inscrite(s) identifiée(s), ${r.members?.notified ?? 0} prévenue(s) maintenant${r.prospects ? ` ; prospection : ${r.prospects.skipped ?? `${r.prospects.relevant} entreprise(s) retenue(s)`}` : ""}.`,
    };
  } catch (e) {
    logServerError("rerun need", e);
    return { ok: false, error: "La mise en relation a échoué. Réessayez plus tard." };
  }
}

/** Traite maintenant tous les besoins ouverts jamais analysés (sinon fait chaque jour automatiquement). */
export async function processNeedsNow(): Promise<ActionResult> {
  await requireAdmin();
  try {
    const r = await processNeedCampaigns(createAdminClient(), { deadline: Date.now() + 100_000 });
    if (env.emailTransport) await processEmailOutbox(60);
    revalidatePath("/admin/besoins");
    return { ok: true, message: `${r.processed} besoin(s) traité(s), ${r.reminded} relance(s), ${r.closed} besoin(s) clôturé(s).` };
  } catch (e) {
    logServerError("process needs", e);
    return { ok: false, error: "Le traitement a échoué. Réessayez plus tard." };
  }
}

/** « Lancer la campagne besoins » (Vue d'ensemble Outreach) : besoins ouverts + envoi immédiat de leurs e-mails. */
export async function launchNeedCampaignsNow(): Promise<ActionResult> {
  await requireAdmin();
  const started = Date.now();
  try {
    const db = createAdminClient();
    const r = await processNeedCampaigns(db, { deadline: started + 150_000 });
    if (env.emailTransport) await processEmailOutbox(60);
    const send = await runSendPass(db, { budgetMs: Math.max(30_000, 270_000 - (Date.now() - started)) });
    revalidatePath("/outreach");
    revalidatePath("/admin/besoins");
    return {
      ok: true,
      message: `${r.processed} besoin(s) traité(s) · ${send.sent} e-mail(s) envoyé(s)${send.stopped ? ` (arrêt : ${send.stopped})` : ""}. La suite part automatiquement aux passages d'envoi de la journée.`,
    };
  } catch (e) {
    logServerError("launch needs", e);
    return { ok: false, error: "Le lancement a échoué. Réessayez plus tard." };
  }
}
