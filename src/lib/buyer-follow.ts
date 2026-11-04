import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/** Mots-clés d'une alerte « Suivre cet acheteur » : son nom exact, entre guillemets (recherche d'expression). */
export function buyerAlertKeywords(name: string) {
  return `"${name.replace(/["\s]+/g, " ").trim()}"`;
}

export const buyerAlertName = (name: string) => `Acheteur : ${name}`.slice(0, 120);

/**
 * Alerte qui suit un acheteur public : ses nouveaux appels d'offres, quel que soit le métier ou le
 * lieu. Une seule par acheteur et par compte. Renvoie true si elle existe (créée ou déjà là).
 */
export async function followBuyer(db: SupabaseClient<Database>, userId: string, name: string): Promise<boolean> {
  const keywords = buyerAlertKeywords(name);
  const { data: existing } = await db.from("alerts").select("id, is_active").eq("user_id", userId).eq("keywords", keywords).maybeSingle();
  if (existing) {
    if (!existing.is_active) await db.from("alerts").update({ is_active: true }).eq("id", existing.id);
    return true;
  }
  const { error } = await db.from("alerts").insert({ user_id: userId, name: buyerAlertName(name), keywords, frequency: "DAILY", include_external: true });
  return !error;
}
