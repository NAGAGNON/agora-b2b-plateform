import { NextResponse } from "next/server";
import { isUuid } from "@/lib/format";
import { track } from "@/lib/analytics";

/**
 * « Envoyer un message » depuis la fiche d'un besoin (visiteur non connecté) : clic compté, puis
 * inscription (ou connexion) avec retour sur la fiche, formulaire de message ouvert.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/besoins/[id]/message">) {
  const { id } = await ctx.params;
  const base = new URL(req.url).origin;
  if (!isUuid(id)) return NextResponse.redirect(`${base}/opportunites`, 302);
  await track("need_message_click", { opportunity_id: id, signed_in: false });
  const back = `/opportunites/${id}?message=1`;
  const to = new URL(req.url).searchParams.get("compte") === "1" ? "/connexion" : "/inscription";
  return NextResponse.redirect(`${base}${to}?suite=${encodeURIComponent(back)}`, { status: 302, headers: { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" } });
}
