import type { Metadata } from "next";
import { clip } from "@/lib/format";

/**
 * URL publique du site : SITE_URL si défini ; sur Vercel, le domaine de production
 * (le domaine personnalisé dès qu'il est connecté) ou l'URL de la prévisualisation.
 */
export function siteUrl(): string {
  const explicit = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel =
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}

/** Métadonnées d'une page publique indexable (title, description, canonical, Open Graph). */
// Aperçu par défaut (src/app/opengraph-image.tsx) : repris sur chaque page, sauf celles qui ont le leur
const DEFAULT_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "LinkProB2B — Appels d'offres et opportunités B2B en France" };

export function pageMetadata({ title, description, path, noindex = false }: { title: string; description: string; path: string; noindex?: boolean }): Metadata {
  // Longueurs affichées par Google : titre ~65 caractères, description ~158 (au-delà : coupé ou réécrit)
  const shortTitle = clip(title, 65);
  const shortDescription = clip(description, 158);
  return {
    // Titres longs : sans le suffixe « | LinkProB2B » pour rester lisibles dans Google (~60 caractères)
    title: shortTitle.length > 50 ? { absolute: shortTitle } : shortTitle,
    description: shortDescription,
    alternates: { canonical: path },
    openGraph: { title, description: shortDescription, url: path, type: "website", siteName: "LinkProB2B", locale: "fr_FR", images: [DEFAULT_IMAGE] },
    twitter: { card: "summary_large_image", title: shortTitle, description: shortDescription, images: [DEFAULT_IMAGE.url] },
    robots: noindex ? { index: false, follow: true } : undefined,
  };
}

/**
 * Indexation d'une liste paginée : une page « ?page=N » seule reste indexable (adresse canonique
 * propre, pour que les anciennes annonces restent atteignables) ; toute autre combinaison de
 * filtres n'est pas indexée (pages dupliquées).
 */
export function listingIndexing(path: string, sp: Record<string, string | string[] | undefined>): { path: string; filtered: boolean } {
  const keys = Object.keys(sp).filter((k) => sp[k] !== undefined && sp[k] !== "");
  const page = typeof sp.page === "string" && /^\d{1,4}$/.test(sp.page) ? Number(sp.page) : null;
  if (keys.length === 1 && keys[0] === "page" && page !== null) return { path: page > 1 ? `${path}?page=${page}` : path, filtered: false };
  return { path, filtered: keys.length > 0 };
}

export const PRIVATE_METADATA: Metadata = { robots: { index: false, follow: false } };

/** Auteur affiché sur les analyses de marché (et dans les données structurées). */
export const ARTICLE_AUTHOR = "YEO NAGAGNON GUY ROLAND";
