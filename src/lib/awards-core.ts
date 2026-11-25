import { buyerSlug } from "@/lib/buyer-slug";
import { normalizeDepartment } from "@/lib/geo";
import { classifySector } from "@/lib/collect/classify";

/** Clé d'une entreprise titulaire : nom sans forme juridique (« COLAS FRANCE SAS » = « Colas France »). */
export function winnerKey(name: string): string | null {
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(sas|sasu|sarl|eurl|sa|sci|snc|ei|eirl|scop|societe|ste|ets|etablissements)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return n.length >= 2 ? buyerSlug(n) : null;
}

// Prénoms courants : un titulaire « Prénom Nom » sans forme juridique est un entrepreneur individuel,
// une personne — il n'apparaît pas dans les pages publiques.
const FIRST_NAMES = new Set(
  (
    "jean pierre michel philippe alain nicolas christophe patrick daniel bernard eric frederic laurent stephane david olivier thierry pascal julien sebastien " +
    "francois christian thomas jerome guillaume vincent dominique gilles herve didier bruno fabrice serge yves marc antoine franck jacques sylvain " +
    "mathieu matthieu maxime romain alexandre benjamin cedric damien emmanuel fabien gregory jeremy jonathan kevin ludovic arnaud lionel mickael " +
    "marie nathalie isabelle sylvie catherine francoise christine sandrine valerie stephanie sophie celine veronique patricia martine nadine " +
    "anne aurelie caroline claire emilie julie laure laura lucie camille chloe elodie helene karine melanie pauline sarah virginie corinne " +
    "brigitte monique chantal annie josiane joelle mireille agnes beatrice delphine florence muriel nicole odile pascale severine audrey " +
    "hugo louis lucas leo gabriel arthur jules paul raphael adam victor mohamed ahmed karim mehdi rachid samir yannick yann loic"
  ).split(" "),
);
const COMPANY_MARKERS = /\b(sas|sasu|sarl|eurl|sa|sci|snc|scop|scic|gie|groupe|group|societe|ste|ets|etablissements|entreprise|cabinet|agence|atelier|association|france|services?|industrie|bureau|conseil|ingenierie|travaux|batiment|energie|ccas|cie|compagnie|holding|international|solutions|technologies|consulting)\b|[&0-9@]/i;

/** Vrai si le titulaire ressemble à une personne (« Jean Dupont », « M. Martin ») plutôt qu'à une entreprise. */
export function isLikelyPerson(name: string): boolean {
  const s = name.normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  if (/^(m|mr|mme|mlle|monsieur|madame|maitre|me|dr|docteur)\b\.?\s/i.test(s)) return true;
  if (COMPANY_MARKERS.test(s)) return false;
  const words = s.toLowerCase().split(/[\s-]+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  return words.some((w) => FIRST_NAMES.has(w));
}

export type AwardRow = {
  idweb: string;
  title: string;
  buyer_name: string | null;
  winners: string[];
  winner_keys: string[];
  published_on: string;
  department_code: string | null;
  sector_slug: string | null;
  market_type: string | null;
  url: string | null;
};

const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)]).map((s) => s.trim()).filter(Boolean);

/** Avis d'attribution BOAMP → ligne de la table awards (null si aucun titulaire publiable). */
export function mapAward(r: Record<string, unknown>): AwardRow | null {
  const idweb = typeof r.idweb === "string" ? r.idweb : null;
  const title = typeof r.objet === "string" ? r.objet.replace(/\s+/g, " ").trim().slice(0, 500) : "";
  const date = typeof r.dateparution === "string" ? r.dateparution.slice(0, 10) : null;
  if (!idweb || title.length < 5 || !date) return null;
  const seen = new Set<string>();
  const winners: string[] = [];
  const keys: string[] = [];
  for (const raw of list(r.titulaire)) {
    const name = raw.replace(/\s+/g, " ").slice(0, 160);
    if (isLikelyPerson(name)) continue;
    const key = winnerKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    winners.push(name);
    keys.push(key);
  }
  if (!winners.length) return null;
  const descr = list(r.descripteur_libelle).join(", ");
  return {
    idweb,
    title,
    buyer_name: typeof r.nomacheteur === "string" ? r.nomacheteur.trim().slice(0, 200) : null,
    winners: winners.slice(0, 10),
    winner_keys: keys.slice(0, 10),
    published_on: date,
    department_code: normalizeDepartment(list(r.code_departement)[0]),
    sector_slug: classifySector([], `${title} ${descr}`).sector,
    market_type: list(r.type_marche)[0]?.slice(0, 40) ?? null,
    url: typeof r.url_avis === "string" ? r.url_avis : `https://www.boamp.fr/pages/avis/?q=idweb:${idweb}`,
  };
}
