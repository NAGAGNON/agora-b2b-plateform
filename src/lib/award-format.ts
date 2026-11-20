/** Nombre d'offres reçues par l'acheteur, tel qu'écrit dans l'avis de résultat (un chiffre par lot). */
export function offersLabel(offers: number[] | undefined | null): string | null {
  const n = (offers ?? []).filter((x) => Number.isInteger(x) && x > 0);
  if (!n.length) return null;
  const min = Math.min(...n);
  const max = Math.max(...n);
  const one = (x: number) => `${x} offre${x > 1 ? "s" : ""} reçue${x > 1 ? "s" : ""}`;
  return min === max ? one(max) : `de ${min} à ${max} offres reçues selon les lots`;
}
