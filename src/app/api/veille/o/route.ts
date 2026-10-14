import { recordVeilleEvent } from "@/lib/veille/tracking";

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/** Pixel d'ouverture de la veille (indicatif : beaucoup de messageries bloquent les images). */
export async function GET(req: Request) {
  await recordVeilleEvent(new URL(req.url).searchParams.get("t"), "OPEN");
  return new Response(GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0" } });
}
