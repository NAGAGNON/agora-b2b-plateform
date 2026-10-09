import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { siteUrl } from "@/lib/seo";
import { GUIDES } from "@/content/guides";
import { REGIONS } from "@/lib/geo";

const MIN_INDEXABLE = 3;

export const revalidate = 3600;

/**
 * Plan du site : pages publiques, opportunités publiées et publiques, entreprises
 * de l'annuaire, et pages secteur / département UNIQUEMENT lorsqu'elles ont du
 * contenu réel (pas de pages vides générées en masse). Données de démonstration exclues.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const staticPaths = ["", "/opportunites", "/entreprises", "/publier", "/comment-ca-marche", "/ressources", "/analyses", "/acheteurs", "/fournisseurs", "/demandeurs", "/faq", "/a-propos", "/tarifs", "/contact", "/mentions-legales", "/cgu", "/confidentialite", "/cookies", "/conditions-abonnement"];
  // Pas de date de modification pour les pages fixes : une date toujours « maintenant » serait ignorée par Google
  const entries: MetadataRoute.Sitemap = staticPaths.map((p) => ({ url: `${base}${p}`, changeFrequency: p === "/opportunites" ? "daily" : "monthly", priority: p === "" ? 1 : 0.6 }));
  entries.push(...GUIDES.map((g) => ({ url: `${base}/ressources/${g.slug}`, changeFrequency: "monthly" as const, priority: 0.5 })));

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return entries;
  // Client anonyme : seules les données publiques sont lisibles (RLS).
  const db = createClient<Database>(url, key, { auth: { persistSession: false } });
  // Lecture par pages : l'API de la base renvoie au plus 1000 lignes par requête
  const paged = async <T,>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null }>, maxPages: number) => {
    const all: T[] = [];
    for (let page = 0; page < maxPages; page++) {
      const { data } = await query(page * 1000, page * 1000 + 999);
      all.push(...(data ?? []));
      if ((data ?? []).length < 1000) break;
    }
    return { data: all };
  };
  // Opportunités encore ouvertes (date limite non dépassée), un seul fichier : 50 000 adresses au plus
  const nowIso = new Date().toISOString();
  const [{ data: opps }, { data: companies }, { data: sectorRows }, { data: deptRows }, { data: articles }, { data: counts }] = await Promise.all([
    paged(
      (from, to) =>
        db.from("opportunities").select("id, updated_at").eq("status", "PUBLISHED").eq("visibility", "PUBLIC").eq("is_demo", false)
          .or(`response_deadline.is.null,response_deadline.gt.${nowIso}`)
          .order("published_at", { ascending: false }).range(from, to),
      40,
    ),
    paged(
      (from, to) =>
        db.from("companies").select("slug, updated_at, department_code, company_profiles!inner(is_public, sectors)").eq("status", "ACTIVE").eq("is_demo", false).eq("company_profiles.is_public", true)
          .order("slug").range(from, to),
      5,
    ),
    db.from("sectors").select("slug").eq("is_active", true),
    db.from("departments").select("code, slug, region"),
    paged((from, to) => db.from("articles").select("slug, updated_at").eq("status", "PUBLISHED").order("published_at", { ascending: false }).range(from, to), 5),
    db.rpc("open_opportunity_counts"),
  ]);
  // Acheteurs publics avec au moins un appel d'offres ouvert
  const { data: buyers } = await db.rpc("public_buyers", { p_limit: 10000, p_offset: 0 });
  for (const b of buyers ?? []) entries.push({ url: `${base}/acheteurs/${b.slug}`, ...(b.last_published_at ? { lastModified: new Date(b.last_published_at) } : {}), changeFrequency: "daily", priority: 0.6 });
  // Pages d'atterrissage avec suffisamment d'opportunités ouvertes (pas de pages vides)
  const n = (dimension: string, key: string | null) => (counts ?? []).find((c) => c.dimension === dimension && c.key === key)?.n ?? 0;
  const landing = (path: string) => entries.push({ url: `${base}${path}`, changeFrequency: "daily", priority: 0.6 });
  const SECTORS = sectorRows ?? [];
  const DEPARTMENTS = deptRows ?? [];
  for (const o of opps ?? []) entries.push({ url: `${base}/opportunites/${o.id}`, lastModified: new Date(o.updated_at), changeFrequency: "weekly", priority: 0.7 });
  for (const a of articles ?? []) entries.push({ url: `${base}/analyses/${a.slug}`, lastModified: new Date(a.updated_at), changeFrequency: "monthly", priority: 0.6 });
  for (const c of companies ?? []) entries.push({ url: `${base}/entreprises/${c.slug}`, lastModified: new Date(c.updated_at), changeFrequency: "monthly", priority: 0.5 });

  // « /opportunites/france » reprend la liste complète : canonique vers /opportunites, absente du plan du site
  for (const r of REGIONS) {
    if (n("region", r.name) < MIN_INDEXABLE) continue;
    landing(`/opportunites/${r.slug}`);
    for (const d of DEPARTMENTS.filter((d) => d.region === r.name)) if (n("department", d.code) >= MIN_INDEXABLE) landing(`/opportunites/${r.slug}/${d.slug}`);
    for (const s of SECTORS) if (n("region_sector", `${r.name}|${s.slug}`) >= MIN_INDEXABLE) landing(`/opportunites/${r.slug}/${s.slug}`);
  }
  for (const s of SECTORS) if (n("sector", s.slug) >= MIN_INDEXABLE) landing(`/opportunites/${s.slug}`);
  for (const s of SECTORS) {
    const inSector = (companies ?? []).filter((c) => {
      const prof = c.company_profiles as unknown as { sectors: string[] } | { sectors: string[] }[];
      return (Array.isArray(prof) ? prof : [prof]).some((p) => p.sectors.includes(s.slug));
    });
    // Annuaire : même seuil que les pages d'opportunités (pas de page avec une seule entreprise)
    if (inSector.length >= MIN_INDEXABLE) entries.push({ url: `${base}/entreprises/${s.slug}`, changeFrequency: "weekly", priority: 0.5 });
    for (const d of DEPARTMENTS) {
      if (inSector.filter((c) => c.department_code === d.code).length >= MIN_INDEXABLE) entries.push({ url: `${base}/entreprises/${s.slug}/${d.slug}`, changeFrequency: "weekly", priority: 0.4 });
    }
  }
  return entries;
}
