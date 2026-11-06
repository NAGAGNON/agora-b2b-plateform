import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { storedBrief } from "@/lib/tender-brief";
import { briefDocument, briefFileName } from "@/lib/tender-brief-export";
import { siteUrl } from "@/lib/seo";

/**
 * Téléchargement de la fiche synthèse : ?format=pdf (page d'impression, « Enregistrer en PDF ») ou
 * ?format=doc (fichier ouvert par Word). Mêmes droits que la fiche sur la page.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Introuvable", { status: 404 });
  const format = new URL(req.url).searchParams.get("format") === "doc" ? "doc" : "pdf";
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL(`/connexion?suite=${encodeURIComponent(`/opportunites/${id}`)}`, req.url));
  const db = await createClient();
  const plan = (await db.rpc("user_plan")).data ?? "FREE";
  const allowed = (await db.rpc("plan_feature", { p_plan: plan, p_key: "tender_brief" })).data === true;
  if (!allowed) return NextResponse.redirect(new URL(`/opportunites/${id}`, req.url));
  const [{ data: o }, brief] = await Promise.all([
    db.from("opportunities").select("title, external_buyer_name").eq("id", id).maybeSingle(),
    storedBrief(id, createAdminClient()),
  ]);
  if (!o || !brief) return new NextResponse("Fiche pas encore prête : ouvrez l'appel d'offres puis réessayez.", { status: 404 });
  const { data: source } = await createAdminClient().from("tender_briefs").select("source_ref").eq("opportunity_id", id).maybeSingle();
  const done = session.activeCompany
    ? ((await db.from("pipeline_items").select("brief_done").eq("company_id", session.activeCompany.company.id).eq("opportunity_id", id).maybeSingle()).data?.brief_done ?? []).map(Number)
    : [];
  const html = briefDocument(brief, { title: o.title, buyer: o.external_buyer_name, url: `${siteUrl()}/opportunites/${id}`, source: source?.source_ref ?? null, done, print: format === "pdf" });
  const headers: Record<string, string> = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };
  if (format === "doc") {
    headers["Content-Type"] = "application/msword; charset=utf-8";
    headers["Content-Disposition"] = `attachment; filename="${briefFileName(o.title, "doc")}"`;
  } else headers["Content-Type"] = "text/html; charset=utf-8";
  return new NextResponse(html, { headers });
}
