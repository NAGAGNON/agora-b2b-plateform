import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ToastProvider } from "@/components/ui/toast";
import { siteUrl } from "@/lib/seo";
import { SLOGAN } from "@/lib/constants";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "LinkProB2B — Trouvez des opportunités, développez votre activité", template: "%s | LinkProB2B" },
  description: `${SLOGAN} Appels d'offres publics (BOAMP, TED) et besoins d'entreprises triés pour votre métier, aide à la réponse et prospection B2B, partout en France.`,
  applicationName: "LinkProB2B",
  // Vérification de propriété : Bing Webmaster Tools (également /BingSiteAuth.xml) et, si renseigné,
  // Google Search Console (variable GOOGLE_SITE_VERIFICATION : code de la balise « google-site-verification »)
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION.trim() } : {}),
    other: { "msvalidate.01": "E96AB03143F3D93960FF218E3B517EDE" },
  },
  openGraph: {
    siteName: "LinkProB2B",
    locale: "fr_FR",
    type: "website",
    title: "LinkProB2B — Appels d'offres et opportunités B2B en France",
    description: `${SLOGAN} Appels d'offres et besoins d'entreprises, partout en France.`,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "LinkProB2B — Appels d'offres et opportunités B2B en France" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0F2D4A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <head>
        <link rel="alternate" type="application/rss+xml" title="LinkProB2B — Appels d'offres et opportunités B2B" href="/flux/opportunites.xml" />
      </head>
      <body className="flex min-h-dvh flex-col">
        <ToastProvider>{children}</ToastProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
