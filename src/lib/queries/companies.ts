import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/errors";
import { PAGE_SIZE } from "@/lib/constants";
import { showDemoData } from "@/lib/queries/platform";
import { visitorRpc } from "@/lib/queries/public-cache";
import type { CompanyFilters } from "@/lib/search-params";
import { SECTOR_FAMILIES } from "@/lib/sector-families";

export async function searchCompanies(f: CompanyFilters, pageSize = PAGE_SIZE) {
  // Famille de métiers (tuiles « Explorer par domaine ») : ignorée si un secteur précis est choisi
  const family = !f.sector && f.family ? SECTOR_FAMILIES.find((x) => x.slug === f.family) : undefined;
  const { data, error } = await visitorRpc("search_companies", {
    p_q: f.q,
    p_sector: f.sector,
    p_sectors: family?.sectors,
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

/** Nombre réel d'entreprises visibles dans l'annuaire, par famille de métiers (tuiles par domaine). */
export async function directoryFamilyCounts(): Promise<Map<string, number>> {
  const { data, error } = await visitorRpc("directory_family_counts", {
    p_families: Object.fromEntries(SECTOR_FAMILIES.map((f) => [f.slug, f.sectors])),
    p_include_demo: await showDemoData(),
  });
  if (error) logServerError("directory_family_counts", error);
  return new Map((data ?? []).map((r) => [r.family, Number(r.companies)]));
}

// Partagé entre les métadonnées et la page dans une même requête (une seule lecture)
export const getCompanyBySlug = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("*, profile:company_profiles(*)").eq("slug", slug).maybeSingle();
  return data;
});
