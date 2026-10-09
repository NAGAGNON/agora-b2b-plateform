import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/errors";
import { PAGE_SIZE } from "@/lib/constants";
import { showDemoData } from "@/lib/queries/platform";
import type { CompanyFilters } from "@/lib/search-params";

export async function searchCompanies(f: CompanyFilters, pageSize = PAGE_SIZE) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_companies", {
    p_q: f.q,
    p_sector: f.sector,
    p_department: f.department,
    p_kind: f.kind,
    p_size: f.size,
    p_skills: f.skills.length ? f.skills : undefined,
    p_limit: pageSize,
    p_offset: (f.page - 1) * pageSize,
    p_include_demo: await showDemoData(),
  });
  if (error) {
    logServerError("search_companies", error);
    return { rows: [], total: 0, error: true as const };
  }
  return { rows: data ?? [], total: data?.[0]?.total_count ?? 0, error: false as const };
}

// Partagé entre les métadonnées et la page dans une même requête (une seule lecture)
export const getCompanyBySlug = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("*, profile:company_profiles(*)").eq("slug", slug).maybeSingle();
  return data;
});
