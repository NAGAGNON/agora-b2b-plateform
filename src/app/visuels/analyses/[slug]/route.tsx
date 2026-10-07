import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { articleFigures, type ArticleFacts } from "@/lib/article-figures";

export const revalidate = 86400;

const NAVY = "#0F2D4A";
const TEAL = "#14B8A6";
const nf = new Intl.NumberFormat("fr-FR");

/**
 * Couverture d'une analyse (1200 × 630) : sert d'image d'en-tête sur la page et
 * d'aperçu pour les réseaux sociaux et les moteurs. Uniquement des chiffres réels
 * issus du jeu de faits de l'article.
 */
export async function GET(_req: Request, ctx: RouteContext<"/visuels/analyses/[slug]">) {
  const { slug } = await ctx.params;
  const supabase = await createClient();
  const { data: a } = await supabase.from("articles").select("title, facts").eq("slug", slug).eq("status", "PUBLISHED").maybeSingle();
  if (!a) return new Response("Introuvable", { status: 404 });
  const f = articleFigures(a.facts as ArticleFacts);
  const max = Math.max(1, ...f.breakdown.map((b) => b.count));
  const bars = f.breakdown.slice(0, 5);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", backgroundColor: NAVY, color: "white", padding: 64, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between", paddingRight: 48 }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700 }}>
            <span>LinkPro</span>
            <span style={{ color: TEAL }}>B2B</span>
            <span style={{ marginLeft: 20, fontSize: 22, fontWeight: 400, color: "#94A3B8", alignSelf: "center" }}>Analyse des marchés</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 24, color: TEAL, fontWeight: 600, marginBottom: 12 }}>{`${f.label}${f.period ? ` · ${f.period}` : ""}`}</div>
            <div style={{ display: "flex", fontSize: a.title.length > 70 ? 40 : 48, fontWeight: 700, lineHeight: 1.15 }}>{a.title}</div>
          </div>
          <div style={{ display: "flex" }}>
            <div style={{ display: "flex", flexDirection: "column", marginRight: 56 }}>
              <span style={{ fontSize: 64, fontWeight: 800, color: TEAL }}>{nf.format(f.total)}</span>
              <span style={{ fontSize: 22, color: "#CBD5E1" }}>opportunités ouvertes</span>
            </div>
            {f.within30 > 0 && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 64, fontWeight: 800 }}>{nf.format(f.within30)}</span>
                <span style={{ fontSize: 22, color: "#CBD5E1" }}>date limite sous 30 jours</span>
              </div>
            )}
          </div>
        </div>
        {bars.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: 360 }}>
            <div style={{ fontSize: 20, color: "#94A3B8", marginBottom: 16 }}>{f.breakdownTitle}</div>
            {bars.map((b) => (
              <div key={b.name} style={{ display: "flex", flexDirection: "column", marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, color: "#E2E8F0", marginBottom: 6 }}>
                  <span style={{ maxWidth: 290, overflow: "hidden" }}>{b.name}</span>
                  <span>{b.count}</span>
                </div>
                <div style={{ display: "flex", height: 12, width: "100%", backgroundColor: "#1E3A5F", borderRadius: 4 }}>
                  <div style={{ width: `${(b.count / max) * 100}%`, backgroundColor: TEAL, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
}
