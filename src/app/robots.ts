import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard", "/admin", "/onboarding", "/api/", "/go/", "/auth/", "/connexion", "/mot-de-passe-oublie", "/reinitialiser-mot-de-passe", "/alertes/", "/outreach", "/opportunites/selection/", "/desinscription/",
          // Combinaisons de filtres (nombre illimité, déjà marquées « noindex ») : chaque page explorée
          // coûte du temps de calcul. Les fiches et pages régions / secteurs restent dans le plan du site.
          "/opportunites?", "/entreprises?", "/acheteurs?", "/analyses?",
        ],
      },
      // Robots d'entraînement d'IA (aucune visite en retour) : très gourmands, exclus
      {
        userAgent: ["GPTBot", "CCBot", "ClaudeBot", "anthropic-ai", "Bytespider", "Amazonbot", "meta-externalagent", "Google-Extended", "Applebot-Extended", "cohere-ai", "Diffbot", "ImagesiftBot", "omgili", "Timpibot"],
        disallow: ["/"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
