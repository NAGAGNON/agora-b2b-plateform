"use server";

import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { ensureBrief, type TenderBrief } from "@/lib/tender-brief";

/** Fiche synthèse d'un appel d'offres, préparée si besoin (membres Pro, en essai ou phase de lancement). */
export async function loadTenderBrief(opportunityId: string): Promise<{ ok: true; brief: TenderBrief | null } | { ok: false; error: string }> {
  if (!z.uuid().safeParse(opportunityId).success) return { ok: false, error: "Offre introuvable." };
  const session = await getSession();
  if (!session) return { ok: false, error: "Connectez-vous pour voir la fiche." };
  const db = await createClient();
  const plan = (await db.rpc("user_plan")).data ?? "FREE";
  const allowed = (await db.rpc("plan_feature", { p_plan: plan, p_key: "tender_brief" })).data === true;
  if (!allowed) return { ok: false, error: "La fiche synthèse est réservée aux membres Pro." };
  if (!(await rateLimit("tender-brief", 60, 3600))) return { ok: false, error: "Trop de demandes. Réessayez dans un moment." };
  return { ok: true, brief: await ensureBrief(opportunityId) };
}
