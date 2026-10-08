import { NextResponse } from "next/server";
import { isUuid } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { OUTREACH_COOKIE, OUTREACH_COOKIE_MAX_AGE, recipientFromToken, track } from "@/lib/outreach/tracking";

/**
 * Lien suivi d'un e-mail de prospection. Destinations possibles UNIQUEMENT :
 * la sélection personnalisée, ou une opportunité faisant partie de la sélection
 * du destinataire (aucune redirection ouverte).
 *
 * Le clic pose le cookie du parcours (jeton signé) : tant que le visiteur n'est pas
 * connecté, le détail des offres lui est présenté derrière la page d'accès
 * « Créez votre compte pour accéder à cette offre » (contrôle côté serveur, sur la
 * fiche de l'offre et sur le lien vers sa source).
 */
export async function GET(req: Request, ctx: RouteContext<"/api/outreach/c/[token]">) {
  const { token } = await ctx.params;
  // Redirections sur l'origine de la requête (domaine de production ou de prévisualisation)
  const base = new URL(req.url).origin;
  const r = await recipientFromToken(token);
  if (!r) return NextResponse.redirect(`${base}/opportunites`, 302);
  const o = new URL(req.url).searchParams.get("o");
  const utm = "utm_source=linkprob2b-outreach&utm_medium=email";
  let target = `${base}/opportunites/selection/${token}?${utm}`;
  if (o && isUuid(o)) {
    const { data } = await createAdminClient().from("outreach_recipient_opportunities").select("opportunity_id").eq("recipient_id", r.id).eq("opportunity_id", o).maybeSingle();
    if (data) target = `${base}/opportunites/${o}?${utm}`;
  }
  await track(r, "CLICK", target.includes("/selection/") ? {} : { opportunityId: o! });
  const res = NextResponse.redirect(target, { status: 302, headers: { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" } });
  res.cookies.set(OUTREACH_COOKIE, token, { httpOnly: true, secure: base.startsWith("https://"), sameSite: "lax", path: "/", maxAge: OUTREACH_COOKIE_MAX_AGE });
  return res;
}
