/**
 * Comparaison entre une certification exigée par un avis (« Qualibat 1311 ou équivalent ») et celles
 * renseignées sur la fiche de l'entreprise. Prudente : en cas de doute, « à vérifier », jamais « oui ».
 */
export type CertStatus = "ok" | "check" | "missing";

const GENERIC = new Set([
  "certification", "certifications", "certificat", "qualification", "qualifications", "label", "labels", "norme", "normes",
  "habilitation", "habilitations", "niveau", "equivalent", "equivalente", "ou", "et", "de", "des", "du", "la", "le", "les",
  "pour", "en", "cours", "validite", "valide", "attestation", "type", "minimum", "exige", "exigee", "requis", "requise",
]);

export const normCert = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Mots distinctifs (marque ou intitulé) et numéros d'une certification. */
function parts(s: string) {
  const words = normCert(s).split(" ").filter(Boolean);
  return {
    names: words.filter((w) => !/^\d+$/.test(w) && w.length >= 2 && !GENERIC.has(w)),
    numbers: words.filter((w) => /^\d+$/.test(w)),
  };
}

export function certStatus(required: string, mine: string[]): CertStatus {
  const r = parts(required);
  if (!r.names.length && !r.numbers.length) return "check";
  let best: CertStatus = "missing";
  for (const m of mine) {
    const c = parts(m);
    const sameName = r.names.length > 0 && r.names.some((n) => c.names.includes(n));
    if (!sameName) continue;
    // Même intitulé : les numéros exigés (ex. Qualibat 1311) doivent aussi figurer sur la fiche
    if (r.numbers.every((n) => c.numbers.includes(n))) return "ok";
    best = "check";
  }
  return best;
}
