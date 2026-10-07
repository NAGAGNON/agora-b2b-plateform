import { indexNowKey } from "@/lib/indexnow";

export const dynamic = "force-dynamic";

/** Fichier de clé IndexNow (preuve de propriété du domaine pour les moteurs de recherche). */
export function GET() {
  const key = indexNowKey();
  return new Response(key ?? "", { status: key ? 200 : 404, headers: { "content-type": "text/plain; charset=utf-8" } });
}
