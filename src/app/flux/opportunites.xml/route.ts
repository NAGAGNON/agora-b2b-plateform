import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { siteUrl } from "@/lib/seo";
import { regionBySlug } from "@/lib/geo";
import { SECTOR_LABELS, sectorLabel } from "@/lib/constants";
import { renderRss } from "@/lib/rss";

const LIMIT = 50;

/**
 * Flux RSS des 50 dernières opportunités ouvertes et publiques (données de démonstration exclues).
 * Filtres facultatifs : ?secteur=<slug> et ?region=<slug>. Chaque offre externe cite sa source.
 */
export async function GET(req: Request) {
  const base = siteUrl();
  const params = new URL(req.url).searchParams;
  const sectorParam = params.get("secteur")?.trim() || null;
  const region = params.get("region") ? regionBySlug(params.get("region")!.trim()) : null;
  if ((sectorParam && !/^[a-z0-9-]{1,60}$/.test(sectorParam)) || (params.get("region") && !region)) {
    return new Response("Filtre inconnu", { status: 404 });
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return new Response("Indisponible", { status: 503 });
  // Client anonyme : seules les données publiques sont lisibles (RLS)
  const db = createClient<Database>(url, key, { auth: { persistSession: false } });

  const { data: sectors } = await db.from("sectors").select("slug, label");
  const labels = { ...SECTOR_LABELS, ...Object.fromEntries((sectors ?? []).map((s) => [s.slug, s.label])) };
  if (sectorParam && !labels[sectorParam]) return new Response("Filtre inconnu", { status: 404 });

  let query = db
    .from("opportunities")
    .select("id, title, summary, city, department_code, region, sector_slug, response_deadline, published_at, origin, external_buyer_name, source:opportunity_sources(is_primary, external_source:external_sources(name))")
    .eq("status", "PUBLISHED")
    .eq("visibility", "PUBLIC")
    .eq("is_demo", false)
    .or(`response_deadline.is.null,response_deadline.gt.${new Date().toISOString()}`)
    .order("published_at", { ascending: false })
    .limit(LIMIT);
  if (sectorParam) query = query.eq("sector_slug", sectorParam);
  if (region) query = query.eq("region", region.name);
  const { data, error } = await query;
  if (error) return new Response("Indisponible", { status: 503 });

  const scope = [sectorParam ? labels[sectorParam] : null, region?.name].filter(Boolean).join(" — ");
  const qs = new URLSearchParams();
  if (sectorParam) qs.set("secteur", sectorParam);
  if (region) qs.set("region", region.slug);
  const body = renderRss({
    base,
    title: `LinkProB2B — Appels d'offres et opportunités B2B${scope ? ` : ${scope}` : ""}`,
    description: "Les dernières opportunités ouvertes en France : marchés publics (BOAMP, TED) et besoins d'entreprises.",
    selfPath: `/flux/opportunites.xml${qs.size ? `?${qs}` : ""}`,
    items: (data ?? []).map((o) => {
      const sources = Array.isArray(o.source) ? o.source : o.source ? [o.source] : [];
      const primary = sources.find((s) => s.is_primary) ?? sources[0];
      const ext = primary?.external_source as { name: string } | { name: string }[] | null | undefined;
      const sourceName = Array.isArray(ext) ? ext[0]?.name : ext?.name;
      return {
        id: o.id,
        title: o.title,
        summary: o.summary,
        buyer: o.origin === "EXTERNAL" ? o.external_buyer_name : null,
        place: [o.city, o.department_code ? `(${o.department_code})` : null, o.region].filter(Boolean).join(" ") || null,
        sector: o.sector_slug ? sectorLabel(o.sector_slug, labels) : null,
        deadline: o.response_deadline,
        publishedAt: o.published_at,
        source: o.origin === "EXTERNAL" ? (sourceName ?? null) : "Publiée sur LinkProB2B",
      };
    }),
  });
  return new Response(body, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
  });
}
