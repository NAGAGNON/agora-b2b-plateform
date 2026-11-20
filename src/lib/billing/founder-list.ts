import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Liste « tarif fondateur » : les membres demandent à être prévenus en premier, avec un prix plus léger
 * au lancement des offres payantes. Aucun paiement, aucun e-mail envoyé. Ouverte 7 jours, date fixe
 * identique pour tout le monde (pas de compte à rebours qui repart à zéro).
 */
export const FOUNDER_LIST_ENDS = "2026-11-27T22:59:59Z"; // jeudi 27 novembre 2026, 23h59 (Paris)
export const FOUNDER_EVENT = "founder_interest";

export const founderListOpen = (now: number) => now < new Date(FOUNDER_LIST_ENDS).getTime();

/** L'inscrit est-il déjà sur la liste ? */
export async function onFounderList(userId: string): Promise<boolean> {
  const { count } = await createAdminClient()
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("event_name", FOUNDER_EVENT)
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}
