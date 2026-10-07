import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/geo";
import type { FetchLike } from "@/lib/collect/connectors";

/**
 * Référentiel des villes : communes de France issues de l'API officielle
 * « Découpage administratif » (geo.api.gouv.fr, Licence Ouverte). Sert à la
 * recherche par rayon, au filtre par ville et à la géolocalisation des annonces.
 * Import automatique (tâche planifiée) tant que le référentiel national est absent ;
 * les villes déjà présentes (Bretagne) sont conservées telles quelles.
 */
export const GEO_ENDPOINT = "https://geo.api.gouv.fr/communes?fields=nom,code,codesPostaux,centre,population,codeDepartement&format=json&geometry=centre";
export const MIN_POPULATION = 10_000;

type Commune = { nom: string; code: string; codesPostaux?: string[]; centre?: { coordinates?: [number, number] }; population?: number; codeDepartement?: string };

export async function importPlaces(opts: { fetchImpl?: FetchLike; force?: boolean } = {}) {
  const db = createAdminClient();
  const { count } = await db.from("places").select("id", { count: "exact", head: true }).not("insee_code", "is", null);
  if (!opts.force && (count ?? 0) >= 100) return { skipped: true, existing: count };

  const res = await (opts.fetchImpl ?? fetch)(GEO_ENDPOINT, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`geo.api.gouv.fr : HTTP ${res.status}`);
  const communes = ((await res.json()) as Commune[])
    .filter((c) => (c.population ?? 0) >= MIN_POPULATION && c.centre?.coordinates?.length === 2 && c.codeDepartement && c.codesPostaux?.length)
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

  const [{ data: deps }, { data: existing }] = await Promise.all([
    db.from("departments").select("code, name, region"),
    db.from("places").select("slug, name, department_code"),
  ]);
  const depByCode = new Map((deps ?? []).map((d) => [d.code, d]));
  const slugs = new Set((existing ?? []).map((p) => p.slug));
  const known = new Set((existing ?? []).map((p) => `${slugify(p.name)}|${p.department_code}`));

  const rows = [];
  for (const c of communes) {
    const dep = depByCode.get(c.codeDepartement!);
    if (!dep) continue;
    const base = slugify(c.nom);
    if (known.has(`${base}|${dep.code}`)) {
      // Ville déjà présente : on complète seulement son code INSEE et sa population
      await db.from("places").update({ insee_code: c.code, population: c.population ?? null }).eq("department_code", dep.code).ilike("name", c.nom).is("insee_code", null);
      continue;
    }
    let slug = slugs.has(base) ? `${base}-${dep.code.toLowerCase()}` : base;
    if (slugs.has(slug)) slug = `${base}-${c.code}`;
    slugs.add(slug);
    const [lng, lat] = c.centre!.coordinates!;
    rows.push({
      name: c.nom, slug, postal_code: [...c.codesPostaux!].sort()[0], department_code: dep.code, department_name: dep.name,
      region: dep.region, lat, lng, population: c.population ?? null, insee_code: c.code,
    });
  }
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("places").insert(rows.slice(i, i + 500));
    if (error) throw new Error(`insertion des villes : ${error.message}`);
    inserted += Math.min(500, rows.length - i);
  }
  return { skipped: false, fetched: communes.length, inserted };
}
