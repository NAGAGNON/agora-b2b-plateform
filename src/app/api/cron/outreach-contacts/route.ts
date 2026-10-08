import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { logServerError } from "@/lib/errors";
import { enrichCampaignAndSend } from "@/lib/outreach/pipeline";

export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = env.cronSecret;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/**
 * Seconde tâche LinkProB2B Outreach (vercel.json), après la préparation de la campagne :
 * recherche des adresses e-mail génériques des entreprises sélectionnées sans e-mail,
 * avec tout le temps disponible, puis envoi des e-mails devenus possibles.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const db = createAdminClient();
  const { data: campaign } = await db.from("outreach_campaigns").select("id").eq("campaign_date", new Date().toISOString().slice(0, 10)).maybeSingle();
  if (!campaign) return NextResponse.json({ ok: true, skipped: "Aucune campagne aujourd'hui" });
  try {
    const report = await enrichCampaignAndSend(db, { campaignId: campaign.id, deadline: Date.now() + 270_000 });
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    logServerError("cron outreach-contacts", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
