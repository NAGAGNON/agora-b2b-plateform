import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { logServerError } from "@/lib/errors";
import { generateDailyReport } from "@/lib/daily-report";

export const maxDuration = 120;

function authorized(req: Request): boolean {
  const secret = env.cronSecret;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/** Bilan du jour (vercel.json : après les passes Outreach, puis en fin de journée). */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    const r = await generateDailyReport();
    return NextResponse.json({ ok: !r.error, day: r.day, model: r.model, note: r.note, error: r.error });
  } catch (e) {
    logServerError("cron bilan", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
