import type { MetadataRoute } from "next";

/** Manifeste de l'application web (nom, couleurs, icônes) : installation sur mobile et moteurs. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LinkProB2B — Appels d'offres et opportunités B2B",
    short_name: "LinkProB2B",
    description: "Appels d'offres publics (BOAMP, TED) et besoins d'entreprises partout en France.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0F2D4A",
    lang: "fr-FR",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
