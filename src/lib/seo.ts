import type { Metadata } from "next";

export function siteUrl(): string {
  return (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
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
