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
  // Noms de métiers : la recherche les relie aux offres de leur domaine (« plombier » → plomberie)
  "plombier", "peintre", "menuisier", "couvreur", "carreleur", "serrurier", "maçon", "plaquiste", "chauffagiste", "frigoriste",
  "jardinier", "paysagiste", "élagueur", "vitrier", "imprimeur", "développeur", "informaticien", "graphiste", "photographe",
  "transporteur", "déménageur", "agent de sécurité", "agent d'entretien", "formateur", "traducteur", "comptable", "architecte",
  "géomètre", "ascensoriste", "soudeur", "mécanicien", "consultant",
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

/** Distance d'édition (lettres ajoutées, retirées ou changées) entre deux mots. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Fautes tolérées : 1 lettre jusqu'à 6 lettres, 2 au-delà. */
const tolerance = (len: number) => (len < 4 ? 0 : len < 7 ? 1 : 2);

/** Vocabulaire des métiers (mots de 4 lettres et plus), sans accents → forme écrite correctement. */
const VOCAB: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const k of KEYWORDS)
    for (const w of k.split(/[\s'’()-]+/)) {
      const n = norm(w);
      if (n.length >= 4 && !m.has(n)) m.set(n, w);
    }
  return m;
})();

/**
 * Recherche sans résultat : corrige les fautes de frappe mot par mot à partir du vocabulaire des métiers
 * (« nétoyage » → « nettoyage », « maconerie » → « maçonnerie »). Renvoie null s'il n'y a rien à corriger.
 */
export function correctQuery(query: string): string | null {
  const words = query.trim().split(/\s+/);
  let changed = false;
  const out = words.map((w) => {
    const n = norm(w).replace(/[^a-z0-9]/g, "");
    const tol = tolerance(n.length);
    // Mot connu, ou simple pluriel / singulier d'un mot connu : rien à corriger
    if (!tol || VOCAB.has(n) || VOCAB.has(n.replace(/[sx]$/, "")) || VOCAB.has(`${n}s`)) return w;
    let best: { word: string; d: number } | null = null;
    for (const [v, written] of VOCAB) {
      if (Math.abs(v.length - n.length) > tol) continue;
      const d = editDistance(n, v);
      if (d <= tol && (!best || d < best.d)) best = { word: written, d };
    }
    if (!best) return w;
    changed = true;
    return best.word;
  });
  return changed ? out.join(" ") : null;
}

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
  // Faute de frappe (« netoy », « maconer ») : métiers dont le début est très proche de la saisie
  const q = norm(query);
  const tol = tolerance(q.length);
  if (tol && scored.length < limit) {
    for (const k of KEYWORDS) {
      const l = norm(k);
      const d = Math.min(...[q.length - 1, q.length, q.length + 1].map((n) => editDistance(l.slice(0, n), q)));
      if (matchRank(k, query) === null && d <= tol) scored.push({ s: { kind: "mot", label: k, value: k }, r: 2, w: 0, i: scored.length });
    }
  }
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
