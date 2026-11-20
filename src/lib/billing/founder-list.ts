import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Liste « tarif fondateur » : les membres demandent à être prévenus en premier, avec un prix plus léger
 * au lancement des offres payantes. Aucun paiement, aucun e-mail envoyé.
 * Fonctionne par vagues d'une semaine annoncées comme telles (« Vague 2 : jusqu'au … ») : chaque vague a
 * sa vraie date de fin, la même pour tout le monde ; la suivante est une nouvelle vague, numérotée.
 */
const FIRST_WAVE_ENDS = Date.parse("2026-11-27T22:59:59Z"); // vendredi 27 novembre 2026, 23h59 (Paris)
const WEEK = 7 * 86_400_000;
export const FOUNDER_EVENT = "founder_interest";

export type FounderWave = { number: number; endsAt: string };

/** Vague en cours : numéro et date de fin. */
export function founderWave(now: number): FounderWave {
  const passed = now <= FIRST_WAVE_ENDS ? 0 : Math.ceil((now - FIRST_WAVE_ENDS) / WEEK);
  return { number: passed + 1, endsAt: new Date(FIRST_WAVE_ENDS + passed * WEEK).toISOString() };
}

/** L'inscrit est-il déjà sur la liste ? */
export async function onFounderList(userId: string): Promise<boolean> {
  const { count } = await createAdminClient()
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("event_name", FOUNDER_EVENT)
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}
