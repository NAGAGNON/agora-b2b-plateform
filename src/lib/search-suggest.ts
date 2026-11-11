/**
 * Suggestions pendant la frappe (page Opportunités) : métiers et mots-clés courants des marchés,
 * secteurs, départements et villes. Recherche sans accents, sur le début des mots.
 */
export type Suggestion = { kind: "mot" | "secteur" | "departement" | "ville"; label: string; value: string; hint?: string };

/** Mots-clés fréquents des appels d'offres et besoins B2B (vocabulaire des métiers). */
export const KEYWORDS = [
  "électricité", "électricien", "éclairage public", "éclairage", "électromécanique", "élagage", "ascenseurs", "automatisme",
  "plomberie", "chauffage", "climatisation", "ventilation", "génie climatique", "chaudière", "pompe à chaleur", "photovoltaïque",
  "maintenance", "maintenance industrielle", "maintenance préventive", "dépannage", "contrôle technique", "vérifications périodiques",
  "nettoyage", "nettoyage de locaux", "nettoyage industriel", "vitrerie", "propreté", "désinfection", "dératisation", "hygiène",
  "gardiennage", "sécurité incendie", "surveillance", "vidéosurveillance", "contrôle d'accès", "alarme", "sûreté",
  "désamiantage", "démolition", "dépollution", "terrassement", "voirie", "VRD", "assainissement", "réseaux", "travaux publics",
  "gros œuvre", "maçonnerie", "charpente", "couverture", "toiture", "étanchéité", "façade", "ravalement", "menuiserie", "serrurerie",
  "métallerie", "peinture", "plâtrerie", "cloisons", "isolation", "revêtements de sol", "carrelage", "rénovation", "réhabilitation",
  "construction", "extension", "aménagement", "bâtiment", "second œuvre", "fermetures", "portes automatiques",
  "espaces verts", "entretien des espaces verts", "paysagiste", "déneigement", "arrosage", "aires de jeux", "mobilier urbain",
  "informatique", "logiciel", "développement", "application", "site internet", "hébergement", "infogérance", "cybersécurité",
  "réseau informatique", "télécommunications", "téléphonie", "fibre optique", "matériel informatique", "licences", "cloud", "données",
  "formation", "conseil", "audit", "accompagnement", "assistance à maîtrise d'ouvrage", "AMO", "maîtrise d'œuvre", "études",
  "bureau d'études", "diagnostic", "géomètre", "topographie", "ingénierie", "contrôle", "expertise", "assurance", "assurances",
  "transport", "transport scolaire", "transport de personnes", "logistique", "déménagement", "messagerie", "location de véhicules",
  "véhicules", "carburant", "flotte automobile", "poids lourds", "engins", "levage",
  "restauration collective", "restauration", "denrées alimentaires", "repas", "traiteur", "boissons", "fournitures",
  "fournitures de bureau", "papeterie", "mobilier", "équipements", "vêtements de travail", "équipements de protection", "EPI",
  "produits d'entretien", "matériel médical", "imprimerie", "impression", "reprographie", "communication", "événementiel",
  "audiovisuel", "signalétique", "marquage", "énergie", "gaz", "fioul", "eau", "déchets", "collecte des déchets", "recyclage",
  "centre d'appels", "accueil", "intérim", "recrutement", "prestations intellectuelles", "traduction", "juridique", "comptabilité",
  "banque", "crédit", "archivage", "numérisation", "courrier", "affranchissement", "sous-traitance", "usinage", "chaudronnerie",
  "soudure", "hydraulique", "pneumatique", "compresseurs", "robinetterie", "pompes", "groupes électrogènes", "onduleurs",
];

/** minuscules, sans accents ni ligatures, espaces simples */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 0 : le libellé commence par la saisie ; 1 : un mot du libellé commence par la saisie ; null : pas de correspondance. */
export function matchRank(label: string, query: string): number | null {
  const l = norm(label);
  const q = norm(query);
  if (!q) return null;
  if (l.startsWith(q)) return 0;
  if (l.split(/[\s\-/()]+/).some((w) => w.startsWith(q))) return 1;
  return null;
}

type Source = {
  sectors: { slug: string; label: string }[];
  departments: { code: string; name: string }[];
  places: { name: string; department_code: string | null }[];
};

/** Jusqu'à `limit` suggestions, les plus proches d'abord, sans doublon de libellé. */
export function suggest(query: string, src: Source, limit = 8): Suggestion[] {
  if (norm(query).length < 2) return [];
  const scored: { s: Suggestion; r: number; w: number; i: number }[] = [];
  const add = (s: Suggestion, label: string, weight: number) => {
    const r = matchRank(label, query);
    if (r !== null) scored.push({ s, r, w: weight, i: scored.length });
  };
  for (const k of KEYWORDS) add({ kind: "mot", label: k, value: k }, k, 0);
  for (const s of src.sectors) add({ kind: "secteur", label: s.label, value: s.slug, hint: "Secteur" }, s.label, 1);
  for (const d of src.departments) {
    add({ kind: "departement", label: `${d.name} (${d.code})`, value: d.code, hint: "Département" }, d.name, 2);
    if (d.code.toLowerCase() === norm(query)) scored.push({ s: { kind: "departement", label: `${d.name} (${d.code})`, value: d.code, hint: "Département" }, r: 0, w: -1, i: scored.length });
  }
  for (const p of src.places) add({ kind: "ville", label: p.name, value: p.name, hint: p.department_code ? `Ville (${p.department_code})` : "Ville" }, p.name, 3);
  // Plus proche d'abord, puis par type (mots, secteurs, lieux), puis dans l'ordre de la liste (mots les plus courants en tête)
  scored.sort((a, b) => a.r - b.r || a.w - b.w || a.i - b.i);
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const { s } of scored) {
    const key = `${s.kind}|${norm(s.label)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}
