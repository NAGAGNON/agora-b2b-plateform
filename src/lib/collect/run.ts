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
    // Région : déduite du département par la base ; transmise directement si seule la région est connue
    ...(item.region && !(item.departmentCode && departments.has(item.departmentCode)) ? { region: item.region } : {}),
    response_deadline: item.deadline,
    keywords: item.keywords,
    cpv_codes: item.cpv,
    external_reference: item.externalId,
    dedup_key: dedupKey(item.buyer, item.deadline),
  };
}

type Candidate = { id: string; title: string; buyer: string | null; day: number; sources: Set<string> };
const DAY = 86_400_000;
const dayOf = (iso: string) => new Date(iso.slice(0, 10) + "T00:00:00Z").getTime();
const chunks = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

/**
 * Index des opportunités externes candidates au rapprochement (date limite dans la
 * fenêtre des annonces du lot), chargé une fois par synchronisation, par pages.
 */
async function loadCandidates(db: Admin, items: NormalizedOpportunity[]): Promise<Map<number, Candidate[]>> {
  const days = items.filter((i) => i.deadline).map((i) => dayOf(i.deadline!));
  const index = new Map<number, Candidate[]>();
  if (!days.length) return index;
  const from = new Date(Math.min(...days) - DAY).toISOString();
  const to = new Date(Math.max(...days) + 2 * DAY).toISOString();
  for (let page = 0; page < 100; page++) {
    const { data, error } = await db
      .from("opportunities")
      .select("id, title, external_buyer_name, response_deadline, opportunity_sources(source_id)")
      .eq("origin", "EXTERNAL")
      .gte("response_deadline", from)
      .lt("response_deadline", to)
      .order("id")
      .range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const c: Candidate = {
        id: r.id, title: r.title, buyer: r.external_buyer_name, day: dayOf(r.response_deadline!),
        sources: new Set(((r.opportunity_sources as { source_id: string }[]) ?? []).map((s) => s.source_id)),
      };
      index.set(c.day, [...(index.get(c.day) ?? []), c]);
    }
    if ((data ?? []).length < 1000) break;
  }
  return index;
}

/**
 * Rapproche une annonce d'une opportunité externe existante publiée par une AUTRE
 * source : même date limite (à un jour près, fuseaux), titre et acheteur proches.
 */
function findDuplicate(index: Map<number, Candidate[]>, item: NormalizedOpportunity, sourceId: string): string | null {
  if (!item.deadline) return null;
  const day = dayOf(item.deadline);
  for (const d of [day, day - DAY, day + DAY]) {
    for (const cand of index.get(d) ?? []) {
      if (cand.sources.has(sourceId)) continue;
      if (isSameConsultation({ title: cand.title, buyer: cand.buyer }, item)) return cand.id;
    }
  }
  return null;
}

/** Réessaie une collecte en cas d'indisponibilité passagère d'une source. */
async function withRetry<T>(fn: () => Promise<T>, attempts: number, delays = [5_000, 15_000]): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delays[i] ?? delays[delays.length - 1]));
    }
  }
  throw last;
}

/** Exécute la collecte d'une source et journalise le résultat dans source_sync_runs. */
export async function runSource(
  source: Source,
  opts: { trigger: "cron" | "manual" | "test"; userId?: string | null; fetchImpl?: FetchLike; now?: Date; retries?: number; retryDelays?: number[] } = { trigger: "cron" },
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
    batch = await withRetry(() => connector({ config, since, fetchImpl: opts.fetchImpl ?? fetch, now }), opts.retries ?? 3, opts.retryDelays);
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
  const valid: NormalizedOpportunity[] = [];
  for (const m of batch.mapped) {
    if (!m.ok) {
      stats.skipped++;
      if (!m.reason.startsWith("hors zone") && stats.errors.length < 50) stats.errors.push(m.reason);
      continue;
    }
    if (seenInBatch.has(m.item.externalId)) continue;
    seenInBatch.add(m.item.externalId);
    valid.push(m.item);
  }

  // 1. Annonces déjà connues de cette source (lecture groupée)
  const known = new Map<string, { opportunity_id: string; content_hash: string | null }>();
  for (const ids of chunks(valid.map((i) => i.externalId), 300)) {
    const { data, error } = await db.from("opportunity_sources").select("opportunity_id, external_id, content_hash").eq("source_id", source.id).in("external_id", ids);
    if (error) {
      stats.errors.push(`lecture des annonces connues : ${error.message}`);
      return finish("FAILED");
    }
    for (const r of data ?? []) if (r.external_id) known.set(r.external_id, r);
  }

  const unchangedIds: string[] = [];
  const fresh: NormalizedOpportunity[] = [];
  for (const item of valid) {
    const existing = known.get(item.externalId);
    if (!existing) {
      if (item.status === "CANCELLED") stats.skipped++;
      else if (item.deadline && new Date(item.deadline) < now) stats.expired++;
      else fresh.push(item);
      continue;
    }
    const hash = contentHash(item);
    if (existing.content_hash === hash) {
      unchangedIds.push(existing.opportunity_id);
      stats.unchanged++;
      continue;
    }
    // 2. Modification détectée à la source : mise à jour du même enregistrement
    try {
      const row = opportunityRow(item, sectors, departments);
      const status = item.status === "CANCELLED" ? "ARCHIVED" : undefined;
      const { error } = await db.from("opportunities").update({ ...row, ...(status ? { status, moderation_note: "Annulée à la source" } : {}) }).eq("id", existing.opportunity_id);
      if (error) throw new Error(error.message);
      await db
        .from("opportunity_sources")
        .update({ last_verified_at: now.toISOString(), verification_status: "VERIFIED", content_hash: hash, original_url: item.originalUrl, source_updated_at: now.toISOString() })
        .eq("opportunity_id", existing.opportunity_id)
        .eq("source_id", source.id);
      stats.updated++;
    } catch (e) {
      stats.errors.push(`${item.externalId} : ${e instanceof Error ? e.message : String(e)}`.slice(0, 300));
    }
  }
  // Annonces inchangées : date de vérification mise à jour en une requête par lot
  for (const ids of chunks(unchangedIds, 300)) {
    await db.from("opportunity_sources").update({ last_verified_at: now.toISOString(), verification_status: "VERIFIED" }).eq("source_id", source.id).in("opportunity_id", ids);
  }

  // 3. Nouvelles annonces : rapprochement avec les autres sources, puis insertion groupée
  let candidates: Map<number, Candidate[]>;
  try {
    candidates = await loadCandidates(db, fresh);
  } catch (e) {
    stats.errors.push(`chargement des doublons potentiels : ${e instanceof Error ? e.message : String(e)}`);
    return finish("FAILED");
  }
  const toCreate: NormalizedOpportunity[] = [];
  for (const item of fresh) {
    const duplicateOf = findDuplicate(candidates, item, source.id);
    if (!duplicateOf) {
      toCreate.push(item);
      continue;
    }
    // Même consultation déjà connue via une autre source : on rattache la source.
    const { error } = await db.from("opportunity_sources").insert({
      opportunity_id: duplicateOf, source_id: source.id, external_id: item.externalId, original_url: item.originalUrl,
      source_published_at: item.publishedAt, last_verified_at: now.toISOString(), content_hash: contentHash(item), is_primary: false,
    });
    if (error && error.code !== "23505") stats.errors.push(`${item.externalId} : ${error.message}`.slice(0, 300));
    else stats.duplicates++;
  }

  const insertOne = async (item: NormalizedOpportunity) => {
    const { data: created, error } = await db
      .from("opportunities")
      .insert(newRow(item))
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "insertion impossible");
    const { error: srcErr } = await db.from("opportunity_sources").insert(sourceRow(created.id, item));
    if (srcErr) {
      await db.from("opportunities").delete().eq("id", created.id);
      throw new Error(srcErr.message);
    }
    return created.id;
  };
  const newRow = (item: NormalizedOpportunity) => ({
    ...opportunityRow(item, sectors, departments),
    status: "PUBLISHED" as const,
    published_at: item.publishedAt ? new Date(`${item.publishedAt}T08:00:00Z`).toISOString() : now.toISOString(),
    is_demo: false,
  });
  const sourceRow = (opportunityId: string, item: NormalizedOpportunity) => ({
    opportunity_id: opportunityId, source_id: source.id, external_id: item.externalId, original_url: item.originalUrl,
    source_published_at: item.publishedAt, last_verified_at: now.toISOString(), content_hash: contentHash(item), is_primary: true,
  });

  const createdItems: { id: string; item: NormalizedOpportunity }[] = [];
  for (const group of chunks(toCreate, 200)) {
    const { data: created, error } = await db.from("opportunities").insert(group.map(newRow)).select("id, external_reference");
    if (!error && created && created.length === group.length) {
      const idByRef = new Map(created.map((c) => [c.external_reference, c.id]));
      const { error: srcErr } = await db.from("opportunity_sources").insert(group.map((item) => sourceRow(idByRef.get(item.externalId)!, item)));
      if (!srcErr) {
        stats.created += created.length;
        for (const item of group) createdItems.push({ id: idByRef.get(item.externalId)!, item });
        continue;
      }
      // Rattachement impossible : annulation du lot puis insertion une à une
      await db.from("opportunities").delete().in("id", created.map((c) => c.id));
    }
    for (const item of group) {
      try {
        createdItems.push({ id: await insertOne(item), item });
        stats.created++;
      } catch (e) {
        stats.errors.push(`${item.externalId} : ${e instanceof Error ? e.message : String(e)}`.slice(0, 300));
      }
    }
  }

  // Alertes immédiates : uniquement pour les annonces récentes (pas lors d'un premier import massif)
  stats.newIds = createdItems.map((c) => c.id);
  const recentCut = now.getTime() - 3 * DAY;
  const recent = createdItems.filter((c) => !c.item.publishedAt || new Date(c.item.publishedAt).getTime() >= recentCut).map((c) => c.id);
  for (const id of recent.slice(0, 500)) {
    await db.rpc("dispatch_immediate_alerts", { p_opportunity_id: id });
  }

  const failedItems = stats.errors.length > 0 && stats.created + stats.updated + stats.unchanged + stats.duplicates === 0 && stats.fetched > 0;
  return finish(failedItems ? "FAILED" : stats.errors.length ? "PARTIAL" : "SUCCESS");
}

/** Synchronise toutes les sources actives et approuvées dont l'échéance est atteinte. */
export async function runDueSources(opts: { force?: boolean; budgetMs?: number; fetchImpl?: FetchLike; retryDelays?: number[]; codes?: string[] } = {}) {
  const startedAt = Date.now();
  const db = createAdminClient();
  const { data: sources } = await db.from("external_sources").select("*").eq("is_active", true).eq("status", "APPROVED").neq("connector", "manual");
  const now = new Date();
  const results: { source: string; status: string; created: number; updated: number; duplicates: number; errors: number }[] = [];
  for (const s of sources ?? []) {
    if (opts.codes && !opts.codes.includes(s.code ?? "")) continue;
    if (!opts.force && s.next_sync_at && new Date(s.next_sync_at) > now) continue;
    // Budget de temps de la tâche planifiée : les sources restantes passent à l'exécution suivante
    if (opts.budgetMs && Date.now() - startedAt > opts.budgetMs) {
      results.push({ source: s.code ?? s.name, status: "DEFERRED", created: 0, updated: 0, duplicates: 0, errors: 0 });
      continue;
    }
    const r = await runSource(s, { trigger: "cron", fetchImpl: opts.fetchImpl, retryDelays: opts.retryDelays });
    results.push({ source: s.code ?? s.name, status: r.status, created: r.created, updated: r.updated, duplicates: r.duplicates, errors: r.errors.length });
  }
  return results;
}
