import { isAutomatedHit, recipientFromToken, track } from "@/lib/outreach/tracking";

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/** Pixel d'ouverture (indicatif : de nombreuses messageries bloquent les images). */
export async function GET(req: Request, ctx: RouteContext<"/api/outreach/o/[token]">) {
  const { token } = await ctx.params;
  const r = await recipientFromToken(token);
  // Le proxy d'images de Gmail/Apple compte comme ouverture ; les robots de vérification, non
  if (r && !isAutomatedHit(req, null)) await track(r, "OPEN");
  return new Response(GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" } });
}
