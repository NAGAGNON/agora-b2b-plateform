import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Le navigateur envoie les fichiers directement au stockage Supabase (URL signées).
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();

// Les données passent par le serveur ; seul l'envoi de fichiers parle directement au stockage.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin}${isDev ? " ws: wss:" : ""}`.trim(),
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Les fichiers ne transitent plus par les Server Actions (logo : 2 Mo max).
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/(dashboard|admin|onboarding)/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
