import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { logServerError } from "@/lib/errors";
import { runOutreachDaily } from "@/lib/outreach/pipeline";

export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = env.cronSecret;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/**
 * Tâche planifiée LinkProB2B Outreach (vercel.json), une heure après la collecte
 * des opportunités : synchronisation, campagne du jour, file d'envoi.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const db = createAdminClient();
  try {
    const report = await runOutreachDaily(db, { budgetMs: 240_000 });
    await db.from("platform_settings").upsert({ key: "private.outreach_cron", value: { last_run_at: new Date().toISOString(), ok: true }, description: "Dernière exécution d'Outreach" });
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    logServerError("cron outreach", e);
    await db.from("platform_settings").upsert({ key: "private.outreach_cron", value: { last_run_at: new Date().toISOString(), ok: false, error: e instanceof Error ? e.message : String(e) }, description: "Dernière exécution d'Outreach" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
