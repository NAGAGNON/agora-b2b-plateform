import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * Mesure d'audience interne, sans cookie ni donnée personnelle : chemin de la page,
 * domaine d'origine, type d'appareil, durée de lecture. L'IP n'est ni stockée ni
 * transmise (limitation de débit sur un hachage salé, comme le reste du site).
 */
const BOT = /bot|crawl|spider|slurp|preview|lighthouse|headless|monitor|uptime|curl|wget|python|axios|node-fetch/i;
const EXCLUDED = /^\/(admin|api|auth|_next)(\/|$)/;

const view = z.object({
  t: z.literal("view"),
  sid: z.uuid(),
  path: z.string().min(1).max(300).startsWith("/"),
  ref: z.string().max(500).optional(),
  w: z.number().int().min(0).max(10000).optional(),
});
const time = z.object({ t: z.literal("time"), sid: z.uuid(), id: z.number().int().positive(), ms: z.number().int().min(0) });

function referrerHost(ref: string | undefined): string | null {
  if (!ref) return null;
  try {
    const host = new URL(ref).hostname.replace(/^www\./, "");
    const own = new URL(siteUrl()).hostname.replace(/^www\./, "");
    return host && host !== own ? host.slice(0, 120) : null;
  } catch {
    return null;
  }
}

const device = (w?: number) => (w === undefined ? "desktop" : w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop");

export async function POST(req: Request) {
  if (BOT.test(req.headers.get("user-agent") ?? "")) return new NextResponse(null, { status: 204 });
  let body: unknown;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!(await rateLimit("audience", 600, 3600))) return new NextResponse(null, { status: 429 });
  const db = createAdminClient();

  const v = view.safeParse(body);
  if (v.success) {
    const path = v.data.path.split("?")[0].split("#")[0];
    if (EXCLUDED.test(path)) return new NextResponse(null, { status: 204 });
    const { data, error } = await db
      .from("page_views")
      .insert({ session_id: v.data.sid, path, referrer_host: referrerHost(v.data.ref), device: device(v.data.w) })
      .select("id")
      .single();
    return error ? new NextResponse(null, { status: 500 }) : NextResponse.json({ id: data.id });
  }

  const t = time.safeParse(body);
  if (t.success) {
    await db
      .from("page_views")
      .update({ duration_ms: Math.min(t.data.ms, 1_800_000) })
      .eq("id", t.data.id)
      .eq("session_id", t.data.sid)
      .lt("duration_ms", Math.min(t.data.ms, 1_800_000));
    return new NextResponse(null, { status: 204 });
  }
  return new NextResponse(null, { status: 400 });
}
