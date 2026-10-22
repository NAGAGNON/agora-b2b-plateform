import { NextResponse } from "next/server";
import { startCronMeter } from "@/lib/cron-usage";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { logServerError } from "@/lib/errors";
import { runManualCampaign, runOutreachFollowUp, runSendPass } from "@/lib/outreach/pipeline";
import { cronCpuBudgetReached } from "@/lib/cron-usage";
import { parisToday } from "@/lib/daily-report";

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
 * `complement=1` (midi et après-midi) : campagne complémentaire avec les opportunités collectées
 * depuis le matin, mêmes garde-fous (exclusions, délai entre deux e-mails à une même entreprise).
 */
/** Campagne automatique du jour présente et utilisable (ni absente, ni en échec, ni bloquée en préparation). */
async function dailyCampaignOk(db: ReturnType<typeof createAdminClient>) {
  const { data: c } = await db.from("outreach_campaigns").select("status, updated_at").eq("campaign_date", parisToday()).eq("kind", "AUTO").maybeSingle();
  if (!c || c.status === "FAILED") return false;
  return !(c.status === "BUILDING" && Date.now() - new Date(c.updated_at).getTime() > 10 * 60_000);
}

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const db = createAdminClient();
  try {
    // Plafond quotidien de temps de calcul de la prospection atteint (forfait Vercel) : seuls les e-mails
    // déjà prêts partent ; la recherche d'adresses et les campagnes complémentaires reprennent demain.
    // Exception : la campagne du jour manque, a échoué ou s'est arrêtée en route → elle est toujours
    // (re)préparée, sinon aucune prospection ne partirait de la journée.
    if ((await dailyCampaignOk(db)) && (await cronCpuBudgetReached())) {
      return NextResponse.json({ ok: true, mode: "envoi seul", reason: "Plafond quotidien de temps de calcul atteint", send: await runSendPass(db, { budgetMs: 240_000 }) });
    }
    const complement = new URL(req.url).searchParams.get("complement") === "1";
    const report = complement ? { mode: "complement" as const, ...(await runManualCampaign(db, { userId: null, budgetMs: 270_000 })) } : await runOutreachFollowUp(db, { budgetMs: 270_000 });
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    logServerError("cron outreach-contacts", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/** Passage mesuré (temps de calcul, voir src/lib/cron-usage.ts). */
export async function GET(req: Request) {
  if (!authorized(req)) return run(req);
  const stop = startCronMeter(`outreach-contacts${new URL(req.url).search}`);
  try {
    return await run(req);
  } finally {
    await stop();
  }
}
