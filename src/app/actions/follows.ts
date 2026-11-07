"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { actionError } from "@/lib/errors";
import type { ActionResult } from "@/lib/validation";

/** Suivre / ne plus suivre une entreprise, au nom de l'entreprise active du membre. */
export async function toggleFollow(companyId: string): Promise<ActionResult<{ following: boolean }>> {
  if (!z.uuid().safeParse(companyId).success) return { ok: false, error: "Identifiant invalide." };
  const session = await getSession();
  if (!session) return { ok: false, error: "Connectez-vous pour suivre une entreprise." };
  const me = session.activeCompany?.company.id;
  if (!me) return { ok: false, error: "Créez d'abord la fiche de votre entreprise pour suivre d'autres entreprises." };
  if (me === companyId) return { ok: false, error: "Vous ne pouvez pas suivre votre propre entreprise." };
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("company_follows")
    .select("followed_company_id")
    .eq("follower_company_id", me)
    .eq("followed_company_id", companyId)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase.from("company_follows").delete().eq("follower_company_id", me).eq("followed_company_id", companyId);
    if (error) return actionError(error);
    revalidatePath("/dashboard/suivies");
    return { ok: true, data: { following: false }, message: "Vous ne suivez plus cette entreprise." };
  }
  const { error } = await supabase.from("company_follows").insert({ follower_company_id: me, followed_company_id: companyId, created_by: session.userId });
  if (error) return actionError(error);
  await supabase.rpc("track_event", { p_event_name: "save_favorite", p_properties: { target: "follow" } });
  revalidatePath("/dashboard/suivies");
  return { ok: true, data: { following: true }, message: "Entreprise suivie : vous serez prévenu de ses nouveaux besoins." };
}
