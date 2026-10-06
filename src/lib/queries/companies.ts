import "server-only";
import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/errors";
import { PAGE_SIZE } from "@/lib/constants";
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
  });
  if (error) {
    logServerError("search_companies", error);
    return { rows: [], total: 0, error: true as const };
  }
  return { rows: data ?? [], total: data?.[0]?.total_count ?? 0, error: false as const };
}

export async function getCompanyBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("*, profile:company_profiles(*)").eq("slug", slug).maybeSingle();
  return data;
}
