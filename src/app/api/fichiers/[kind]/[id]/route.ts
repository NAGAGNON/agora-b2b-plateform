import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/format";

const BUCKETS = {
  opportunite: { table: "opportunity_documents", bucket: "opportunity-documents" },
  reponse: { table: "proposal_documents", bucket: "proposal-documents" },
} as const;

/**
 * Téléchargement de documents privés. Les droits sont vérifiés deux fois :
 * RLS sur la table des métadonnées et politique de stockage sur le fichier,
 * avec la session de l'utilisateur (aucune clé de service).
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/fichiers/[kind]/[id]">) {
  const { kind, id } = await ctx.params;
  const cfg = BUCKETS[kind as keyof typeof BUCKETS];
  if (!cfg || !isUuid(id)) return new NextResponse("Introuvable", { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Authentification requise", { status: 401 });
  const { data: doc } = await supabase.from(cfg.table).select("storage_path, file_name, mime_type").eq("id", id).maybeSingle();
  if (!doc) return new NextResponse("Introuvable", { status: 404 });
  const { data: blob, error } = await supabase.storage.from(cfg.bucket).download(doc.storage_path);
  if (error || !blob) return new NextResponse("Introuvable", { status: 404 });
  return new NextResponse(blob, {
    headers: {
      "Content-Type": doc.mime_type,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
