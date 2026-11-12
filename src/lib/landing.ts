import "server-only";
import { getDepartments, getOpenCounts, getSectors } from "@/lib/queries/platform";
import { REGIONS, regionBySlug, regionByName } from "@/lib/geo";
import type { RawSearchParams } from "@/lib/search-params";

/**
 * Pages d'atterrissage SEO de /opportunites :
 *  /opportunites/france · /opportunites/<région> · /opportunites/<département> · /opportunites/<secteur>
 *  /opportunites/<région>/<département> · /opportunites/<région>/<secteur>
 *  /opportunites/<région>/<département>/<secteur> (métier × département : « appels d'offres menuiserie Finistère »)
 * Indexables uniquement avec suffisamment d'opportunités ouvertes (pas de pages vides).
 */
export const MIN_INDEXABLE = 3;

export type Landing = {
  kind: "france" | "region" | "department" | "sector" | "region-sector" | "department-sector" | "specialty";
  /** Filtres imposés par la page (paramètres d'URL de la recherche) */
  fixed: RawSearchParams;
  title: string;
  heading: string;
  intro: string;
  description: string;
  crumbs: { name: string; path: string }[];
  /** Liens vers des sous-pages (départements d'une région, régions…) */
  children?: { name: string; path: string }[];
  /** Titre du bloc de liens (« Par département », « Par métier »…) */
  childrenLabel?: string;
  /** Second bloc de liens (pages voisines) */
  related?: { label: string; links: { name: string; path: string }[] };
};

type Specialty = { slug: string; label: string; q: string; what: string };

/**
 * Spécialités par métier : une page par spécialité, /opportunites/<secteur>/<spécialité>, appels
 * d'offres du secteur filtrés par mots-clés (recherches réelles relevées dans Google). Chaque
 * spécialité a été vérifiée sur les marchés ouverts (assez d'offres, mots-clés sans faux positifs).
 */
export const SPECIALTIES: Record<string, readonly Specialty[]> = {
  informatique: [
    { slug: "developpement-web", label: "Développement web et sites internet", q: '"site internet" OR "site web" OR "application web" OR "développement web"', what: "création et refonte de sites internet, applications web, portails et maintenance de sites" },
    { slug: "logiciel", label: "Logiciels et progiciels", q: "logiciel OR progiciel", what: "édition, intégration, maintenance et évolution de logiciels métier et de progiciels" },
    { slug: "infogerance", label: "Infogérance et maintenance informatique", q: 'infogérance OR "maintenance informatique" OR "support informatique" OR "assistance informatique"', what: "infogérance, support utilisateurs, maintenance du parc et assistance informatique" },
    { slug: "materiel-informatique", label: "Matériel informatique et serveurs", q: '"matériel informatique" OR ordinateurs OR "postes de travail" OR serveurs', what: "fourniture d'ordinateurs, postes de travail, serveurs et équipements informatiques" },
    { slug: "cloud-hebergement", label: "Cloud et hébergement", q: "cloud OR hébergement OR datacenter", what: "hébergement d'applications et de sites, cloud, centres de données" },
    { slug: "reseaux-telecoms", label: "Réseaux et télécoms", q: "réseau OR télécommunications OR téléphonie OR wifi", what: "réseaux informatiques, téléphonie, accès internet, Wi-Fi et télécommunications" },
    { slug: "donnees-ia", label: "Données et intelligence artificielle", q: '"intelligence artificielle" OR données OR data OR décisionnel', what: "systèmes d'information, données, décisionnel et intelligence artificielle" },
    { slug: "licences-logiciels", label: "Licences logicielles", q: 'licences OR "Microsoft 365" OR "Office 365"', what: "acquisition et renouvellement de licences logicielles et d'abonnements bureautiques" },
  ],
  "travaux-btp": [
    { slug: "voirie-reseaux", label: "Voirie et réseaux divers", q: 'voirie OR "réseaux divers" OR VRD OR chaussée', what: "travaux de voirie, réseaux divers (VRD), chaussées et aménagements de surface" },
    { slug: "desamiantage-demolition", label: "Désamiantage et démolition", q: "désamiantage OR démolition OR curage", what: "désamiantage, démolition, curage et déconstruction de bâtiments" },
    { slug: "toiture-couverture", label: "Toiture, couverture et étanchéité", q: "toiture OR couverture OR étanchéité", what: "réfection de toitures, couverture, zinguerie et étanchéité" },
    { slug: "peinture-revetements", label: "Peinture et revêtements", q: 'peinture OR "revêtements de sols" OR revêtements', what: "travaux de peinture, revêtements de sols et muraux" },
    { slug: "menuiserie", label: "Menuiserie", q: "menuiserie OR menuiseries", what: "menuiseries intérieures et extérieures, portes, fenêtres et agencement" },
  ],
  "nettoyage-proprete": [
    { slug: "nettoyage-locaux", label: "Nettoyage de locaux", q: '"nettoyage des locaux" OR "entretien des locaux" OR "nettoyage de bureaux"', what: "nettoyage et entretien de locaux, bureaux et bâtiments publics" },
    { slug: "vitrerie", label: "Vitrerie", q: "vitrerie OR vitres", what: "nettoyage de vitres et de surfaces vitrées" },
    { slug: "deratisation-desinsectisation", label: "Dératisation et désinsectisation", q: "dératisation OR désinsectisation OR nuisibles OR frelons", what: "dératisation, désinsectisation, lutte contre les nuisibles et les frelons" },
  ],
  "restauration-alimentation": [
    { slug: "restauration-collective", label: "Restauration collective", q: '"restauration collective" OR cantine OR repas', what: "restauration collective, cantines scolaires et fourniture de repas" },
    { slug: "traiteur", label: "Traiteur", q: "traiteur OR cocktail OR buffet", what: "prestations de traiteur, cocktails, buffets et réceptions" },
  ],
  "securite-surete": [
    { slug: "gardiennage", label: "Gardiennage et surveillance", q: 'gardiennage OR surveillance OR "agents de sécurité" OR sûreté', what: "gardiennage, surveillance de sites, agents de sécurité et sûreté" },
    { slug: "videoprotection", label: "Vidéoprotection et contrôle d'accès", q: "vidéoprotection OR vidéosurveillance OR \"contrôle d'accès\"", what: "vidéoprotection, vidéosurveillance et contrôle d'accès" },
  ],
  "transport-logistique": [
    { slug: "transport-personnes", label: "Transport de personnes", q: '"transport de personnes" OR "transport scolaire" OR "transport de voyageurs"', what: "transport de personnes, transport scolaire et de voyageurs" },
    { slug: "demenagement", label: "Déménagement", q: 'déménagement OR "transfert de mobilier"', what: "déménagements de bureaux, transferts de mobilier et d'archives" },
    { slug: "marchandises-logistique", label: "Transport de marchandises et logistique", q: 'stockage OR entreposage OR "plateforme logistique" OR "prestations logistiques" OR "transport de marchandises" OR fret OR messagerie OR affrètement OR "transport routier"', what: "transport de marchandises, messagerie, affrètement, stockage et prestations logistiques" },
  ],
};

/** Compatibilité : spécialités de l'informatique */
export const IT_SPECIALTIES = SPECIALTIES.informatique;

function specialtyLanding(sector: { slug: string; label: string }, slug: string): Landing | null {
  const list = SPECIALTIES[sector.slug];
  const sp = list?.find((x) => x.slug === slug);
  if (!list || !sp) return null;
  const label = sp.label.toLowerCase();
  return {
    kind: "specialty",
    fixed: { secteur: sector.slug, q: sp.q },
    title: `Appels d'offres ${label}`,
    heading: `Appels d'offres — ${sp.label}`,
    intro: `Marchés publics et besoins d'entreprises en ${sp.what}, partout en France, mis à jour chaque jour à partir des annonces officielles. Activez une alerte pour recevoir les nouveaux marchés dès leur publication.`,
    description: `Appels d'offres ${label} ouverts en France : ${sp.what}. Acheteurs, échéances et alerte gratuite, mis à jour chaque jour.`,
    crumbs: [
      { name: sector.label, path: `/opportunites/${sector.slug}` },
      { name: sp.label, path: `/opportunites/${sector.slug}/${sp.slug}` },
    ],
    childrenLabel: `Autres spécialités — ${sector.label}`,
    children: list.filter((x) => x.slug !== sp.slug).map((x) => ({ name: x.label, path: `/opportunites/${sector.slug}/${x.slug}` })),
  };
}

/** « dans le Finistère (29) », « en Gironde (33) »… : forme simple et neutre « dans le département X (code) ». */
const inDep = (d: { name: string; code: string }) => `${d.name} (${d.code})`;

export async function resolveLanding(slug: string, sub?: string, third?: string): Promise<Landing | null> {
  const [sectors, departments, count] = await Promise.all([getSectors(), getDepartments(), getOpenCounts()]);
  const region = regionBySlug(slug);
  if (third) {
    // Métier × département : /opportunites/<région>/<département>/<secteur>
    const dep = region && departments.find((d) => d.slug === sub && d.region === region.name);
    const sector = sectors.find((s) => s.slug === third);
    if (!region || !dep || !sector) return null;
    const label = sector.label.toLowerCase();
    const depPath = `/opportunites/${region.slug}/${dep.slug}`;
    const otherSectors = sectors.filter((s) => s.slug !== sector.slug && count("department_sector", `${dep.code}|${s.slug}`) > 0);
    const nearby = departments.filter((d) => d.region === region.name && d.code !== dep.code && count("department_sector", `${d.code}|${sector.slug}`) > 0);
    return {
      kind: "department-sector",
      fixed: { departement: dep.code, secteur: sector.slug },
      title: `Appels d'offres ${label} — ${inDep(dep)}`,
      heading: `${sector.label} — ${inDep(dep)}`,
      intro: `Appels d'offres, marchés publics et besoins d'entreprises en ${label} dans le département ${inDep(dep)}, mis à jour chaque jour. Activez une alerte pour recevoir les nouveaux marchés dès leur publication.`,
      description: `Marchés publics et appels d'offres ${label} dans le département ${inDep(dep)} : consultations ouvertes, échéances et acheteurs, mis à jour chaque jour. Alerte gratuite.`,
      crumbs: [
        { name: region.name, path: `/opportunites/${region.slug}` },
        { name: dep.name, path: depPath },
        { name: sector.label, path: `${depPath}/${sector.slug}` },
      ],
      childrenLabel: `Autres métiers — ${inDep(dep)}`,
      children: otherSectors.map((s) => ({ name: s.label, path: `${depPath}/${s.slug}` })),
      related: nearby.length
        ? { label: `${sector.label} dans les départements voisins`, links: nearby.map((d) => ({ name: inDep(d), path: `/opportunites/${region.slug}/${d.slug}/${sector.slug}` })) }
        : undefined,
    };
  }
  if (sub) {
    // Spécialité d'un métier : /opportunites/<secteur>/<spécialité>
    if (SPECIALTIES[slug]) {
      const sector = sectors.find((x) => x.slug === slug);
      return sector ? specialtyLanding(sector, sub) : null;
    }
    if (!region) return null;
    const dep = departments.find((d) => d.slug === sub && d.region === region.name);
    if (dep) return departmentLanding(dep, region.slug, sectors, count);
    const sector = sectors.find((s) => s.slug === sub);
    if (!sector) return null;
    const deps = departments.filter((d) => d.region === region.name && count("department_sector", `${d.code}|${sector.slug}`) > 0);
    return {
      kind: "region-sector",
      fixed: { region: region.slug, secteur: sector.slug },
      title: `${sector.label} : appels d'offres en ${region.name}`,
      heading: `${sector.label} — ${region.name}`,
      intro: `Appels d'offres, consultations et besoins d'entreprises en ${sector.label.toLowerCase()} dans la région ${region.name}.`,
      description: `Opportunités B2B et marchés publics en ${sector.label.toLowerCase()} en ${region.name} : appels d'offres, consultations et besoins d'entreprises, mis à jour chaque jour.`,
      crumbs: [{ name: region.name, path: `/opportunites/${region.slug}` }, { name: sector.label, path: `/opportunites/${region.slug}/${sector.slug}` }],
      childrenLabel: "Par département",
      children: deps.map((d) => ({ name: inDep(d), path: `/opportunites/${region.slug}/${d.slug}/${sector.slug}` })),
    };
  }
  if (slug === "france") {
    return {
      kind: "france",
      fixed: {},
      title: "Appels d'offres et opportunités B2B en France",
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
      title: `Appels d'offres et marchés en ${region.name}`,
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
      title: `Appels d'offres ${sector.label.toLowerCase()} en France`,
      heading: `Opportunités — ${sector.label}`,
      intro: `Besoins publiés par des entreprises et marchés publics référencés dans le secteur ${sector.label.toLowerCase()}, partout en France.`,
      description: `Besoins d'entreprises, appels d'offres et consultations en ${sector.label.toLowerCase()} partout en France, par région et département.`,
      crumbs: [{ name: sector.label, path: `/opportunites/${sector.slug}` }],
      children: REGIONS.map((r) => ({ name: r.name, path: `/opportunites/${r.slug}/${sector.slug}` })),
      ...(SPECIALTIES[sector.slug]
        ? { related: { label: "Par spécialité", links: SPECIALTIES[sector.slug].map((x) => ({ name: x.label, path: `/opportunites/${sector.slug}/${x.slug}` })) } }
        : {}),
    };
  }
  const dep = departments.find((d) => d.slug === slug);
  if (dep) return departmentLanding(dep, regionByName(dep.region)?.slug ?? null, sectors, count);
  return null;
}

function departmentLanding(
  dep: { code: string; name: string; slug: string; region: string },
  regionSlug: string | null,
  sectors: { slug: string; label: string }[],
  count: (dimension: string, key: string) => number,
): Landing {
  const withOpps = regionSlug ? sectors.filter((s) => count("department_sector", `${dep.code}|${s.slug}`) > 0) : [];
  return {
    kind: "department",
    fixed: { departement: dep.code },
    title: `Appels d'offres ${dep.name} (${dep.code})`,
    heading: `Opportunités dans le département ${dep.name}`,
    intro: `Besoins publiés par des entreprises et marchés publics référencés dans le département ${dep.name} (${dep.code}).`,
    description: `Besoins d'entreprises, appels d'offres et opportunités professionnelles dans le département ${dep.name} (${dep.code}), ${dep.region}.`,
    crumbs: [
      ...(regionSlug ? [{ name: dep.region, path: `/opportunites/${regionSlug}` }] : []),
      { name: dep.name, path: regionSlug ? `/opportunites/${regionSlug}/${dep.slug}` : `/opportunites/${dep.slug}` },
    ],
    childrenLabel: "Par métier",
    children: withOpps.map((s) => ({ name: s.label, path: `/opportunites/${regionSlug}/${dep.slug}/${s.slug}` })),
  };
}
