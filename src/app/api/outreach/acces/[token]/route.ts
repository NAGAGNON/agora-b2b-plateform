import { NextResponse } from "next/server";
import { isUuid } from "@/lib/format";
import { recipientFromToken, track } from "@/lib/outreach/tracking";

/**
 * Boutons de la page d'accès d'une offre (parcours e-mail de prospection) :
 * « Créer mon compte » ou « Se connecter ». Le clic est compté, puis le visiteur
 * rejoint l'inscription (ou la connexion) avec l'offre à ouvrir ensuite.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/outreach/acces/[token]">) {
  const { token } = await ctx.params;
  const url = new URL(req.url);
  const o = url.searchParams.get("o");
  const login = url.searchParams.get("a") === "connexion";
  const suite = o && isUuid(o) ? `/opportunites/${o}` : `/opportunites/selection/${token}`;
  const r = await recipientFromToken(token);
  if (r) await track(r, login ? "GATE_LOGIN_CLICK" : "GATE_SIGNUP_CLICK", o && isUuid(o) ? { opportunityId: o } : {});
  const params = new URLSearchParams({ suite, ...(r ? { ref: `o.${token}` } : {}) });
  return NextResponse.redirect(new URL(`/${login ? "connexion" : "inscription"}?${params}`, req.url), { status: 302, headers: { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" } });
}
