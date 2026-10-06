import type { Metadata } from "next";

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
export function pageMetadata({ title, description, path, noindex = false }: { title: string; description: string; path: string; noindex?: boolean }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: "website", siteName: "LinkProB2B", locale: "fr_FR" },
    robots: noindex ? { index: false, follow: true } : undefined,
  };
}

export const PRIVATE_METADATA: Metadata = { robots: { index: false, follow: false } };
