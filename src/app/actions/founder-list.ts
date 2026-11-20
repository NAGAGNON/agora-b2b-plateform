"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { FOUNDER_EVENT, founderWave, onFounderList } from "@/lib/billing/founder-list";

/** Inscription sur la liste « tarif fondateur » (aucun paiement, aucun e-mail). */
export async function joinFounderList(): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Connectez-vous pour rejoindre la liste." };
  if (await onFounderList(session.userId)) return { ok: true };
  const { error } = await createAdminClient()
    .from("analytics_events")
    .insert({ event_name: FOUNDER_EVENT, user_id: session.userId, company_id: session.activeCompany?.company.id ?? null, properties: { vague: founderWave(Date.now()).number } });
  if (error) return { ok: false, error: "Un souci est survenu, réessayez dans un instant." };
  revalidatePath("/dashboard");
  revalidatePath("/tarifs");
  return { ok: true };
}
