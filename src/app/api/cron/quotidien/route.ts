import { cronPausedResponse } from "@/lib/cron-usage";
import { NextResponse } from "next/server";
import { startCronMeter } from "@/lib/cron-usage";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { processAlertDigests, processEmailOutbox } from "@/lib/email/outbox";
import { processLeadDigests } from "@/lib/alert-leads";
import { processMissingLogos } from "@/lib/company-logos";
import { processNeedCampaigns } from "@/lib/needs";
import { runDueSources } from "@/lib/collect/run";
import { importPlaces } from "@/lib/collect/places";
import { logServerError } from "@/lib/errors";
import { runDailyArticles } from "@/lib/articles";
import { submitChangedUrls } from "@/lib/indexnow";
import type { Json } from "@/lib/database.types";

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
 * 0. référentiel des villes de France (une seule fois, geo.api.gouv.fr) ;
 * 1. collecte des sources externes dont l'échéance est atteinte (France entière) ;
 * 2. expiration des opportunités ;
 * 3. analyses de marché rédigées à partir des données (Administration → Articles) ;
 * 4. IndexNow : signalement des pages nouvelles ou modifiées aux moteurs de recherche ;
 * 5. résumés d'alertes ;
 * 6. envoi de la file d'e-mails ;
 * 7. purge de la mesure d'audience de plus de 13 mois.
 * Chaque étape est isolée : l'échec de l'une n'empêche pas les suivantes.
 *
 * Plusieurs passages par jour (vercel.json : matin, midi, après-midi, soir) : chaque passage
 * reprend les sources dont la dernière collecte date de plus de 3 h 30 (annonces publiées dans la
 * journée), signale les nouvelles pages et envoie les e-mails en attente. Les étapes quotidiennes
 * (articles, résumés d'alertes) ne refont rien une fois leur quota du jour atteint.
 */
const REFRESH_AFTER_MS = 3.5 * 3_600_000;
async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const started = Date.now();
  const report: Record<string, unknown> = {};
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      report[name] = await fn();
    } catch (e) {
      logServerError(`cron ${name}`, e);
      report[name] = { error: e instanceof Error ? e.message : String(e) };
    }
  };
  await step("referentiel", () => importPlaces());
  // Une source en panne n'empêche pas les autres (erreur journalisée par source, nouvelle tentative au passage suivant)
  await step("sources", async () => {
    const results = await runDueSources({ budgetMs: 180_000, refreshAfterMs: REFRESH_AFTER_MS });
    const failed = results.filter((r) => r.status === "FAILED").map((r) => r.source);
    // Une source en échec est signalée (supervision, bilan du jour) ; les autres ont bien été collectées
    return failed.length ? { results, error: `Collecte en échec : ${failed.join(", ")}` } : results;
  });
  await step("expired", async () => {
    const { data, error } = await createAdminClient().rpc("expire_opportunities");
    if (error) throw error;
    return data;
  });
  // Budget de la tâche (limite 300 s) : la rédaction d'articles est reportée au passage suivant
  // si la collecte a pris trop de temps, pour garder le temps d'envoyer alertes et e-mails.
  const elapsed = () => Date.now() - started;
  // Rédaction bornée : il reste toujours environ 80 s pour les étapes suivantes
  await step("articles", async () => (elapsed() < 150_000 ? runDailyArticles({ deadline: started + 220_000 }) : { skipped: "reporté au passage suivant (temps insuffisant)" }));
  await step("indexnow", () => submitChangedUrls());
  await step("digests", () => processAlertDigests());
  await step("alertes-email", () => processLeadDigests());
  // Mise en relation des besoins publiés (filet de sécurité de la publication, relances) avant l'envoi des e-mails
  await step("besoins", async () => (elapsed() < 190_000 ? processNeedCampaigns(createAdminClient(), { deadline: started + 215_000 }) : { skipped: "reporté au passage suivant (temps insuffisant)" }));
  await step("emails", () => processEmailOutbox(elapsed() < 220_000 ? 200 : 40));
  await step("logos", async () => (elapsed() < 200_000 ? processMissingLogos(createAdminClient(), { limit: 20, deadline: started + 230_000 }) : { skipped: "reporté au passage suivant (temps insuffisant)" }));
  // Lignes de campagne inutiles (entreprises sans adresse, déjà contactées) des jours passés : par paquets
  await step("purge-campagnes", async () => {
    let deleted = 0;
    while (elapsed() < 255_000) {
      const { data, error } = await createAdminClient().rpc("purge_campaign_placeholders", { p_limit: 5000 });
      if (error) throw error;
      deleted += data ?? 0;
      if (!data) break;
    }
    return { deleted };
  });
  await step("audience", async () => {
    const { data, error } = await createAdminClient().rpc("purge_page_views");
    if (error) throw error;
    return data;
  });
  const failed = Object.entries(report).filter(([, v]) => v && typeof v === "object" && "error" in v).map(([k]) => k);
  // Trace des exécutions (supervision : /api/sante, Administration → Synchronisations, bilan du jour)
  const db = createAdminClient();
  const { data: prev } = await db.from("platform_settings").select("value").eq("key", "private.cron").maybeSingle();
  const at = new Date().toISOString();
  const history = [...(((prev?.value ?? {}) as { history?: Json[] }).history ?? []), { at, passe: new URL(req.url).searchParams.get("passe") ?? "matin", failed_steps: failed }].slice(-12);
  await db
    .from("platform_settings")
    .upsert({ key: "private.cron", value: { last_run_at: at, failed_steps: failed, history }, description: "Dernière exécution de la tâche planifiée" })
    .then(({ error }) => error && logServerError("cron trace", error));
  return NextResponse.json({ ok: failed.length === 0, ...report });
}

/** Passage mesuré (temps de calcul, voir src/lib/cron-usage.ts). */
export async function GET(req: Request) {
  if (!authorized(req)) return run(req);
  const paused = cronPausedResponse();
  if (paused) return paused;
  const stop = startCronMeter(`quotidien${new URL(req.url).search}`);
  try {
    return await run(req);
  } finally {
    await stop();
  }
}
