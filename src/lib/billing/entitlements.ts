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
