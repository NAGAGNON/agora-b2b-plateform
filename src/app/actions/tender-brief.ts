"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
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

/** Étapes cochées de la fiche pour l'entreprise active (vide sans entreprise ou sans suivi). */
export async function briefProgress(opportunityId: string): Promise<{ done: number[]; tracked: boolean }> {
  if (!z.uuid().safeParse(opportunityId).success) return { done: [], tracked: false };
  const session = await getSession();
  if (!session?.activeCompany) return { done: [], tracked: false };
  const db = await createClient();
  const { data } = await db.from("pipeline_items").select("brief_done").eq("company_id", session.activeCompany.company.id).eq("opportunity_id", opportunityId).maybeSingle();
  return { done: (data?.brief_done ?? []).map(Number), tracked: Boolean(data) };
}

/**
 * Coche ou décoche une étape du « à faire ». La première étape cochée ajoute l'appel d'offres au
 * pipeline de l'entreprise (étape « réponse en préparation ») ; tout reste privé à l'entreprise.
 */
export async function toggleBriefStep(opportunityId: string, step: number, done: boolean): Promise<{ ok: true; done: number[] } | { ok: false; error: string }> {
  if (!z.uuid().safeParse(opportunityId).success || !Number.isInteger(step) || step < 0 || step > 19) return { ok: false, error: "Étape inconnue." };
  const session = await getSession();
  if (!session) return { ok: false, error: "Connectez-vous pour suivre vos étapes." };
  if (!session.activeCompany) return { ok: false, error: "Créez d'abord le profil de votre entreprise." };
  const companyId = session.activeCompany.company.id;
  const db = await createClient();
  const { data: item } = await db.from("pipeline_items").select("id, brief_done").eq("company_id", companyId).eq("opportunity_id", opportunityId).maybeSingle();
  const current = new Set((item?.brief_done ?? []).map(Number));
  if (done) current.add(step);
  else current.delete(step);
  const next = [...current].sort((a, b) => a - b);
  const { error } = item
    ? await db.from("pipeline_items").update({ brief_done: next, updated_by: session.userId }).eq("id", item.id)
    : await db.from("pipeline_items").insert({ company_id: companyId, opportunity_id: opportunityId, stage: "RESPONSE_PREPARING", brief_done: next, updated_by: session.userId });
  if (error) return { ok: false, error: "Enregistrement impossible. Réessayez." };
  revalidatePath("/dashboard/pipeline");
  return { ok: true, done: next };
}
