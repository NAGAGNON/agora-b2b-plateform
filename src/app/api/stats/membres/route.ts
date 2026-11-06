import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Chiffres réels en direct pour les compteurs publics (inscrits, entreprises, nouveaux de la
 * semaine, opportunités ouvertes). Aucune donnée personnelle : uniquement des totaux.
 */
export async function GET() {
  const { data, error } = await createAdminClient().rpc("public_platform_stats");
  if (error || !data) return NextResponse.json({ error: "indisponible" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const s = data as Record<string, unknown>;
  const n = (k: string) => Number(s[k] ?? 0);
  return NextResponse.json(
    { members: n("members"), members_7d: n("members_7d"), members_30d: n("members_30d"), companies: n("registered_companies"), active: n("active"), new_24h: n("new_24h") },
    // Quelques secondes de cache partagé seulement : chaque nouvelle inscription apparaît presque aussitôt
    { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" } },
  );
}
