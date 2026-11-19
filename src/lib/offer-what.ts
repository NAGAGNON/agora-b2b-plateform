/**
 * Phrase « Ce que cherche l'acheteur » d'un avis externe quand la fiche synthèse n'est pas encore
 * rédigée. Le résumé enregistré à la collecte (« Commune de X — Marché de services ») ne dit pas ce que
 * l'acheteur veut : on construit une phrase claire à partir de l'objet officiel et du type de marché,
 * sans rien inventer (uniquement des éléments présents dans l'avis).
 */
const WHO: Record<string, string> = {
  services: "un prestataire",
  travaux: "une entreprise de travaux",
  fournitures: "un fournisseur",
};

/** Résumé de collecte sans information sur le besoin (« Acheteur — Marché de … »). */
export const isGenericSummary = (s: string | null | undefined) => !s || /^.{0,200} — Marché de [a-zé]+\.?$/i.test(s.trim());

function lowerFirst(s: string) {
  // Garde les sigles (« SDIS », « EHPAD ») ; minuscule pour un mot ordinaire
  return /^[A-ZÀ-Ý]{2,}\b/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1);
}

export function offerWhat(o: { title: string; summary: string | null; description: string | null; external_buyer_name?: string | null }): string | null {
  if (!isGenericSummary(o.summary)) return o.summary;
  const desc = o.description ?? "";
  // Description libre sans « Objet : » (besoin rédigé par l'acheteur) : elle dit déjà ce qu'il veut, on l'affiche telle quelle
  if (desc.trim() && !/Objet\s*:/i.test(desc)) return null;
  const objet = (desc.match(/Objet\s*:\s*(.+)/i)?.[1] ?? o.title).trim().replace(/\.+$/, "");
  const type = desc.match(/Type de marché\s*:\s*([a-zé]+)/i)?.[1]?.toLowerCase() ?? o.summary?.match(/Marché de ([a-zé]+)/i)?.[1]?.toLowerCase() ?? "";
  const buyer = o.external_buyer_name?.trim() || o.summary?.split(" — ")[0]?.trim() || "L'acheteur";
  // Objet tout en majuscules (fréquent au BOAMP) : remis en casse normale pour être lisible
  const clean = objet === objet.toUpperCase() && /[A-Z]{6,}/.test(objet) ? objet.charAt(0) + objet.slice(1).toLowerCase() : objet;
  if (!clean) return null;
  return `${buyer} cherche ${WHO[type] ?? "une entreprise"} pour : ${lowerFirst(clean)}.`;
}
