import { KEYWORDS, norm } from "@/lib/search-suggest";
import { SKILL_CATALOG } from "@/lib/skill-catalog";

/**
 * Correction des fautes de frappe dans ce que les membres saisissent (compétences, mots-clés d'alerte,
 * compétences d'un besoin) : « Eau potalbe » → « Eau potable ». Seuls les mots proches d'un mot connu du
 * vocabulaire des métiers, par une faute de frappe typique, sont corrigés ; tout autre mot reste tel quel.
 */
const EXTRA = [
  "potable", "pluviales", "usées", "station", "épuration", "réservoir", "forage", "canalisations", "adduction", "hydraulique",
  "maîtrise", "œuvre", "ouvrage", "ordonnancement", "pilotage", "coordination", "programmation", "économiste", "métré",
  "structure", "fluides", "thermique", "acoustique", "géotechnique", "environnement", "urbanisme", "paysage", "voiries",
  "électrique", "électriques", "industrielle", "industriel", "préventive", "curative", "installation", "installations",
  "entretien", "réparation", "fourniture", "livraison", "prestation", "prestations", "nettoyage", "gardiennage",
];

const VOCAB: Map<string, string> = (() => {
  const m = new Map<string, string>();
  const add = (phrase: string) => {
    for (const w of phrase.split(/[\s'’()/,.-]+/)) {
      const n = norm(w).replace(/[^a-z0-9]/g, "");
      if (n.length >= 4 && !m.has(n)) m.set(n, w.toLowerCase());
    }
  };
  for (const k of KEYWORDS) add(k);
  for (const k of EXTRA) add(k);
  for (const list of Object.values(SKILL_CATALOG))
    for (const s of list) {
      add(s.label);
      for (const t of s.terms) add(t);
    }
  return m;
})();

/**
 * Variantes d'un mot par une faute de frappe typique : deux lettres voisines inversées (« potalbe »),
 * une lettre doublée oubliée (« nétoyage ») ou en trop (« maçonnnerie »). Une lettre remplacée par une
 * autre n'est jamais « corrigée » : « contre » et « centre » sont deux mots justes.
 */
function variants(n: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < n.length - 1; i++) {
    if (n[i] !== n[i + 1]) out.push(n.slice(0, i) + n[i + 1] + n[i] + n.slice(i + 2));
    else out.push(n.slice(0, i) + n.slice(i + 1));
  }
  for (let i = 0; i < n.length; i++) if (/[bcdflmnprst]/.test(n[i]) && n[i + 1] !== n[i] && n[i - 1] !== n[i]) out.push(n.slice(0, i + 1) + n[i] + n.slice(i + 1));
  return out;
}

const known = (n: string) => VOCAB.has(n) || VOCAB.has(n.replace(/[sx]$/, "")) || VOCAB.has(`${n}s`);

function correctWord(w: string): string {
  const n = norm(w).replace(/[^a-z0-9]/g, "");
  if (n.length < 5 || known(n)) return w;
  const hits = [...new Set(variants(n).filter((v) => VOCAB.has(v)).map((v) => VOCAB.get(v)!))];
  // Une seule correction possible, sinon on ne touche à rien
  if (hits.length !== 1) return w;
  const fixed = hits[0];
  return w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase() ? fixed.charAt(0).toUpperCase() + fixed.slice(1) : fixed;
}

/** Texte corrigé mot par mot (ponctuation et espaces conservés). */
export function correctTypos(text: string): string {
  return text.replace(/[\p{L}]+/gu, (w) => correctWord(w));
}
