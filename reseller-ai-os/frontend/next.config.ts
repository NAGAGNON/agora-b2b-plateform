import path from "node:path";
import type { NextConfig } from "next";

// Le navigateur ne parle qu'à Next.js ; /api/* est relayé vers FastAPI (même origine → cookie de session simple et sûr).
const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // Docker : bundle autonome ; Vercel : build natif (pas de standalone)
  output: process.env.VERCEL ? undefined : "standalone",
  // Racine de traçage = ce dossier (le dépôt contient d'autres projets) : server.js à la racine du bundle standalone
  outputFileTracingRoot: path.resolve(__dirname),
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
