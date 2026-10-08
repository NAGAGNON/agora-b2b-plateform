import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { logServerError } from "@/lib/errors";
import { runSendPass } from "@/lib/outreach/pipeline";

export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = env.cronSecret;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/**
 * Passages d'envoi seuls (vercel.json, l'après-midi) : uniquement la file d'attente des e-mails
 * déjà prêts, un par un, dans les limites réglées (par jour, par heure, intervalle). Aucune
 * recherche d'entreprise ni d'adresse : ne consomme aucun forfait de recherche.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const db = createAdminClient();
  try {
    const send = await runSendPass(db, { budgetMs: 270_000 });
    return NextResponse.json({ ok: true, send });
  } catch (e) {
    logServerError("cron envoi", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
