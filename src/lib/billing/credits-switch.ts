import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/** Offre par crédits lancée ? (réglage « billing.credits_enabled », éteint tant que le fondateur n'a pas dit « on lance »). */
export const creditsEnabled = cache(async (): Promise<boolean> => {
  const { data } = await createAdminClient().from("platform_settings").select("value").eq("key", "billing.credits_enabled").maybeSingle();
  return data?.value === true;
});
