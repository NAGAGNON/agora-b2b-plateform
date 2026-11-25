/** URL publique d'un logo (bucket public), servie via le proxy /api/logos pour ne pas exposer l'URL Supabase. */
export function logoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  // Logo de la marque (compte officiel LinkProB2B) : fichier du site, pas du stockage
  if (path.startsWith("brand:")) return `/brand/${path.slice("brand:".length).replace(/[^a-z0-9._-]/gi, "")}`;
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
