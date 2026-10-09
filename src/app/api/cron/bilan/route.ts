import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { logServerError } from "@/lib/errors";
import { generateDailyReport } from "@/lib/daily-report";
import { sendDailyReportEmail } from "@/lib/daily-report-email";

// Rédaction du bilan complet (jusqu'à deux appels) puis envoi par e-mail
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = env.cronSecret;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/**
 * Bilan du jour (vercel.json : une fois par jour, le soir, pour limiter la consommation de l'API).
 * Le soir (`soir=1`), bilan complet et
 * détaillé, envoyé par e-mail (DAILY_REPORT_EMAIL, sinon les super-administrateurs).
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    if (new URL(req.url).searchParams.get("soir") === "1") {
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
