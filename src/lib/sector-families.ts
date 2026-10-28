/**
 * Familles de secteurs : regroupement des secteurs d'activité en grandes familles de métiers,
 * pour une recherche plus rapide (listes déroulantes, accueil). Un secteur absent d'une famille
 * (secteur ajouté depuis l'administration) est rangé dans « Autres secteurs ».
 */
export type SectorFamily = { slug: string; label: string; sectors: string[] };

export const SECTOR_FAMILIES: SectorFamily[] = [
  { slug: "industrie", label: "Industrie et production", sectors: ["maintenance-industrielle", "fournitures-industrielles", "sous-traitance-industrielle", "electricite-automatisme"] },
  { slug: "btp", label: "BTP et ingénierie", sectors: ["travaux-btp", "batiment-technique", "ingenierie-etudes"] },
  { slug: "energie-environnement", label: "Énergie et environnement", sectors: ["energie", "espaces-verts"] },
  { slug: "numerique", label: "Numérique et télécoms", sectors: ["informatique", "cybersecurite", "telecoms"] },
  { slug: "conseil-services", label: "Conseil, formation et finance", sectors: ["conseil", "formation", "assurances-finance", "services-aux-entreprises", "communication-evenementiel"] },
  { slug: "services-generaux", label: "Services généraux et logistique", sectors: ["transport-logistique", "nettoyage-proprete", "securite-surete", "restauration-alimentation"] },
];

/** Secteurs rangés par famille, dans l'ordre des familles ; les secteurs inconnus vont dans « Autres secteurs ». */
export function groupSectors<S extends { slug: string }>(sectors: S[]): { family: SectorFamily; sectors: S[] }[] {
  const bySlug = new Map(sectors.map((s) => [s.slug, s]));
  const used = new Set<string>();
  const groups = SECTOR_FAMILIES.map((family) => {
    const list = family.sectors.map((slug) => bySlug.get(slug)).filter((s): s is S => Boolean(s));
    list.forEach((s) => used.add(s.slug));
    return { family, sectors: list };
  }).filter((g) => g.sectors.length > 0);
  const others = sectors.filter((s) => !used.has(s.slug));
  if (others.length) groups.push({ family: { slug: "autres", label: "Autres secteurs", sectors: others.map((s) => s.slug) }, sectors: others });
  return groups;
}
