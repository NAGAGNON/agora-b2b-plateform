import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/montserrat";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { ToastProvider } from "@/components/ui/toast";
import { siteUrl } from "@/lib/seo";
import { PROMISE, SLOGAN } from "@/lib/constants";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "LinkProB2B — Des opportunités qui créent des connexions", template: "%s | LinkProB2B" },
  description: `Plateforme B2B qui met en relation les entreprises qui ont un besoin avec celles capables d'y répondre. ${PROMISE}`,
  applicationName: "LinkProB2B",
  // Vérification de propriété : Bing Webmaster Tools (également /BingSiteAuth.xml)
  verification: { other: { "msvalidate.01": "E96AB03143F3D93960FF218E3B517EDE" } },
  openGraph: {
    siteName: "LinkProB2B",
    locale: "fr_FR",
    type: "website",
    title: "LinkProB2B",
    description: SLOGAN,
    images: [{ url: "/brand/logo.png", width: 834, height: 167, alt: "LinkProB2B" }],
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
      <body className="flex min-h-dvh flex-col">
        <ToastProvider>{children}</ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}
