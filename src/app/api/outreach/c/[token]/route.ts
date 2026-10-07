import { NextResponse } from "next/server";
import { isUuid } from "@/lib/format";
import { siteUrl } from "@/lib/seo";
import { createAdminClient } from "@/lib/supabase/admin";
import { recipientFromToken, track } from "@/lib/outreach/tracking";

/**
 * Lien suivi d'un e-mail de prospection. Destinations possibles UNIQUEMENT :
 * la sélection personnalisée, ou une opportunité faisant partie de la sélection
 * du destinataire (aucune redirection ouverte).
 */
export async function GET(req: Request, ctx: RouteContext<"/api/outreach/c/[token]">) {
  const { token } = await ctx.params;
  const base = siteUrl();
  const r = await recipientFromToken(token);
  if (!r) return NextResponse.redirect(`${base}/opportunites`, 302);
  const o = new URL(req.url).searchParams.get("o");
  const utm = "utm_source=linkprob2b-outreach&utm_medium=email";
  if (o && isUuid(o)) {
    const { data } = await createAdminClient().from("outreach_recipient_opportunities").select("opportunity_id").eq("recipient_id", r.id).eq("opportunity_id", o).maybeSingle();
    if (data) {
      await track(r, "CLICK", { opportunityId: o });
      await track(r, "OPPORTUNITY_VIEW", { opportunityId: o });
      return NextResponse.redirect(`${base}/opportunites/${o}?${utm}&ref=o.${token}`, { status: 302, headers: { "X-Robots-Tag": "noindex" } });
    }
  }
  await track(r, "CLICK");
  return NextResponse.redirect(`${base}/opportunites/selection/${token}?${utm}`, { status: 302, headers: { "X-Robots-Tag": "noindex" } });
}
