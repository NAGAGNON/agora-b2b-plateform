import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyPlan } from "@/lib/billing/entitlements";
import { VISIBILITY_INCLUDED } from "@/lib/billing/plans";
import { reachLabel } from "@/lib/visibility";

/** Présentations « Visibilité » incluses restant ce mois-ci pour l'entreprise (selon son abonnement). */
export async function includedPresentationsLeft(companyId: string): Promise<{ plan: string; included: number; left: number }> {
  const plan = await companyPlan(companyId);
  const included = VISIBILITY_INCLUDED[plan] ?? 0;
  if (!included) return { plan, included, left: 0 };
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { data } = await createAdminClient()
    .from("visibility_boosts")
    .select("included_presentations")
    .eq("company_id", companyId)
    .gte("created_at", monthStart)
    .not("status", "in", "(REJECTED,CANCELLED)");
  const used = (data ?? []).reduce((t, b) => t + (b.included_presentations ?? 0), 0);
  return { plan, included, left: Math.max(0, included - used) };
}

/** Phrase « Plus de N entreprises référencées, dont M joignables par e-mail » (chiffres réels de la base). */
export async function baseReachLabel(): Promise<string | null> {
  const { data } = await createAdminClient().rpc("public_prospect_reach");
  const r = (data ?? null) as { total?: number; reachable?: number } | null;
  return reachLabel(r ? { total: Number(r.total ?? 0), reachable: Number(r.reachable ?? 0) } : null);
}
