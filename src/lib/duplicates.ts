/**
 * Appels d'offres en double (même intitulé, même acheteur : avis rectificatifs, lots publiés
 * séparément, même marché sur BOAMP et TED). Une seule page est proposée aux moteurs de recherche :
 * la plus ancienne encore ouverte. Les autres y renvoient (adresse canonique) et sortent du plan du site.
 */
export type DupCandidate = { id: string; title: string; external_buyer_name: string | null; published_at: string | null };

export function duplicateKey(o: Pick<DupCandidate, "title" | "external_buyer_name">): string | null {
  if (!o.external_buyer_name) return null;
  return `${o.title.trim().toLowerCase().replace(/\s+/g, " ")}|${o.external_buyer_name.trim().toLowerCase()}`;
}

/** Ordre de préférence : publiée la première, puis identifiant (stable). */
function before(a: DupCandidate, b: DupCandidate) {
  const ta = a.published_at ? Date.parse(a.published_at) : Infinity;
  const tb = b.published_at ? Date.parse(b.published_at) : Infinity;
  return ta !== tb ? ta < tb : a.id < b.id;
}

/** Page principale de chaque groupe de doublons (clé → identifiant). */
export function primaryByKey(rows: DupCandidate[]): Map<string, DupCandidate> {
  const best = new Map<string, DupCandidate>();
  for (const r of rows) {
    const k = duplicateKey(r);
    if (!k) continue;
    const cur = best.get(k);
    if (!cur || before(r, cur)) best.set(k, r);
  }
  return best;
}

/** Identifiant de la page principale pour `o` parmi ses doublons (lui-même s'il n'en a pas). */
export function primaryOf(o: DupCandidate, siblings: DupCandidate[]): string {
  const k = duplicateKey(o);
  if (!k) return o.id;
  return primaryByKey([o, ...siblings.filter((s) => duplicateKey(s) === k)]).get(k)!.id;
}
