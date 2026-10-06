import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONNECTORS, type FetchLike, type SourceConfig } from "@/lib/collect/connectors";
import { contentHash, dedupKey, isSameConsultation, type NormalizedOpportunity } from "@/lib/collect/normalize";
import { logServerError } from "@/lib/errors";
import type { Database, Json } from "@/lib/database.types";

type Source = Database["public"]["Tables"]["external_sources"]["Row"];
type Admin = ReturnType<typeof createAdminClient>;

export type RunStats = {
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  duplicates: number;
  skipped: number;
  expired: number;
  errors: string[];
  newIds: string[];
};

const FREQUENCY_MS: Record<string, number> = { hourly: 3_600_000, daily: 86_400_000, weekly: 7 * 86_400_000 };

function opportunityRow(item: NormalizedOpportunity, sectors: Set<string>, departments: Set<string>) {
  return {
    type: item.type,
    origin: "EXTERNAL" as const,
    title: item.title.slice(0, 180),
    summary: item.summary?.slice(0, 400) ?? null,
    description: item.description.slice(0, 5000),
    external_buyer_name: item.buyer,
    sector_slug: item.sectorSlug && sectors.has(item.sectorSlug) ? item.sectorSlug : null,
    city: item.city,
    department_code: item.departmentCode && departments.has(item.departmentCode) ? item.departmentCode : null,
    response_deadline: item.deadline,
    keywords: item.keywords,
    cpv_codes: item.cpv,
    external_reference: item.externalId,
    dedup_key: dedupKey(item.buyer, item.deadline),
  };
}

/**
 * Rapproche une annonce d'une opportunité externe existante publiée par une AUTRE
 * source : même date limite (à un jour près, fuseaux), titre et acheteur proches.
 */
async function findDuplicate(db: Admin, item: NormalizedOpportunity, sourceId: string): Promise<string | null> {
  if (!item.deadline) return null;
  const day = new Date(item.deadline.slice(0, 10) + "T00:00:00Z").getTime();
  const { data } = await db
    .from("opportunities")
    .select("id, title, external_buyer_name, opportunity_sources(source_id)")
    .eq("origin", "EXTERNAL")
    .gte("response_deadline", new Date(day - 86_400_000).toISOString())
    .lt("response_deadline", new Date(day + 2 * 86_400_000).toISOString())
    .limit(200);
  for (const cand of data ?? []) {
    const sources = (cand.opportunity_sources as { source_id: string }[]) ?? [];
    if (sources.some((s) => s.source_id === sourceId)) continue;
    if (isSameConsultation({ title: cand.title, buyer: cand.external_buyer_name }, item)) return cand.id;
  }
  return null;
}

/** Exécute la collecte d'une source et journalise le résultat dans source_sync_runs. */
export async function runSource(
  source: Source,
  opts: { trigger: "cron" | "manual" | "test"; userId?: string | null; fetchImpl?: FetchLike; now?: Date } = { trigger: "cron" },
): Promise<RunStats & { runId: string | null; status: string }> {
  const db = createAdminClient();
  const now = opts.now ?? new Date();
  const stats: RunStats = { fetched: 0, created: 0, updated: 0, unchanged: 0, duplicates: 0, skipped: 0, expired: 0, errors: [], newIds: [] };
  const { data: run } = await db
    .from("source_sync_runs")
    .insert({ source_id: source.id, trigger: opts.trigger, triggered_by: opts.userId ?? null })
    .select("id")
    .single();
  const runId = run?.id ?? null;
  const finish = async (status: "SUCCESS" | "PARTIAL" | "FAILED", sample?: Json) => {
    if (runId) {
      await db
        .from("source_sync_runs")
        .update({ status, finished_at: new Date().toISOString(), fetched: stats.fetched, created: stats.created, updated: stats.updated, unchanged: stats.unchanged, duplicates: stats.duplicates, skipped: stats.skipped, expired: stats.expired, errors: stats.errors.slice(0, 50), ...(sample !== undefined ? { sample } : {}) })
        .eq("id", runId);
    }
    const freq = FREQUENCY_MS[source.sync_frequency] ?? FREQUENCY_MS.daily;
    await db
      .from("external_sources")
      .update({
        last_sync_at: now.toISOString(),
        next_sync_at: new Date(now.getTime() + freq).toISOString(),
        ...(status !== "FAILED" ? { last_success_at: now.toISOString(), last_error: null } : { last_error: stats.errors[0]?.slice(0, 500) ?? "Erreur inconnue" }),
      })
      .eq("id", source.id);
    return { ...stats, runId, status };
  };

  const connector = CONNECTORS[source.connector];
  if (!connector) {
    stats.errors.push(`Connecteur « ${source.connector} » non automatisé : référencement manuel uniquement.`);
    return finish("FAILED");
  }
  if (source.status !== "APPROVED" && opts.trigger !== "test") {
    stats.errors.push("Source non approuvée : collecte refusée.");
    return finish("FAILED");
  }

  const config = (source.config ?? {}) as SourceConfig;
  const lookback = Number(config.lookbackDays) > 0 ? Number(config.lookbackDays) : 21;
  // Collecte incrémentale : depuis la dernière synchronisation réussie (avec recouvrement), sinon fenêtre initiale.
  const since = source.last_success_at && opts.trigger !== "test"
    ? new Date(Math.min(new Date(source.last_success_at).getTime() - 2 * 86_400_000, now.getTime()))
    : new Date(now.getTime() - lookback * 86_400_000);

  let batch;
  try {
    batch = await connector({ config, since, fetchImpl: opts.fetchImpl ?? fetch, now });
  } catch (e) {
    stats.errors.push(e instanceof Error ? e.message : String(e));
    logServerError(`collect ${source.code ?? source.name}`, e);
    return finish("FAILED");
  }
  stats.fetched = batch.records.length;

  if (opts.trigger === "test") {
    // Test de configuration : aucune écriture d'opportunité, retour d'un échantillon.
    for (const m of batch.mapped) if (!m.ok) { stats.skipped++; if (stats.errors.length < 10) stats.errors.push(m.reason); }
    const sample = batch.mapped.filter((m) => m.ok).slice(0, 5).map((m) => (m.ok ? m.item : null));
    return finish(stats.skipped && !sample.length ? "FAILED" : "SUCCESS", { records: batch.records.slice(0, 2), mapped: sample } as unknown as Json);
  }

  const [{ data: sectorRows }, { data: deptRows }] = await Promise.all([
    db.from("sectors").select("slug"),
    db.from("departments").select("code"),
  ]);
  const sectors = new Set((sectorRows ?? []).map((s) => s.slug));
  const departments = new Set((deptRows ?? []).map((d) => d.code));
  const seenInBatch = new Set<string>();

  for (const m of batch.mapped) {
    if (!m.ok) {
      stats.skipped++;
      if (!m.reason.startsWith("hors zone") && stats.errors.length < 50) stats.errors.push(m.reason);
      continue;
    }
    const item = m.item;
    if (seenInBatch.has(item.externalId)) continue;
    seenInBatch.add(item.externalId);
    try {
      const hash = contentHash(item);
      const row = opportunityRow(item, sectors, departments);
      const { data: existing } = await db
        .from("opportunity_sources")
        .select("opportunity_id, content_hash, opportunities(status)")
        .eq("source_id", source.id)
        .eq("external_id", item.externalId)
        .maybeSingle();

      if (existing) {
        const patch: Database["public"]["Tables"]["opportunity_sources"]["Update"] = { last_verified_at: now.toISOString(), verification_status: "VERIFIED" };
        if (existing.content_hash !== hash) {
          // Modification détectée à la source : mise à jour du contenu.
          const status = item.status === "CANCELLED" ? "ARCHIVED" : undefined;
          await db.from("opportunities").update({ ...row, ...(status ? { status, moderation_note: "Annulée à la source" } : {}) }).eq("id", existing.opportunity_id);
          patch.content_hash = hash;
          patch.original_url = item.originalUrl;
          patch.source_updated_at = now.toISOString();
          stats.updated++;
        } else stats.unchanged++;
        await db.from("opportunity_sources").update(patch).eq("opportunity_id", existing.opportunity_id).eq("source_id", source.id);
        continue;
      }

      if (item.status === "CANCELLED") {
        stats.skipped++;
        continue;
      }
      if (item.deadline && new Date(item.deadline) < now) {
        stats.expired++;
        continue;
      }

      const duplicateOf = await findDuplicate(db, item, source.id);
      if (duplicateOf) {
        // Même consultation déjà connue via une autre source : on rattache la source.
        await db.from("opportunity_sources").insert({
          opportunity_id: duplicateOf, source_id: source.id, external_id: item.externalId, original_url: item.originalUrl,
          source_published_at: item.publishedAt, last_verified_at: now.toISOString(), content_hash: hash, is_primary: false,
        });
        stats.duplicates++;
        continue;
      }

      const { data: created, error } = await db
        .from("opportunities")
        .insert({ ...row, status: "PUBLISHED", published_at: item.publishedAt ? new Date(`${item.publishedAt}T08:00:00Z`).toISOString() : now.toISOString(), is_demo: false })
        .select("id")
        .single();
      if (error || !created) throw new Error(error?.message ?? "insertion impossible");
      const { error: srcErr } = await db.from("opportunity_sources").insert({
        opportunity_id: created.id, source_id: source.id, external_id: item.externalId, original_url: item.originalUrl,
        source_published_at: item.publishedAt, last_verified_at: now.toISOString(), content_hash: hash, is_primary: true,
      });
      if (srcErr) {
        await db.from("opportunities").delete().eq("id", created.id);
        throw new Error(srcErr.message);
      }
      stats.created++;
      stats.newIds.push(created.id);
    } catch (e) {
      stats.errors.push(`${item.externalId} : ${e instanceof Error ? e.message : String(e)}`.slice(0, 300));
    }
  }

  // Alertes immédiates pour les nouvelles opportunités
  for (const id of stats.newIds) {
    await db.rpc("dispatch_immediate_alerts", { p_opportunity_id: id });
  }

  const failedItems = stats.errors.length > 0 && stats.created + stats.updated + stats.unchanged + stats.duplicates === 0 && stats.fetched > 0;
  return finish(failedItems ? "FAILED" : stats.errors.length ? "PARTIAL" : "SUCCESS");
}

/** Synchronise toutes les sources actives et approuvées dont l'échéance est atteinte. */
export async function runDueSources(opts: { force?: boolean } = {}) {
  const db = createAdminClient();
  const { data: sources } = await db.from("external_sources").select("*").eq("is_active", true).eq("status", "APPROVED").neq("connector", "manual");
  const now = new Date();
  const results: { source: string; status: string; created: number; updated: number; duplicates: number; errors: number }[] = [];
  for (const s of sources ?? []) {
    if (!opts.force && s.next_sync_at && new Date(s.next_sync_at) > now) continue;
    const r = await runSource(s, { trigger: "cron" });
    results.push({ source: s.code ?? s.name, status: r.status, created: r.created, updated: r.updated, duplicates: r.duplicates, errors: r.errors.length });
  }
  return results;
}
