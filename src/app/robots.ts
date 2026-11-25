import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Logos des entreprises (servis par /api/logos/) : visibles par Google, comme le reste de la page
        allow: ["/", "/api/logos/"],
        disallow: [
          "/dashboard", "/essai", "/admin", "/onboarding", "/api/", "/go/", "/auth/", "/connexion", "/mot-de-passe-oublie", "/reinitialiser-mot-de-passe", "/alertes/", "/outreach", "/opportunites/selection/", "/desinscription/",
          // Combinaisons de filtres (nombre illimité, déjà marquées « noindex ») : chaque page explorée
          // coûte du temps de calcul. Les fiches et pages régions / secteurs restent dans le plan du site.
          "/opportunites?", "/entreprises?", "/acheteurs?", "/analyses?", "/disponibilites?", "/disponibilites/publier",
        ],
      },
      // Robots d'entraînement d'IA (aucune visite en retour) : très gourmands, exclus. Les robots qui
      // répondent aux questions des internautes en citant leurs sources restent autorisés (ChatGPT :
      // OAI-SearchBot et ChatGPT-User ; Perplexity ; Claude-SearchBot et Claude-User). Google-Extended et
      // Applebot-Extended ne sont pas des robots (aucune visite en plus) : les laisser permet à Gemini et
      // Apple Intelligence de citer LinkProB2B dans leurs réponses.
      {
        userAgent: ["GPTBot", "CCBot", "ClaudeBot", "anthropic-ai", "Bytespider", "Amazonbot", "meta-externalagent", "cohere-ai", "Diffbot", "ImagesiftBot", "omgili", "Timpibot"],
        disallow: ["/"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
