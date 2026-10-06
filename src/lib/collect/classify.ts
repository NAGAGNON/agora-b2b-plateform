import { normalizeText } from "@/lib/collect/normalize";

/**
 * Classification sectorielle explicable :
 *  1. par code CPV (vocabulaire commun des marchés publics) lorsqu'il est fourni ;
 *  2. sinon par mots-clés dans l'objet et les descripteurs.
 * Les règles sont ordonnées du plus spécifique au plus général.
 */
const CPV_RULES: [prefix: string, sector: string][] = [
  ["7273", "cybersecurite"],
  ["79711", "securite-surete"],
  ["79713", "securite-surete"],
  ["79714", "securite-surete"],
  ["35", "securite-surete"],
  ["5071", "batiment-technique"],
  ["5073", "batiment-technique"],
  ["5070", "batiment-technique"],
  ["5053", "maintenance-industrielle"],
  ["5051", "maintenance-industrielle"],
  ["505", "maintenance-industrielle"],
  ["5031", "informatique"],
  ["5032", "informatique"],
  ["5033", "telecoms"],
  ["5034", "telecoms"],
  ["501", "transport-logistique"],
  ["50", "maintenance-industrielle"],
  ["3171", "electricite-automatisme"],
  ["3168", "electricite-automatisme"],
  ["4296", "electricite-automatisme"],
  ["4290", "maintenance-industrielle"],
  ["42", "fournitures-industrielles"],
  ["43", "fournitures-industrielles"],
  ["44", "fournitures-industrielles"],
  ["31", "electricite-automatisme"],
  ["38", "fournitures-industrielles"],
  ["18143", "fournitures-industrielles"],
  ["45", "batiment-technique"],
  ["09", "energie"],
  ["65", "energie"],
  ["7131", "energie"],
  ["713", "ingenierie-etudes"],
  ["712", "ingenierie-etudes"],
  ["71", "ingenierie-etudes"],
  ["72", "informatique"],
  ["48", "informatique"],
  ["302", "informatique"],
  ["30", "informatique"],
  ["64", "telecoms"],
  ["32", "telecoms"],
  ["909", "nettoyage-proprete"],
  ["905", "nettoyage-proprete"],
  ["90", "nettoyage-proprete"],
  ["80", "formation"],
  ["794", "conseil"],
  ["793", "conseil"],
  ["79", "services-aux-entreprises"],
  ["60", "transport-logistique"],
  ["63", "transport-logistique"],
  ["34", "transport-logistique"],
];

const KEYWORD_RULES: [RegExp, string][] = [
  [/\b(cyber|securite (des )?systemes? d information|ssi|pentest|intrusion|soc)\b/, "cybersecurite"],
  [/\b(gardiennage|surveillance humaine|securite incendie|ssiap|videoprotection|videosurveillance|controle d acces|alarme)\b/, "securite-surete"],
  [/\b(nettoyage|proprete|entretien des locaux|hygiene|dechets|deratisation)\b/, "nettoyage-proprete"],
  [/\b(formation|habilitation|caces|sst)\b/, "formation"],
  [/\b(automate|automatisme|instrumentation|electricite industrielle|armoire electrique|haute tension|basse tension|courants? faibles?)\b/, "electricite-automatisme"],
  [/\b(maintenance|depannage|entretien preventif|maintenance preventive|maintenance corrective|compresseur|pompes?|groupe electrogene|ascenseurs?)\b/, "maintenance-industrielle"],
  [/\b(chauffage|climatisation|ventilation|cvc|plomberie|genie climatique|multitechnique)\b/, "batiment-technique"],
  [/\b(energie|photovoltaique|chaufferie|eclairage public|electricite (fourniture|acheminement)|gaz naturel)\b/, "energie"],
  [/\b(usinage|chaudronnerie|soudure|tolerie|mecanique|fabrication)\b/, "sous-traitance-industrielle"],
  [/\b(maitrise d oeuvre|bureau d etudes|etudes? techniques?|diagnostic|controle technique|assistance a maitrise d ouvrage|amo|ingenierie)\b/, "ingenierie-etudes"],
  [/\b(logiciel|informatique|infogerance|serveurs?|postes? de travail|progiciel|applicatif|cloud|licences?)\b/, "informatique"],
  [/\b(telecom|telephonie|fibre optique|reseau radio|radiocommunication|wifi)\b/, "telecoms"],
  [/\b(transport|logistique|demenagement|messagerie|livraison|vehicules?|carburant)\b/, "transport-logistique"],
  [/\b(fourniture|equipements?|materiels?|outillage|pieces detachees|epi)\b/, "fournitures-industrielles"],
  [/\b(conseil|audit|accompagnement)\b/, "conseil"],
];

export type Classification = { sector: string | null; rule: string | null };

export function classifySector(cpv: string[], text: string): Classification {
  for (const code of cpv.map((c) => c.replace(/\D/g, ""))) {
    if (code.length < 2) continue;
    const rule = CPV_RULES.find(([prefix]) => code.startsWith(prefix));
    if (rule) return { sector: rule[1], rule: `cpv:${rule[0]}` };
  }
  const t = normalizeText(text);
  for (const [re, sector] of KEYWORD_RULES) if (re.test(t)) return { sector, rule: `mot-cle:${sector}` };
  return { sector: null, rule: null };
}

/** Mots-clés indexables extraits des descripteurs fournis par la source. */
export function extractKeywords(values: string[], max = 10): string[] {
  const out: string[] = [];
  for (const v of values) {
    const s = v.trim().slice(0, 60);
    if (s && !out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}
