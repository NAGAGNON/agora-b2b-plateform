import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

export type AnalyticsEvent =
  | "view_opportunity"
  | "search_opportunities"
  | "create_account"
  | "create_company"
  | "publish_opportunity"
  | "express_interest"
  | "submit_proposal"
  | "save_favorite"
  | "create_alert"
  | "contact_company"
  | "source_outbound_clicked"
  | "profile_completed"
  | "view_company"
  | "search_companies";

/**
 * Enregistre un événement produit (sans IP, sans e-mail, sans contenu saisi).
 * Ne bloque jamais le rendu en cas d'échec.
 */
export async function track(event: AnalyticsEvent, properties: Record<string, string | number | boolean | null> = {}) {
  try {
    const supabase = await createClient();
    await supabase.rpc("track_event", { p_event_name: event, p_properties: properties as Json });
  } catch {
    // ignoré volontairement
  }
}
