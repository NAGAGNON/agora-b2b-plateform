import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { siteUrl } from "@/lib/seo";
import { GUIDES } from "@/content/guides";
import { BRITTANY_DEPARTMENTS, SECTORS } from "@/lib/constants";

export const revalidate = 3600;

/**
 * Plan du site : pages publiques, opportunités publiées et publiques, entreprises
 * de l'annuaire, et pages secteur / département UNIQUEMENT lorsqu'elles ont du
 * contenu réel (pas de pages vides générées en masse). Données de démonstration exclues.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();
  const staticPaths = ["", "/opportunites", "/entreprises", "/publier", "/comment-ca-marche", "/ressources", "/fournisseurs", "/demandeurs", "/faq", "/a-propos", "/tarifs", "/contact", "/mentions-legales", "/cgu", "/confidentialite", "/cookies"];
  const entries: MetadataRoute.Sitemap = staticPaths.map((p) => ({ url: `${base}${p}`, lastModified: now, changeFrequency: p === "/opportunites" ? "daily" : "monthly", priority: p === "" ? 1 : 0.6 }));
  entries.push(...GUIDES.map((g) => ({ url: `${base}/ressources/${g.slug}`, changeFrequency: "monthly" as const, priority: 0.5 })));

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return entries;
  // Client anonyme : seules les données publiques sont lisibles (RLS).
  const db = createClient<Database>(url, key, { auth: { persistSession: false } });
  const [{ data: opps }, { data: companies }] = await Promise.all([
    db.from("opportunities").select("id, updated_at, sector_slug, department_code").eq("status", "PUBLISHED").eq("visibility", "PUBLIC").eq("is_demo", false).limit(5000),
    db.from("companies").select("slug, updated_at, department_code, company_profiles!inner(is_public, sectors)").eq("status", "ACTIVE").eq("is_demo", false).eq("company_profiles.is_public", true).limit(5000),
  ]);
  for (const o of opps ?? []) entries.push({ url: `${base}/opportunites/${o.id}`, lastModified: new Date(o.updated_at), changeFrequency: "weekly", priority: 0.7 });
  for (const c of companies ?? []) entries.push({ url: `${base}/entreprises/${c.slug}`, lastModified: new Date(c.updated_at), changeFrequency: "monthly", priority: 0.5 });

  for (const s of SECTORS) if ((opps ?? []).some((o) => o.sector_slug === s.slug)) entries.push({ url: `${base}/opportunites/${s.slug}`, changeFrequency: "daily", priority: 0.6 });
  for (const d of BRITTANY_DEPARTMENTS) if ((opps ?? []).some((o) => o.department_code === d.code)) entries.push({ url: `${base}/opportunites/${d.slug}`, changeFrequency: "daily", priority: 0.6 });
  for (const s of SECTORS) {
    const inSector = (companies ?? []).filter((c) => {
      const prof = c.company_profiles as unknown as { sectors: string[] } | { sectors: string[] }[];
      return (Array.isArray(prof) ? prof : [prof]).some((p) => p.sectors.includes(s.slug));
    });
    if (inSector.length) entries.push({ url: `${base}/entreprises/${s.slug}`, changeFrequency: "weekly", priority: 0.5 });
    for (const d of BRITTANY_DEPARTMENTS) {
      if (inSector.some((c) => c.department_code === d.code)) entries.push({ url: `${base}/entreprises/${s.slug}/${d.slug}`, changeFrequency: "weekly", priority: 0.4 });
    }
  }
  return entries;
}
