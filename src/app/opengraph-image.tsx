import { ImageResponse } from "next/og";

/**
 * Aperçu par défaut du site (1200 × 630) pour les partages (LinkedIn, WhatsApp, e-mail…) et les
 * moteurs. Les analyses de marché ont leur propre visuel. Aucun chiffre : uniquement l'offre.
 */
export const alt = "LinkProB2B — Appels d'offres, marchés publics et opportunités B2B en France";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#0F2D4A";
const TEAL = "#14B8A6";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", backgroundColor: NAVY, color: "white", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 700 }}>
          <span>LinkPro</span>
          <span style={{ color: TEAL }}>B2B</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 60, fontWeight: 800, lineHeight: 1.1 }}>Appels d&apos;offres et opportunités B2B partout en France</div>
          <div style={{ display: "flex", fontSize: 30, color: "#CBD5E1", marginTop: 24 }}>Marchés publics (BOAMP, TED) et besoins d&apos;entreprises, par secteur et par région.</div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: TEAL, fontWeight: 600 }}>Des opportunités qui créent des connexions.</div>
      </div>
    ),
    size,
  );
}
