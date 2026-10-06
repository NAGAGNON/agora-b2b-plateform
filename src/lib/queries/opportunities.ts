import "server-only";
import { createClient } from "@/lib/supabase/server";
import { filtersToRpcArgs, type OpportunityFilters } from "@/lib/search-params";
import { logServerError } from "@/lib/errors";
import { PAGE_SIZE } from "@/lib/constants";

export async function searchOpportunities(filters: OpportunityFilters, pageSize = PAGE_SIZE) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_opportunities", filtersToRpcArgs(filters, pageSize));
  if (error) {
    logServerError("search_opportunities", error);
    return { rows: [], total: 0, error: true as const };
  }
  const rows = data ?? [];
  return { rows, total: rows[0]?.total_count ?? 0, error: false as const };
}

export async function recentOpportunities(limit = 6) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("search_opportunities", { p_status: "OPEN", p_sort: "recent", p_limit: limit });
  return data ?? [];
}

export async function getOpportunityDetail(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("opportunities")
    .select(
      `*, company:companies(id, slug, name, city, logo_path, verified_at, is_demo, kind),
       documents:opportunity_documents(id, file_name, mime_type, size_bytes, created_at),
       source:opportunity_sources(external_id, original_url, source_published_at, imported_at, last_verified_at, verification_status,
         external_source:external_sources(name, base_url, license, terms_url))`,
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}
