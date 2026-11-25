import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { prepareBriefs } from "@/lib/tender-brief";
import { logServerError } from "@/lib/errors";

export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = env.cronSecret;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/**
 * Fiches synthèse préparées à l'avance (toutes les 2 heures, vercel.json) : métiers des entreprises
 * inscrites d'abord, puis toutes les offres ouvertes. Volume réglable (platform_settings « briefs.prepare »).
 * La consommation de chaque fiche est enregistrée (mesure du coût).
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const started = Date.now();
  const db = createAdminClient();
  try {
    const { data: s } = await db.from("platform_settings").select("value").eq("key", "briefs.prepare").maybeSingle();
    const v = (s?.value ?? {}) as { per_pass?: number; concurrency?: number; enabled?: boolean };
    if (v.enabled === false) return NextResponse.json({ skipped: "désactivé" });
    const result = await prepareBriefs(db, { limit: Math.min(200, Number(v.per_pass) || 50), concurrency: Number(v.concurrency) || 5, everyone: true, deadline: started + 270_000 });
    return NextResponse.json({ ...result, ms: Date.now() - started });
  } catch (e) {
    logServerError("cron fiches", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
