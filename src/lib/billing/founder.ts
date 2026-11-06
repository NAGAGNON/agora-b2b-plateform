import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS } from "@/lib/billing/plans";

/**
 * Offre « membre fondateur » : l'offre Pro à moitié prix, à vie, réservée aux personnes inscrites
 * avant son lancement. Préparée mais INACTIVE tant que `enabled` n'est pas mis à vrai (réglage
 * platform_settings « founder_offer ») : ni page, ni bandeau, ni e-mail avant ce moment.
 *
 * Réglage : { enabled: boolean, launched_at: ISO, ends_at: ISO }
 *  - launched_at : seuls les comptes créés avant cette date sont concernés (fondateurs) ;
 *  - ends_at     : fin de l'offre (souscription impossible ensuite ; le prix reste acquis à vie).
 */
export const FOUNDER_KEY = "founder_offer";
export const FOUNDER_DISCOUNT = 50; // %
export const FOUNDER_COUPON_ID = "LINKPRO_FONDATEUR_50";
const PRO = PLANS.find((p) => p.code === "PRO")!;
export const FOUNDER_PRICE_HT = Math.round(PRO.priceHT * (100 - FOUNDER_DISCOUNT)) / 100; // 14,50 €
export const REGULAR_PRICE_HT = PRO.priceHT;

export type FounderOffer = { enabled: boolean; launchedAt: string | null; endsAt: string | null };

export async function founderOffer(db = createAdminClient()): Promise<FounderOffer> {
  const { data } = await db.from("platform_settings").select("value").eq("key", FOUNDER_KEY).maybeSingle();
  const v = (data?.value ?? {}) as { enabled?: boolean; launched_at?: string; ends_at?: string };
  return { enabled: v.enabled === true, launchedAt: v.launched_at ?? null, endsAt: v.ends_at ?? null };
}

/** Offre en cours (activée, non terminée). */
export function founderOpen(o: FounderOffer, now = Date.now()): boolean {
  return o.enabled && (!o.endsAt || new Date(o.endsAt).getTime() > now);
}

/** Compte concerné : créé avant le lancement de l'offre. */
export function isFounder(o: FounderOffer, userCreatedAt: string | null | undefined): boolean {
  if (!userCreatedAt) return false;
  return !o.launchedAt || new Date(userCreatedAt).getTime() < new Date(o.launchedAt).getTime();
}
