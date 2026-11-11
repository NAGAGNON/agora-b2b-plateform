import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { suggest } from "@/lib/search-suggest";

/** Référentiels publics (secteurs, départements, villes), relus au plus une fois par heure. */
const sources = unstable_cache(
  async () => {
    const db = createAdminClient();
    const [{ data: sectors }, { data: departments }, { data: places }] = await Promise.all([
      db.from("sectors").select("slug, label").eq("is_active", true),
      db.from("departments").select("code, name"),
      db.from("places").select("name, department_code"),
    ]);
    return { sectors: sectors ?? [], departments: departments ?? [], places: places ?? [] };
  },
  ["search-suggest-sources-v1"],
  { revalidate: 3600 },
);

/** Suggestions pendant la frappe : métiers, secteurs, départements, villes (aucune donnée personnelle). */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 60);
  const items = suggest(q, await sources());
  return NextResponse.json({ items }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } });
}
