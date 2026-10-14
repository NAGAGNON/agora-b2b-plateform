import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { logServerError } from "@/lib/errors";
import { runVeille } from "@/lib/veille/engine";
import { sendVeilleEmail } from "@/lib/veille/send";

export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = env.cronSecret;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/**
 * Veille par e-mail (vercel.json, le matin) : prépare les éditions du jour (lancement, lundi,
 * vendredi, alertes quotidiennes) puis envoie progressivement. Rien n'est envoyé tant que
 * l'administrateur n'a pas activé la veille après un envoi test.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    const r = await runVeille(createAdminClient(), { deadline: Date.now() + 260_000, send: sendVeilleEmail, intervalMs: 1500 });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    logServerError("cron veille", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
