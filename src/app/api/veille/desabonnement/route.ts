import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/seo";
import { unsubscribeVeille } from "@/lib/veille/tracking";

/** Désinscription en un clic depuis la messagerie (RFC 8058, en-tête List-Unsubscribe-Post). */
export async function POST(req: Request) {
  const ok = await unsubscribeVeille(new URL(req.url).searchParams.get("jeton"));
  return new Response(ok ? "Désinscription enregistrée" : "Lien inconnu", { status: ok ? 200 : 404 });
}

export async function GET(req: Request) {
  const jeton = new URL(req.url).searchParams.get("jeton") ?? "";
  return NextResponse.redirect(new URL(`/veille/desabonnement?jeton=${encodeURIComponent(jeton)}`, siteUrl()), 302);
}
