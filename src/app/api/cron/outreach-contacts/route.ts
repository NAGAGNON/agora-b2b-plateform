import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { logServerError } from "@/lib/errors";
import { runOutreachFollowUp } from "@/lib/outreach/pipeline";

export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = env.cronSecret;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/**
 * Passes suivantes LinkProB2B Outreach (vercel.json, quatre fois par jour) : prépare la campagne
 * du jour si elle manque, sinon poursuit la recherche des adresses e-mail génériques des
 * entreprises sélectionnées sans e-mail et envoie aussitôt les e-mails devenus possibles.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const db = createAdminClient();
  try {
    const report = await runOutreachFollowUp(db, { budgetMs: 270_000 });
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    logServerError("cron outreach-contacts", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
