/** URL publique d'un logo (bucket public), servie via le proxy /api/logos pour ne pas exposer l'URL Supabase. */
export function logoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `/api/logos/${path.split("/").map(encodeURIComponent).join("/")}`;
}
