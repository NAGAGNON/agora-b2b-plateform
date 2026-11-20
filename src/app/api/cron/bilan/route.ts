import { createAdminClient } from "@/lib/supabase/admin";
import { cronPausedResponse } from "@/lib/cron-usage";
import { NextResponse } from "next/server";
import { startCronMeter } from "@/lib/cron-usage";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { logServerError } from "@/lib/errors";
import { generateDailyReport } from "@/lib/daily-report";
import { sendDailyReportEmail } from "@/lib/daily-report-email";
import { sendWeeklyReview } from "@/lib/weekly-review";
import { runBoard, runBoardAlerts } from "@/lib/board";
import { checkLaunchReadiness } from "@/lib/launch-readiness";
import { rewriteBriefs } from "@/lib/tender-brief";

// Rédaction du bilan complet (jusqu'à deux appels) puis envoi par e-mail
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = env.cronSecret;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/** Heure de Paris (0-23). */
function parisHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(now));
}

/**
 * Bilan du jour (vercel.json : le soir, pour limiter la consommation de l'API).
 * Le soir (`soir=1`), bilan complet et détaillé, envoyé par e-mail (DAILY_REPORT_EMAIL, sinon les
 * super-administrateurs) à 21 h, heure de Paris : la tâche est planifiée à 19 h et 20 h UTC (heure
 * d'été / d'hiver) ; avant 21 h à Paris elle ne fait rien, et le rapport n'est envoyé qu'une fois.
 */
/** Réglage activé seulement s'il vaut { enabled: true } (arrêté par défaut). */
async function settingEnabled(key: string): Promise<boolean> {
  const { data } = await createAdminClient().from("platform_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as { enabled?: boolean } | null)?.enabled === true;
}

/** Comité des agents internes : seulement si le réglage « board » vaut { enabled: true }. */
const boardEnabled = () => settingEnabled("board");

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const started = Date.now();
  try {
    // Comité de direction (`comite=matin|soir|alertes`) : réunion du matin à 8 h et du soir à 19 h (heure
    // de Paris ; deux horaires UTC pour l'heure d'été et d'hiver, une seule réunion par jour) ; les alertes
    // sont vérifiées plusieurs fois par jour et déclenchent une réunion exceptionnelle si besoin
    const comite = new URL(req.url).searchParams.get("comite");
    // Comité des agents internes (CEO, CTO…) : arrêté à la demande du fondateur le 20/11 (plus de réunions
    // ni de rapports). Réactivable par le réglage platform_settings « board » = { "enabled": true }.
    const boardOn = comite ? await boardEnabled() : false;
    if (comite === "alertes") {
      // Seuils du lancement payant fixés par le fondateur : alerte par e-mail quand ils sont tous atteints
      const lancement = await checkLaunchReadiness().catch((e) => (logServerError("launch readiness", e), { error: true }));
      const alertes = boardOn ? await runBoardAlerts() : { comite: "arrêté" };
      // Fiches synthèse des offres ouvertes réécrites peu à peu en langage simple (temps restant du passage)
      const fiches = await rewriteBriefs(undefined, { limit: 60, deadline: started + 200_000 }).catch((e) => (logServerError("rewrite briefs", e), { error: true }));
      return NextResponse.json({ ok: true, lancement, fiches, ...alertes });
    }
    if (comite === "matin" || comite === "soir") {
      if (!boardOn) return NextResponse.json({ ok: true, skipped: "Comité des agents arrêté (réglage board)" });
      if (parisHour() < (comite === "matin" ? 8 : 19)) return NextResponse.json({ ok: true, skipped: "Avant l'heure de la réunion (heure de Paris)" });
      const r = await runBoard({ kind: comite === "matin" ? "MATIN" : "SOIR" });
      return NextResponse.json({ ok: true, ...r });
    }
    // Analyste du lundi (`semaine=1`) : le lundi à 8 h, heure de Paris (tâche planifiée à 6 h et 7 h UTC
    // pour couvrir l'heure d'été et d'hiver) ; envoyé une seule fois par semaine
    if (new URL(req.url).searchParams.get("semaine") === "1") {
      // Point du lundi (rédigé avec l'API Claude) : arrêté à la demande du fondateur le 20/11 pour économiser
      // ses crédits ; le bilan du soir est gardé. Réactivable par « weekly_review » = { "enabled": true }.
      if (!(await settingEnabled("weekly_review"))) return NextResponse.json({ ok: true, skipped: "Point du lundi arrêté (réglage weekly_review)" });
      const monday = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short" }).format(new Date()) === "Mon";
      if (!monday || parisHour() < 8) return NextResponse.json({ ok: true, skipped: "Hors lundi 8 h (heure de Paris)" });
      const r = await sendWeeklyReview();
      return NextResponse.json({ ok: !("errors" in r && r.errors?.length), ...r });
    }
    if (new URL(req.url).searchParams.get("soir") === "1") {
      if (parisHour() < 21) return NextResponse.json({ ok: true, skipped: "Avant 21 h (heure de Paris) : envoi au passage suivant" });
      const email = await sendDailyReportEmail();
      return NextResponse.json({ ok: !("errors" in email && email.errors?.length), email });
    }
    const r = await generateDailyReport();
    return NextResponse.json({ ok: !r.error, day: r.day, model: r.model, note: r.note, error: r.error });
  } catch (e) {
    logServerError("cron bilan", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/** Passage mesuré (temps de calcul, voir src/lib/cron-usage.ts). */
export async function GET(req: Request) {
  if (!authorized(req)) return run(req);
  const paused = cronPausedResponse();
  if (paused) return paused;
  const stop = startCronMeter(`bilan${new URL(req.url).search}`);
  try {
    return await run(req);
  } finally {
    await stop();
  }
}
