import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/** Offre par crédits lancée ? (réglage « billing.credits_enabled », éteint tant que le fondateur n'a pas dit « on lance »). */
export const creditsEnabled = cache(async (): Promise<boolean> => {
  const { data } = await createAdminClient().from("platform_settings").select("value").eq("key", "billing.credits_enabled").maybeSingle();
  return data?.value === true;
});

/**
 * Avantage Pro à flouter pour ce membre ? Seulement une fois l'offre lancée et s'il est en Gratuit.
 * Avant le lancement (ou en cas d'erreur de lecture), rien n'est flouté : tout le monde voit tout.
 */
export const proLockedForMe = cache(async (): Promise<boolean> => {
  if (!(await creditsEnabled())) return false;
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as { rpc: (f: string) => Promise<{ data: { plan?: string } | null; error: unknown }> }).rpc("my_credits");
  if (error || !data) return false;
  return data.plan === "FREE";
});
