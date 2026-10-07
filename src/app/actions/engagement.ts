"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { userMessage } from "@/lib/errors";
import { alertSchema, parseForm, type ActionResult } from "@/lib/validation";

async function currentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

/** Ajoute / retire un favori (opportunité ou entreprise). */
export async function toggleFavorite(target: "opportunity" | "company", id: string): Promise<ActionResult<{ favorited: boolean }>> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Identifiant invalide." };
  const { supabase, userId } = await currentUserId();
  if (!userId) return { ok: false, error: "Connectez-vous pour enregistrer des favoris." };
  const column = target === "opportunity" ? "opportunity_id" : "company_id";
  const { data: existing } = await supabase.from("favorites").select("id").eq("user_id", userId).eq(column, id).maybeSingle();
  if (existing) {
    await supabase.from("favorites").delete().eq("id", existing.id);
    revalidatePath("/dashboard/favoris");
    return { ok: true, data: { favorited: false }, message: "Retiré des favoris." };
  }
  const { error } = await supabase
    .from("favorites")
    .insert(target === "opportunity" ? { user_id: userId, opportunity_id: id } : { user_id: userId, company_id: id });
  if (error) return { ok: false, error: userMessage(error) };
  await supabase.rpc("track_event", { p_event_name: "save_favorite", p_properties: { target } });
  revalidatePath("/dashboard/favoris");
  return { ok: true, data: { favorited: true }, message: "Ajouté aux favoris." };
}

const savedSearchSchema = z.object({
  name: z.string().trim().min(1, "Donnez un nom à la recherche").max(120),
  query: z.string().max(2000),
  scope: z.enum(["OPPORTUNITIES", "COMPANIES"]).default("OPPORTUNITIES"),
});

export async function saveSearch(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(savedSearchSchema, fd);
  if (!parsed.success) return parsed.result;
  const { supabase, userId } = await currentUserId();
  if (!userId) return { ok: false, error: "Connectez-vous pour sauvegarder une recherche." };
  const params = Object.fromEntries(new URLSearchParams(parsed.data.query).entries());
  delete params.page;
  const { error } = await supabase
    .from("saved_searches")
    .insert({ user_id: userId, name: parsed.data.name, scope: parsed.data.scope, query: params as { [key: string]: string } });
  if (error) return { ok: false, error: userMessage(error) };
  revalidatePath("/dashboard/favoris");
  return { ok: true, message: "Recherche sauvegardée. Retrouvez-la dans vos favoris." };
}

export async function deleteSavedSearch(id: string) {
  if (!z.uuid().safeParse(id).success) return;
  const { supabase } = await currentUserId();
  await supabase.from("saved_searches").delete().eq("id", id);
  revalidatePath("/dashboard/favoris");
}

export async function createAlert(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(alertSchema, fd);
  if (!parsed.success) return parsed.result;
  const { supabase, userId } = await currentUserId();
  if (!userId) return { ok: false, error: "Connectez-vous pour créer une alerte." };
  const { count } = await supabase.from("alerts").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if ((count ?? 0) >= 20) return { ok: false, error: "Vous avez atteint le nombre maximum d'alertes (20)." };
  const d = parsed.data;
  const { error } = await supabase.from("alerts").insert({
    user_id: userId,
    name: d.name,
    sector_slug: d.sector ?? null,
    department_code: d.departmentCode ?? null,
    type: d.type ?? null,
    keywords: d.keywords ?? null,
    frequency: d.frequency,
    place_slug: d.placeSlug ?? null,
    radius_km: d.placeSlug ? (d.radiusKm ?? 50) : null,
    skills: d.skills,
    company_size: d.companySize ?? null,
    include_external: d.includeExternal,
  });
  if (error) return { ok: false, error: userMessage(error) };
  await supabase.rpc("track_event", { p_event_name: "create_alert", p_properties: { frequency: d.frequency } });
  revalidatePath("/dashboard/alertes");
  return { ok: true, message: "Alerte créée." };
}

export async function setAlertActive(id: string, active: boolean) {
  if (!z.uuid().safeParse(id).success) return;
  const { supabase } = await currentUserId();
  await supabase.from("alerts").update({ is_active: active }).eq("id", id);
  revalidatePath("/dashboard/alertes");
}

export async function deleteAlert(id: string) {
  if (!z.uuid().safeParse(id).success) return;
  const { supabase } = await currentUserId();
  await supabase.from("alerts").delete().eq("id", id);
  revalidatePath("/dashboard/alertes");
}
