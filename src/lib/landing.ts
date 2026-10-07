import "server-only";
import { getDepartments, getSectors } from "@/lib/queries/platform";
import { REGIONS, regionBySlug, regionByName } from "@/lib/geo";
import type { RawSearchParams } from "@/lib/search-params";

/**
 * Pages d'atterrissage SEO de /opportunites :
 *  /opportunites/france · /opportunites/<région> · /opportunites/<département> · /opportunites/<secteur>
 *  /opportunites/<région>/<département> · /opportunites/<région>/<secteur>
 * Indexables uniquement avec suffisamment d'opportunités ouvertes (pas de pages vides).
 */
export const MIN_INDEXABLE = 3;

export type Landing = {
  kind: "france" | "region" | "department" | "sector" | "region-sector";
  /** Filtres imposés par la page (paramètres d'URL de la recherche) */
  fixed: RawSearchParams;
  title: string;
  heading: string;
  intro: string;
  description: string;
  crumbs: { name: string; path: string }[];
  /** Liens vers des sous-pages (départements d'une région, régions…) */
  children?: { name: string; path: string }[];
};

export async function resolveLanding(slug: string, sub?: string): Promise<Landing | null> {
  const [sectors, departments] = await Promise.all([getSectors(), getDepartments()]);
  const region = regionBySlug(slug);
  if (sub) {
    if (!region) return null;
    const dep = departments.find((d) => d.slug === sub && d.region === region.name);
    if (dep) return departmentLanding(dep, region.slug);
    const sector = sectors.find((s) => s.slug === sub);
    if (!sector) return null;
    return {
      kind: "region-sector",
      fixed: { region: region.slug, secteur: sector.slug },
      title: `Opportunités ${sector.label.toLowerCase()} en ${region.name}`,
      heading: `${sector.label} — ${region.name}`,
      intro: `Appels d'offres, consultations et besoins d'entreprises en ${sector.label.toLowerCase()} dans la région ${region.name}.`,
      description: `Opportunités B2B et marchés publics en ${sector.label.toLowerCase()} en ${region.name} : appels d'offres, consultations et besoins d'entreprises, mis à jour chaque jour.`,
      crumbs: [{ name: region.name, path: `/opportunites/${region.slug}` }, { name: sector.label, path: `/opportunites/${region.slug}/${sector.slug}` }],
    };
  }
  if (slug === "france") {
    return {
      kind: "france",
      fixed: {},
      title: "Opportunités B2B et appels d'offres en France",
      heading: "Opportunités B2B partout en France",
      intro: "Appels d'offres, marchés publics, consultations et besoins d'entreprises dans toutes les régions, métropole et outre-mer.",
      description: "Toutes les opportunités B2B en France : appels d'offres publics (BOAMP, TED), consultations et besoins d'entreprises, par région, département et secteur.",
      crumbs: [{ name: "France", path: "/opportunites/france" }],
      children: REGIONS.map((r) => ({ name: r.name, path: `/opportunites/${r.slug}` })),
    };
  }
  // Une région partage parfois son nom avec un département d'outre-mer : la région prime.
  if (region) {
    return {
      kind: "region",
      fixed: { region: region.slug },
      title: `Opportunités B2B et appels d'offres en ${region.name}`,
      heading: `Opportunités B2B en ${region.name}`,
      intro: `Appels d'offres, marchés publics, consultations et besoins d'entreprises dans la région ${region.name}.`,
      description: `Opportunités B2B en ${region.name} : appels d'offres publics, consultations et besoins d'entreprises, par département et par secteur, mis à jour chaque jour.`,
      crumbs: [{ name: region.name, path: `/opportunites/${region.slug}` }],
      children: departments.filter((d) => d.region === region.name).map((d) => ({ name: `${d.name} (${d.code})`, path: `/opportunites/${region.slug}/${d.slug}` })),
    };
  }
  const sector = sectors.find((s) => s.slug === slug);
  if (sector) {
    return {
      kind: "sector",
      fixed: { secteur: sector.slug },
      title: `Opportunités ${sector.label.toLowerCase()} en France`,
      heading: `Opportunités — ${sector.label}`,
      intro: `Besoins publiés par des entreprises et marchés publics référencés dans le secteur ${sector.label.toLowerCase()}, partout en France.`,
      description: `Besoins d'entreprises, appels d'offres et consultations en ${sector.label.toLowerCase()} partout en France, par région et département.`,
      crumbs: [{ name: sector.label, path: `/opportunites/${sector.slug}` }],
      children: REGIONS.map((r) => ({ name: r.name, path: `/opportunites/${r.slug}/${sector.slug}` })),
    };
  }
  const dep = departments.find((d) => d.slug === slug);
  if (dep) return departmentLanding(dep, regionByName(dep.region)?.slug ?? null);
  return null;
}

function departmentLanding(dep: { code: string; name: string; slug: string; region: string }, regionSlug: string | null): Landing {
  return {
    kind: "department",
    fixed: { departement: dep.code },
    title: `Opportunités B2B — ${dep.name} (${dep.code})`,
    heading: `Opportunités dans le département ${dep.name}`,
    intro: `Besoins publiés par des entreprises et marchés publics référencés dans le département ${dep.name} (${dep.code}).`,
    description: `Besoins d'entreprises, appels d'offres et opportunités professionnelles dans le département ${dep.name} (${dep.code}), ${dep.region}.`,
    crumbs: [
      ...(regionSlug ? [{ name: dep.region, path: `/opportunites/${regionSlug}` }] : []),
      { name: dep.name, path: regionSlug ? `/opportunites/${regionSlug}/${dep.slug}` : `/opportunites/${dep.slug}` },
    ],
  };
}
