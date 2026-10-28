import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { PlanCode } from "@/lib/billing/plans";

/** Offre effective d'une entreprise (lue en base ; les limites y sont appliquées). */
export const companyPlan = cache(async (companyId: string): Promise<PlanCode> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("company_plan", { p_company_id: companyId });
  return (data === "PRO" || data === "BUSINESS" ? data : "FREE") as PlanCode;
});

export const isPaid = (plan: PlanCode) => plan !== "FREE";

/**
 * Phase de lancement : toutes les fonctionnalités sont gratuites (interrupteur « billing.free_launch »,
 * activé par défaut). Les limites de l'offre Gratuite ne s'appliquent qu'une fois la phase terminée.
 */
export const freeLaunch = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("free_launch");
  return error ? true : data !== false;
});

/** Accès complet aux fonctionnalités : offre payante, ou phase de lancement gratuite. */
export async function hasFullAccess(companyId: string): Promise<boolean> {
  const [plan, launch] = await Promise.all([companyPlan(companyId), freeLaunch()]);
  return launch || isPaid(plan);
}
