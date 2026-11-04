import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKETS: Record<string, string> = { profil: "user-avatars", entreprise: "company-photos" };

/** Sert les photos de profil et de prestations (buckets publics) sans exposer l'URL Supabase. */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const [kind, ...rest] = path;
  const bucket = BUCKETS[kind ?? ""];
  const key = rest.join("/");
  if (!bucket || !/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,140}$/.test(key)) return new NextResponse(null, { status: 404 });
  const { data, error } = await createAdminClient().storage.from(bucket).download(key);
  if (error || !data) return new NextResponse(null, { status: 404 });
  return new NextResponse(data, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      // Chemin unique à chaque envoi : mise en cache longue sans risque
      "Cache-Control": "public, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
