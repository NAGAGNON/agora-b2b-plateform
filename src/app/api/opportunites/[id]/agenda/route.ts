import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/format";
import { deadlineIcs } from "@/lib/ics";
import { siteUrl } from "@/lib/seo";

/**
 * Échéance d'une opportunité au format agenda (.ics).
 * Lecture avec la session du visiteur : les règles d'accès (RLS) s'appliquent comme sur la fiche.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/opportunites/[id]/agenda">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return new NextResponse("Lien invalide", { status: 404 });
  const supabase = await createClient();
  const { data: o } = await supabase.from("opportunities").select("id, title, response_deadline, city, region").eq("id", id).maybeSingle();
  if (!o) return new NextResponse("Opportunité introuvable", { status: 404 });
  if (!o.response_deadline) return new NextResponse("Aucune échéance pour cette opportunité", { status: 404 });
  const body = deadlineIcs({
    id: o.id,
    title: o.title,
    deadline: o.response_deadline,
    url: `${siteUrl()}/opportunites/${o.id}`,
    location: [o.city, o.region].filter(Boolean).join(", ") || null,
  });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="echeance-${o.id.slice(0, 8)}.ics"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
