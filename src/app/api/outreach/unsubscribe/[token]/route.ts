import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/seo";
import { recipientFromToken, unsubscribe } from "@/lib/outreach/tracking";

/** Désinscription en un clic (RFC 8058 : POST « List-Unsubscribe=One-Click » envoyé par la messagerie). */
export async function POST(_req: Request, ctx: RouteContext<"/api/outreach/unsubscribe/[token]">) {
  const { token } = await ctx.params;
  const r = await recipientFromToken(token);
  if (r && !r.unsubscribed_at) await unsubscribe(r);
  return new NextResponse("Désinscription enregistrée.", { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function GET(_req: Request, ctx: RouteContext<"/api/outreach/unsubscribe/[token]">) {
  const { token } = await ctx.params;
  return NextResponse.redirect(`${siteUrl()}/desinscription/${token}`, 302);
}
