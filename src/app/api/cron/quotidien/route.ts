import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { processAlertDigests, processEmailOutbox } from "@/lib/email/outbox";
import { runDueSources } from "@/lib/collect/run";
import { logServerError } from "@/lib/errors";
import { runDailyArticles } from "@/lib/articles";
import { submitChangedUrls } from "@/lib/indexnow";

// La collecte de plusieurs sources peut prendre du temps.
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = env.cronSecret;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/**
 * Tâche planifiée (Vercel Cron — vercel.json) :
 * 1. collecte des sources externes dont l'échéance est atteinte ;
 * 2. expiration des opportunités ;
 * 3. analyses de marché rédigées à partir des données (Administration → Articles) ;
 * 4. IndexNow : signalement des pages nouvelles ou modifiées aux moteurs de recherche ;
 * 5. résumés d'alertes ;
 * 6. envoi de la file d'e-mails ;
 * 7. purge de la mesure d'audience de plus de 13 mois.
 * Chaque étape est isolée : l'échec de l'une n'empêche pas les suivantes.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const report: Record<string, unknown> = {};
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      report[name] = await fn();
    } catch (e) {
      logServerError(`cron ${name}`, e);
      report[name] = { error: e instanceof Error ? e.message : String(e) };
    }
  };
  await step("sources", () => runDueSources());
  await step("expired", async () => (await createAdminClient().rpc("expire_opportunities")).data);
  await step("articles", () => runDailyArticles());
  await step("indexnow", () => submitChangedUrls());
  await step("digests", () => processAlertDigests());
  await step("emails", () => processEmailOutbox(200));
  await step("audience", async () => (await createAdminClient().rpc("purge_page_views")).data);
  const failed = Object.entries(report).filter(([, v]) => v && typeof v === "object" && "error" in v).map(([k]) => k);
  // Trace de la dernière exécution (supervision : /api/sante et Administration → Synchronisations)
  await createAdminClient()
    .from("platform_settings")
    .upsert({ key: "private.cron", value: { last_run_at: new Date().toISOString(), failed_steps: failed }, description: "Dernière exécution de la tâche planifiée" })
    .then(({ error }) => error && logServerError("cron trace", error));
  return NextResponse.json({ ok: failed.length === 0, ...report });
}
