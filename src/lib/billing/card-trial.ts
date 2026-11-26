import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Essai avec carte bancaire (lancement payant) : 0 € aujourd'hui, premier paiement au bout de
 * CARD_TRIAL_DAYS jours sauf résiliation. INACTIF tant que le propriétaire ne l'a pas validé
 * (réglage platform_settings « billing.card_trial »).
 */
export const CARD_TRIAL_KEY = "billing.card_trial";
export const CARD_TRIAL_DAYS = 7;
/** Rappel envoyé avant la fin de l'essai (événement Stripe « trial_will_end », 3 jours avant). */
export const CARD_TRIAL_REMINDER_DAYS = 3;

export const cardTrial = cache(async (): Promise<{ enabled: boolean; days: number }> => {
  const { data } = await createAdminClient().from("platform_settings").select("value").eq("key", CARD_TRIAL_KEY).maybeSingle();
  const v = (data?.value ?? {}) as { enabled?: boolean; days?: number };
  return { enabled: v.enabled === true, days: Number(v.days ?? CARD_TRIAL_DAYS) || CARD_TRIAL_DAYS };
});

/** Date du premier paiement si l'essai commence maintenant. */
export function firstChargeDate(days = CARD_TRIAL_DAYS, from = new Date()): Date {
  return new Date(from.getTime() + days * 86_400_000);
}
