import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/format";

/**
 * Redirection vers la source originale d'une opportunité externe.
 * Le clic est compté de façon agrégée (événement source_outbound_clicked, sans IP).
 * Seules les URL enregistrées en base sont utilisées : pas de redirection ouverte.
 */
export async function GET(_req: Request, ctx: RouteContext<"/go/[id]">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return new NextResponse("Lien invalide", { status: 404 });
  const supabase = await createClient();
  const sourceId = new URL(_req.url).searchParams.get("source");
  let query = supabase.from("opportunity_sources").select("original_url, source_id").eq("opportunity_id", id);
  if (sourceId && isUuid(sourceId)) query = query.eq("source_id", sourceId);
  const { data } = await query.order("is_primary", { ascending: false }).limit(1).maybeSingle();
  if (!data?.original_url || !/^https?:\/\//i.test(data.original_url)) return new NextResponse("Source introuvable", { status: 404 });
  await supabase.rpc("track_event", { p_event_name: "source_outbound_clicked", p_properties: { opportunity_id: id, source_id: data.source_id } });
  return NextResponse.redirect(data.original_url, { status: 302, headers: { "Referrer-Policy": "no-referrer-when-downgrade", "X-Robots-Tag": "noindex" } });
}
