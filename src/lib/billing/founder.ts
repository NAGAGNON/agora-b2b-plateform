import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS } from "@/lib/billing/plans";

/**
 * Offre de lancement : essai Pro offert puis tarif « fondateur » (Pro à moitié prix, à vie) pour un
 * nombre limité de places, jusqu'à une date de fin. Préparée mais INACTIVE tant que le lancement
 * n'a pas été décidé (fonction launch_paid_offer, réglage platform_settings « founder_offer »).
 *
 * Réglage : { enabled, launched_at, ends_at, seats }
 */
export const FOUNDER_KEY = "founder_offer";
export const FOUNDER_DISCOUNT = 50; // %
export const FOUNDER_COUPON_ID = "LINKPRO_FONDATEUR_50";
const PRO = PLANS.find((p) => p.code === "PRO")!;
export const FOUNDER_PRICE_HT = Math.round(PRO.priceHT * (100 - FOUNDER_DISCOUNT)) / 100; // 14,50 €
export const REGULAR_PRICE_HT = PRO.priceHT;
export const LAUNCH_TRIAL_DAYS = 30;
export const ON_DEMAND_TRIAL_DAYS = 14;
export const REFUND_DAYS = 30;

export type FounderOffer = { enabled: boolean; launchedAt: string | null; endsAt: string | null; seats: number };

export async function founderOffer(db = createAdminClient()): Promise<FounderOffer> {
  const { data } = await db.from("platform_settings").select("value").eq("key", FOUNDER_KEY).maybeSingle();
  const v = (data?.value ?? {}) as { enabled?: boolean; launched_at?: string; ends_at?: string; seats?: number };
  return { enabled: v.enabled === true, launchedAt: v.launched_at ?? null, endsAt: v.ends_at ?? null, seats: Number(v.seats ?? 30) };
}

/** Offre en cours (lancée, non terminée). */
export function founderOpen(o: FounderOffer, now = Date.now()): boolean {
  return o.enabled && (!o.endsAt || new Date(o.endsAt).getTime() > now);
}

/** Compte inscrit avant le lancement (« membre fondateur » : message de remerciement). */
export function isFounder(o: FounderOffer, userCreatedAt: string | null | undefined): boolean {
  if (!userCreatedAt) return false;
  return !o.launchedAt || new Date(userCreatedAt).getTime() < new Date(o.launchedAt).getTime();
}

/** Places au tarif fondateur déjà prises (abonnements réels souscrits avec la réduction). */
export async function founderSeatsTaken(db = createAdminClient()): Promise<number> {
  const { count } = await db.from("subscriptions").select("id", { count: "exact", head: true }).eq("founder", true).in("status", ["active", "trialing", "past_due"]);
  return count ?? 0;
}

export function seatsLeft(o: FounderOffer, taken: number): number {
  return Math.max(0, o.seats - taken);
}

export type CompanyOfferState = {
  plan: "FREE" | "PRO" | "BUSINESS";
  paid: boolean;
  trialEndsAt: string | null;
  trialActive: boolean;
  trialUsed: boolean;
};

/** Situation d'une entreprise vis-à-vis de l'offre (abonnée, en essai, essai déjà utilisé). */
export async function companyOfferState(companyId: string, db = createAdminClient(), now = Date.now()): Promise<CompanyOfferState> {
  const { data: c } = await db.from("companies").select("plan_code, trial_ends_at, trial_started_at").eq("id", companyId).maybeSingle();
  const paid = c?.plan_code === "PRO" || c?.plan_code === "BUSINESS";
  const trialActive = !paid && Boolean(c?.trial_ends_at && new Date(c.trial_ends_at).getTime() > now);
  return {
    plan: paid ? (c!.plan_code as "PRO" | "BUSINESS") : trialActive ? "PRO" : "FREE",
    paid,
    trialEndsAt: c?.trial_ends_at ?? null,
    trialActive,
    trialUsed: Boolean(c?.trial_started_at),
  };
}

/** Jours restants (arrondi au supérieur). */
export function daysLeft(iso: string | null, now = Date.now()): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 86_400_000));
}

export type MarketPulse = { sectors: string[]; france: number; department: number; departmentCode: string | null };

/**
 * Offres réelles publiées ces 30 derniers jours dans les métiers de l'entreprise : en France et dans
 * son département. Sert à montrer, chiffres à l'appui, ce que l'offre Gratuite ne couvre pas.
 */
export async function marketPulse(companyId: string, db = createAdminClient(), now = Date.now()): Promise<MarketPulse | null> {
  const [{ data: profile }, { data: company }] = await Promise.all([
    db.from("company_profiles").select("sectors").eq("company_id", companyId).maybeSingle(),
    db.from("companies").select("department_code").eq("id", companyId).maybeSingle(),
  ]);
  const sectors = (profile?.sectors ?? []).filter(Boolean);
  if (!sectors.length) return null;
  const since = new Date(now - 30 * 86_400_000).toISOString();
  const base = () => db.from("opportunities").select("id", { count: "exact", head: true }).eq("status", "PUBLISHED").eq("is_demo", false).in("sector_slug", sectors).gte("published_at", since);
  const [fr, dep] = await Promise.all([base(), company?.department_code ? base().eq("department_code", company.department_code) : Promise.resolve({ count: 0 })]);
  return { sectors, france: fr.count ?? 0, department: dep.count ?? 0, departmentCode: company?.department_code ?? null };
}
