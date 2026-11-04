/** URL publique d'un logo (bucket public), servie via le proxy /api/logos pour ne pas exposer l'URL Supabase. */
export function logoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `/api/logos/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Photo de profil d'un inscrit (bucket public), servie via /api/photos. */
export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `/api/photos/profil/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Photo de prestation d'une entreprise (bucket public), servie via /api/photos. */
export function companyPhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `/api/photos/entreprise/${path.split("/").map(encodeURIComponent).join("/")}`;
}
