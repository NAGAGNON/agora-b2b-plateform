import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { processAlertDigests, processEmailOutbox } from "@/lib/email/outbox";
import { logServerError } from "@/lib/errors";

function authorized(req: Request): boolean {
  const secret = env.cronSecret;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/**
 * Tâche planifiée quotidienne (Vercel Cron — voir vercel.json) :
 * expiration des opportunités, résumés d'alertes, envoi de la file d'e-mails.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    const { data: expired } = await createAdminClient().rpc("expire_opportunities");
    const digests = await processAlertDigests();
    const emails = await processEmailOutbox(200);
    return NextResponse.json({ ok: true, expired, digests, emails });
  } catch (e) {
    logServerError("cron quotidien", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
