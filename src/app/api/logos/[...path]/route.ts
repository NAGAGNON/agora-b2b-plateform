import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Sert les logos d'entreprise (bucket public) sans exposer l'URL Supabase au navigateur. */
export async function GET(_req: Request, ctx: RouteContext<"/api/logos/[...path]">) {
  const { path } = await ctx.params;
  const key = path.join("/");
  if (!/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,140}$/.test(key)) return new NextResponse(null, { status: 404 });
  const { data, error } = await createAdminClient().storage.from("company-logos").download(key);
  if (error || !data) return new NextResponse(null, { status: 404 });
  return new NextResponse(data, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
