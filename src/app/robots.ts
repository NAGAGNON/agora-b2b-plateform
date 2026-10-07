import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/admin", "/onboarding", "/api/", "/go/", "/auth/", "/connexion", "/mot-de-passe-oublie", "/reinitialiser-mot-de-passe", "/alertes/", "/outreach", "/opportunites/selection/", "/desinscription/"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
