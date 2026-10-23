import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { siteUrl } from "@/lib/seo";
import { parisDayStart, parisToday } from "@/lib/daily-report";
import { OPPORTUNITY_TYPE_LABELS, SECTOR_LABELS, sectorLabel } from "@/lib/constants";
import { renderVeilleEmail, renderVeilleInvitation, type VeilleKind } from "@/lib/veille/render";
import { cleanPool, criteriaFor, MIN_DAILY_ITEMS, MIN_NEWSLETTER_ITEMS, selectOpportunities, type AudienceMember, type VeilleOpportunity } from "@/lib/veille/select";
import type { VeilleMessage, VeilleSendResult } from "@/lib/veille/send";
import { buildSuivi, loadSuiviAudience, loadSuiviSettings, renderSuiviEmail, SUIVI_NEWS, type SuiviMember, type SuiviStep } from "@/lib/veille/suivi";

type DB = SupabaseClient<Database>;

export type VeilleSettings = { invitations_enabled?: boolean; enabled: boolean; launch_date: string; daily_cap: number; test_sent_at?: string | null; test_sent_to?: string | null };
export const DEFAULT_VEILLE_SETTINGS: VeilleSettings = { enabled: false, launch_date: "2026-10-15", daily_cap: 150 };

export async function loadVeilleSettings(db: DB): Promise<VeilleSettings> {
  const { data } = await db.from("platform_settings").select("value").eq("key", "veille").maybeSingle();
  return { ...DEFAULT_VEILLE_SETTINGS, ...((data?.value ?? {}) as Partial<VeilleSettings>) };
}

/** Jour de la semaine (0 = dimanche) d'une date « AAAA-MM-JJ ». */
export const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** Éditions du jour : le lancement d'abord (une seule fois), puis lundi / vendredi et l'alerte quotidienne. */
export function editionsFor(date: string, settings: VeilleSettings, launchDone: boolean): VeilleKind[] {
  if (!launchDone) return date >= settings.launch_date ? ["LAUNCH"] : [];
  const kinds: VeilleKind[] = [];
  if (weekday(date) === 1) kinds.push("MONDAY");
  if (weekday(date) === 5) kinds.push("FRIDAY");
  kinds.push("DAILY");
  return kinds;
}

const POOL_DAYS: Record<VeilleKind, number> = { LAUNCH: 14, MONDAY: 7, FRIDAY: 7, DAILY: 3 };

export async function loadLabels(db: DB) {
  const { data } = await db.from("sectors").select("slug, label");
  const labels: Record<string, string> = { ...SECTOR_LABELS, ...Object.fromEntries((data ?? []).map((s) => [s.slug, s.label])) };
  return { sectorLabel: (slug: string) => sectorLabel(slug, labels), typeLabel: (t: string) => OPPORTUNITY_TYPE_LABELS[t as keyof typeof OPPORTUNITY_TYPE_LABELS] ?? t };
}

const OPP_COLUMNS = "id, title, summary, description, sector_slug, region, department_code, city, type, published_at, response_deadline, origin, external_buyer_name, source:opportunity_sources(is_primary, external_source:external_sources(name))";
type OppRow = Omit<VeilleOpportunity, "source"> & { source: unknown };

function toOpp(o: OppRow): VeilleOpportunity {
  const sources = (Array.isArray(o.source) ? o.source : o.source ? [o.source] : []) as { is_primary: boolean; external_source: { name: string } | { name: string }[] | null }[];
  const primary = sources.find((s) => s.is_primary) ?? sources[0];
  const ext = primary?.external_source;
  return { ...o, source: (Array.isArray(ext) ? ext[0]?.name : ext?.name) ?? null };
}

/** Annonces réelles, publiques, publiées et encore ouvertes (démo exclue), publiées depuis `days` jours. */
export async function loadPool(db: DB, days: number, now = new Date()): Promise<VeilleOpportunity[]> {
  const rows: VeilleOpportunity[] = [];
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  for (let page = 0; page < 6; page++) {
    const { data, error } = await db
      .from("opportunities")
      .select(OPP_COLUMNS)
      .eq("status", "PUBLISHED")
      .eq("visibility", "PUBLIC")
      .eq("is_demo", false)
      .is("duplicate_of", null)
      .gte("published_at", since)
      .lte("published_at", now.toISOString())
      .or(`response_deadline.is.null,response_deadline.gt.${now.toISOString()}`)
      .order("published_at", { ascending: false })
      .order("id")
      .range(page * 1000, page * 1000 + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as OppRow[]).map(toOpp));
    if ((data ?? []).length < 1000) break;
  }
  return cleanPool(rows, now);
}

export async function loadAudience(db: DB): Promise<AudienceMember[]> {
  const { data, error } = await db.rpc("veille_audience");
  if (error) throw error;
  return (data ?? []) as AudienceMember[];
}

/** Opportunités déjà envoyées (ou en attente d'envoi) à chaque destinataire : jamais deux fois la même. */
export async function alreadySent(db: DB, userIds: string[]) {
  const map = new Map<string, Set<string>>();
  for (let i = 0; i < userIds.length; i += 200) {
    const { data } = await db.from("veille_sends").select("user_id, opportunity_ids").in("user_id", userIds.slice(i, i + 200)).in("status", ["PENDING", "SENDING", "SENT"]);
    for (const r of data ?? []) {
      const s = map.get(r.user_id) ?? new Set<string>();
      for (const id of r.opportunity_ids) s.add(id);
      map.set(r.user_id, s);
    }
  }
  return map;
}

export function eligibleFor(kind: VeilleKind, m: AudienceMember): boolean {
  if (kind === "LAUNCH") return true;
  if (kind === "DAILY") return m.frequency === "DAILY" && criteriaFor(m).basis !== null;
  return m.frequency === "TWICE_WEEKLY";
}

/** Prépare une édition : un envoi par destinataire éligible, avec sa sélection. Idempotent (une édition par jour et par type). */
export async function buildEdition(db: DB, kind: VeilleKind, date: string, now = new Date()): Promise<{ campaignId: string | null; recipients: number; skipped: number; created: boolean }> {
  const { data: existing } = await db.from("veille_campaigns").select("id, status").eq("kind", kind).eq("edition_date", date).maybeSingle();
  if (existing) return { campaignId: existing.id, recipients: 0, skipped: 0, created: false };
  const { data: campaign, error } = await db.from("veille_campaigns").insert({ kind, edition_date: date, status: "BUILDING" }).select("id").single();
  if (error) {
    if (error.code === "23505") return { campaignId: null, recipients: 0, skipped: 0, created: false };
    throw error;
  }
  const audience = (await loadAudience(db)).filter((m) => eligibleFor(kind, m));
  // Une seule veille par personne et par jour (le lancement remplace l'alerte du jour)
  const { data: today } = await db.from("veille_sends").select("user_id, campaign:veille_campaigns!inner(edition_date)").eq("campaign.edition_date", date);
  const servedToday = new Set((today ?? []).map((r) => r.user_id));
  const pool = await loadPool(db, POOL_DAYS[kind], now);
  const sent = await alreadySent(db, audience.map((m) => m.user_id));
  const min = kind === "DAILY" ? MIN_DAILY_ITEMS : MIN_NEWSLETTER_ITEMS;
  const rows: Database["public"]["Tables"]["veille_sends"]["Insert"][] = [];
  let skipped = 0;
  for (const m of audience) {
    if (servedToday.has(m.user_id)) continue;
    const { criteria, basis } = criteriaFor(m);
    const items = selectOpportunities(pool, criteria, basis, sent.get(m.user_id) ?? new Set());
    // Jamais de remplissage artificiel : pas assez d'annonces pertinentes → pas d'envoi
    if (items.length < min) {
      skipped++;
      continue;
    }
    rows.push({ campaign_id: campaign.id, user_id: m.user_id, email: m.email, opportunity_ids: items.map((o) => o.id), personalized: basis !== null });
  }
  for (let i = 0; i < rows.length; i += 500) {
    const { error: e } = await db.from("veille_sends").insert(rows.slice(i, i + 500));
    if (e) throw e;
  }
  await db
    .from("veille_campaigns")
    .update({
      status: rows.length ? "SENDING" : "EMPTY",
      recipients: rows.length,
      skipped,
      note: rows.length ? null : audience.length ? "Pas assez d'opportunités pertinentes pour les destinataires" : "Aucun destinataire éligible",
      completed_at: rows.length ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaign.id);
  return { campaignId: campaign.id, recipients: rows.length, skipped, created: true };
}

/** Rendu d'un envoi précis (aussi utilisé pour l'aperçu en administration). */
export async function renderForSend(db: DB, send: { token: string; opportunity_ids: string[] }, kind: VeilleKind, member: AudienceMember, now = new Date()) {
  // Vérification juste avant l'envoi : annonces toujours publiées, publiques et ouvertes
  const { data } = await db.from("opportunities").select(OPP_COLUMNS).in("id", send.opportunity_ids).eq("status", "PUBLISHED").eq("visibility", "PUBLIC").eq("is_demo", false);
  const valid = cleanPool(((data ?? []) as unknown as OppRow[]).map(toOpp), now);
  const items = send.opportunity_ids.map((id) => valid.find((o) => o.id === id)).filter((o): o is VeilleOpportunity => Boolean(o));
  const labels = await loadLabels(db);
  const firstName = member.full_name?.trim().split(/\s+/)[0] || null;
  return { items, email: renderVeilleEmail({ kind, base: siteUrl(), token: send.token, firstName, items, basis: criteriaFor(member).basis, frequency: member.frequency, ...labels }) };
}


export type QueueOptions = {
  deadline: number;
  send: (msg: VeilleMessage) => Promise<VeilleSendResult>;
  sleep?: (ms: number) => Promise<void>;
  intervalMs?: number;
  now?: () => Date;
};

/** Envoie les e-mails en attente, un par un, dans la limite quotidienne. Contrôles avant chaque envoi. */
export async function processVeilleQueue(db: DB, settings: VeilleSettings, opts: QueueOptions) {
  const now = opts.now ?? (() => new Date());
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const result = { sent: 0, failed: 0, skipped: 0, bounced: 0, stopped: null as string | null };
  // Envois interrompus (résultat incertain) : jamais renvoyés automatiquement (évite un doublon)
  await db.from("veille_sends").update({ status: "FAILED", error: "Envoi interrompu : résultat incertain, non renvoyé" }).eq("status", "SENDING").lt("created_at", new Date(now().getTime() - 15 * 60_000).toISOString());
  const { count: sentToday } = await db.from("veille_sends").select("id", { count: "exact", head: true }).eq("status", "SENT").gte("sent_at", parisDayStart(parisToday(now())).toISOString());
  let remaining = Math.max(0, settings.daily_cap - (sentToday ?? 0));
  const audience = new Map((await loadAudience(db)).map((m) => [m.user_id, m]));
  // Suivi des inscrits : destinataires et annonces récentes chargés une seule fois, à la demande
  let suivi: { audience: Map<string, SuiviMember>; pool: VeilleOpportunity[] } | null = null;
  const suiviData = async () => (suivi ??= { audience: new Map((await loadSuiviAudience(db)).map((m) => [m.user_id, m])), pool: await loadPool(db, 30, now()) });
  const touched = new Set<string>();
  while (Date.now() < opts.deadline) {
    if (remaining <= 0) {
      result.stopped = "Plafond quotidien atteint";
      break;
    }
    const { data: next } = await db
      .from("veille_sends")
      .select("id, campaign_id, user_id, email, token, opportunity_ids, attempts, step, news_key, created_at, campaign:veille_campaigns!inner(kind, status)")
      .eq("status", "PENDING")
      .eq("campaign.status", "SENDING")
      .order("created_at")
      .limit(1);
    const s = next?.[0];
    if (!s) break;
    const { data: claimed } = await db.from("veille_sends").update({ status: "SENDING", attempts: s.attempts + 1 }).eq("id", s.id).eq("status", "PENDING").select("id");
    if (!claimed?.length) continue;
    touched.add(s.campaign_id);
    const kind = (s.campaign as unknown as { kind: VeilleKind | "SUIVI" }).kind;
    if (kind === "SUIVI") {
      const { audience: people, pool } = await suiviData();
      const m = people.get(s.user_id);
      const back = s.step === "RETOUR" && m?.last_seen_at && new Date(m.last_seen_at) > new Date(s.created_at);
      if (!m || m.email !== s.email.toLowerCase() || back) {
        await db.from("veille_sends").update({ status: "SKIPPED", error: back ? "Revenu sur le site depuis la préparation" : "Destinataire plus éligible (désinscription ou compte modifié)" }).eq("id", s.id);
        result.skipped++;
        continue;
      }
      const email = await renderSuiviForSend(db, s, m, pool, now());
      if (!email) {
        await db.from("veille_sends").update({ status: "SKIPPED", error: "Annonces expirées ou retirées depuis la préparation" }).eq("id", s.id);
        result.skipped++;
        continue;
      }
      const r = await opts.send({ to: s.email, subject: email.subject, html: email.html, text: email.text, token: s.token });
      const stop = await recordResult(db, s, r, email.subject, email.itemIds, result);
      if (r.status === "SENT") remaining--;
      if (stop) {
        result.stopped = stop;
        break;
      }
      await sleep(opts.intervalMs ?? 2000);
      continue;
    }
    const member = audience.get(s.user_id);
    // Désinscrit, compte désactivé ou adresse modifiée depuis la préparation : pas d'envoi
    if (!member || member.email !== s.email.toLowerCase() || (kind !== "LAUNCH" && !eligibleFor(kind, member))) {
      await db.from("veille_sends").update({ status: "SKIPPED", error: "Destinataire plus éligible (désinscription ou préférences modifiées)" }).eq("id", s.id);
      result.skipped++;
      continue;
    }
    const { items, email } = await renderForSend(db, s, kind, member, now());
    if (items.length < (kind === "DAILY" ? MIN_DAILY_ITEMS : MIN_NEWSLETTER_ITEMS)) {
      await db.from("veille_sends").update({ status: "SKIPPED", error: "Annonces expirées ou retirées depuis la préparation" }).eq("id", s.id);
      result.skipped++;
      continue;
    }
    const r = await opts.send({ to: s.email, subject: email.subject, html: email.html, text: email.text, token: s.token });
    if (r.status === "SENT") {
      await db.from("veille_sends").update({ status: "SENT", subject: email.subject, opportunity_ids: items.map((o) => o.id), sent_at: new Date().toISOString(), error: null }).eq("id", s.id);
      result.sent++;
      remaining--;
    } else if (r.status === "SKIPPED") {
      // Aucun service d'envoi : on remet en file et on s'arrête (rien n'est déclaré envoyé)
      await db.from("veille_sends").update({ status: "PENDING", attempts: s.attempts, error: r.error ?? null }).eq("id", s.id);
      result.stopped = r.error ?? "Aucun service d'envoi configuré";
      break;
    } else if (r.permanent) {
      await db.from("veille_sends").update({ status: "BOUNCED", error: r.error ?? null }).eq("id", s.id);
      await db.from("veille_suppressions").upsert({ email: s.email.toLowerCase(), reason: "BOUNCE" }, { onConflict: "email", ignoreDuplicates: true });
      result.bounced++;
    } else {
      const retry = r.retryable && s.attempts + 1 < 3;
      await db.from("veille_sends").update({ status: retry ? "PENDING" : "FAILED", error: r.error ?? null }).eq("id", s.id);
      result.failed++;
      if (/authentification/i.test(r.error ?? "")) {
        result.stopped = r.error ?? "Erreur d'authentification";
        break;
      }
    }
    await sleep(opts.intervalMs ?? 2000);
  }
  for (const id of touched) await refreshCampaign(db, id);
  return result;
}

/** Enregistre le résultat d'un envoi de suivi ; renvoie un motif d'arrêt de la file le cas échéant. */
async function recordResult(db: DB, s: { id: string; email: string; attempts: number }, r: VeilleSendResult, subject: string, itemIds: string[], result: { sent: number; failed: number; bounced: number }): Promise<string | null> {
  if (r.status === "SENT") {
    await db.from("veille_sends").update({ status: "SENT", subject, opportunity_ids: itemIds, sent_at: new Date().toISOString(), error: null }).eq("id", s.id);
    result.sent++;
    return null;
  }
  if (r.status === "SKIPPED") {
    await db.from("veille_sends").update({ status: "PENDING", attempts: s.attempts, error: r.error ?? null }).eq("id", s.id);
    return r.error ?? "Aucun service d'envoi configuré";
  }
  if (r.permanent) {
    await db.from("veille_sends").update({ status: "BOUNCED", error: r.error ?? null }).eq("id", s.id);
    await db.from("veille_suppressions").upsert({ email: s.email.toLowerCase(), reason: "BOUNCE" }, { onConflict: "email", ignoreDuplicates: true });
    result.bounced++;
    return null;
  }
  const retry = r.retryable && s.attempts + 1 < 3;
  await db.from("veille_sends").update({ status: retry ? "PENDING" : "FAILED", error: r.error ?? null }).eq("id", s.id);
  result.failed++;
  return /authentification/i.test(r.error ?? "") ? (r.error ?? "Erreur d'authentification") : null;
}

/** Rendu d'un e-mail de suivi juste avant l'envoi (annonces revérifiées). null : plus rien à montrer. */
export async function renderSuiviForSend(db: DB, send: { token: string; opportunity_ids: string[]; step: string | null; news_key: string | null }, m: SuiviMember, pool: VeilleOpportunity[], now = new Date()) {
  const { data } = send.opportunity_ids.length ? await db.from("opportunities").select(OPP_COLUMNS).in("id", send.opportunity_ids).eq("status", "PUBLISHED").eq("visibility", "PUBLIC").eq("is_demo", false) : { data: [] };
  const valid = cleanPool(((data ?? []) as unknown as OppRow[]).map(toOpp), now);
  const items = send.opportunity_ids.map((id) => valid.find((o) => o.id === id)).filter((o): o is VeilleOpportunity => Boolean(o));
  const news = SUIVI_NEWS.find((n) => n.key === send.news_key) ?? null;
  const step = (send.step ?? "RETOUR") as SuiviStep;
  if (step === "RETOUR" && !items.length && !news) return null;
  const { criteria, basis } = criteriaFor(m);
  const lastSeen = new Date(m.last_seen_at ?? m.created_at).getTime();
  const newSince = selectOpportunities(pool.filter((o) => o.published_at && new Date(o.published_at).getTime() > lastSeen), criteria, basis, new Set(), 1000).length;
  const email = renderSuiviEmail({ step, base: siteUrl(), token: send.token, member: m, items, news, newSince, now, ...(await loadLabels(db)) });
  return { ...email, itemIds: items.map((o) => o.id) };
}

export async function refreshCampaign(db: DB, id: string) {
  const { data } = await db.from("veille_sends").select("status").eq("campaign_id", id);
  const n = (st: string[]) => (data ?? []).filter((r) => st.includes(r.status)).length;
  const pending = n(["PENDING", "SENDING"]);
  const { data: c } = await db.from("veille_campaigns").select("status").eq("id", id).single();
  await db
    .from("veille_campaigns")
    .update({
      sent: n(["SENT"]),
      failed: n(["FAILED", "BOUNCED"]),
      ...(c?.status === "SENDING" && !pending ? { status: "SENT", completed_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

/** Tâche planifiée : prépare les éditions du jour puis envoie. Ne fait rien tant que l'administrateur n'a pas activé la veille. */
export async function runVeille(db: DB, opts: QueueOptions) {
  const settings = await loadVeilleSettings(db);
  // Invitation unique des inscrits sans accord (indépendante de l'activation des éditions)
  const invitations = settings.invitations_enabled === false ? null : await sendVeilleInvitations(db, { send: opts.send, deadline: opts.deadline - 60_000, sleep: opts.sleep, intervalMs: opts.intervalMs, now: opts.now?.() });
  const suiviOn = (await loadSuiviSettings(db)).enabled;
  if (!settings.enabled && !suiviOn) return { stopped: "Veille et suivi non activés par l'administrateur", invitations, editions: [], suivi: null, send: null };
  const now = opts.now?.() ?? new Date();
  const date = parisToday(now);
  const editions = [];
  if (settings.enabled) {
    const { count } = await db.from("veille_campaigns").select("id", { count: "exact", head: true }).eq("kind", "LAUNCH");
    for (const kind of editionsFor(date, settings, (count ?? 0) > 0)) editions.push({ kind, ...(await buildEdition(db, kind, date, now)) });
  }
  // Suivi des inscrits après la veille (une personne déjà servie aujourd'hui n'est pas relancée), dans la limite du plafond du jour
  let suivi = null;
  if (suiviOn) {
    const { count: queued } = await db.from("veille_sends").select("id", { count: "exact", head: true }).gte("created_at", parisDayStart(date).toISOString());
    suivi = await buildSuivi(db, { now, max: settings.daily_cap - (queued ?? 0), loadPool: (days) => loadPool(db, days, now), alreadySent: (ids) => alreadySent(db, ids) });
  }
  const send = await processVeilleQueue(db, settings, opts);
  return { stopped: send.stopped, invitations, editions, suivi, send };
}

/** Profil de veille d'un utilisateur précis (aperçu, envoi test), même hors des destinataires. */
export async function memberFor(db: DB, userId: string): Promise<AudienceMember | null> {
  const fromAudience = (await loadAudience(db)).find((m) => m.user_id === userId);
  if (fromAudience) return fromAudience;
  const [{ data: u }, { data: p }, { data: m }] = await Promise.all([
    db.from("users").select("id, email, full_name").eq("id", userId).maybeSingle(),
    db.from("veille_preferences").select("frequency, sectors, regions, types, keywords").eq("user_id", userId).maybeSingle(),
    db.from("company_members").select("company:companies(name, region, profile:company_profiles(sectors))").eq("user_id", userId).limit(1).maybeSingle(),
  ]);
  if (!u) return null;
  const c = (Array.isArray(m?.company) ? m?.company[0] : m?.company) as { name: string; region: string | null; profile: { sectors: string[] } | { sectors: string[] }[] | null } | null | undefined;
  const prof = Array.isArray(c?.profile) ? c?.profile[0] : c?.profile;
  return {
    user_id: u.id,
    email: u.email.toLowerCase(),
    full_name: u.full_name,
    frequency: p?.frequency ?? "TWICE_WEEKLY",
    sectors: p?.sectors ?? [],
    regions: p?.regions ?? [],
    types: (p?.types as string[]) ?? [],
    keywords: p?.keywords ?? [],
    company_name: c?.name ?? null,
    company_sectors: prof?.sectors ?? [],
    company_region: c?.region ?? null,
    consent: "apercu",
  };
}

/** Aperçu d'une édition pour un utilisateur (ou générique) : annonces réelles du moment, sans rien enregistrer. */
export async function previewFor(db: DB, kind: VeilleKind, userId: string | null, now = new Date()) {
  const member: AudienceMember = (userId ? await memberFor(db, userId) : null) ?? {
    user_id: "",
    email: "",
    full_name: "",
    frequency: kind === "DAILY" ? "DAILY" : "TWICE_WEEKLY",
    sectors: [],
    regions: [],
    types: [],
    keywords: [],
    company_name: null,
    company_sectors: [],
    company_region: null,
    consent: "apercu",
  };
  const pool = await loadPool(db, POOL_DAYS[kind], now);
  const { criteria, basis } = criteriaFor(member);
  const items = selectOpportunities(pool, criteria, basis, new Set());
  const labels = await loadLabels(db);
  const firstName = member.full_name?.trim().split(/\s+/)[0] || null;
  return { member, items, email: renderVeilleEmail({ kind, base: siteUrl(), token: "apercu", firstName, items, basis, frequency: member.frequency, ...labels }) };
}

/** Indicateurs du tableau de bord : uniquement des événements enregistrés. */
export async function veilleStats(db: DB) {
  const audience = await loadAudience(db);
  const count = async (status: string[]) => (await db.from("veille_sends").select("id", { count: "exact", head: true }).in("status", status)).count ?? 0;
  const countNotNull = async (col: "opened_at" | "clicked_at" | "unsubscribed_at") => (await db.from("veille_sends").select("id", { count: "exact", head: true }).not(col, "is", null)).count ?? 0;
  const [pending, sent, failed, bounced, skipped, opened, clicked, unsub, suppressions, { data: clicks }, { data: campaigns }] = await Promise.all([
    count(["PENDING", "SENDING"]),
    count(["SENT"]),
    count(["FAILED"]),
    count(["BOUNCED"]),
    count(["SKIPPED"]),
    countNotNull("opened_at"),
    countNotNull("clicked_at"),
    countNotNull("unsubscribed_at"),
    db.from("veille_suppressions").select("reason"),
    db.from("veille_events").select("opportunity_id, opportunity:opportunities(title)").eq("type", "CLICK").not("opportunity_id", "is", null).order("created_at", { ascending: false }).limit(1000),
    db.from("veille_campaigns").select("*").order("created_at", { ascending: false }).limit(30),
  ]);
  const top = new Map<string, { title: string; n: number }>();
  for (const c of clicks ?? []) {
    const o = Array.isArray(c.opportunity) ? c.opportunity[0] : c.opportunity;
    if (!c.opportunity_id || !o) continue;
    const t = top.get(c.opportunity_id) ?? { title: o.title, n: 0 };
    t.n++;
    top.set(c.opportunity_id, t);
  }
  return {
    audience,
    eligible: audience.length,
    daily: audience.filter((m) => m.frequency === "DAILY").length,
    twiceWeekly: audience.filter((m) => m.frequency === "TWICE_WEEKLY").length,
    personalized: audience.filter((m) => criteriaFor(m).basis !== null).length,
    pending,
    sent,
    failed,
    bounced,
    skipped,
    opened,
    clicked,
    unsubscribed: unsub,
    suppressions: (suppressions.data ?? []).reduce<Record<string, number>>((a, s) => ({ ...a, [s.reason]: (a[s.reason] ?? 0) + 1 }), {}),
    topOpportunities: [...top.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.n - a.n).slice(0, 10),
    campaigns: campaigns ?? [],
  };
}

/**
 * Invitation unique à activer la veille, pour les inscrits sans accord (une seule fois par compte,
 * jamais après un refus ou une désinscription). Annonces réelles et ouvertes uniquement.
 */
export async function sendVeilleInvitations(db: DB, opts: { send: QueueOptions["send"]; deadline: number; max?: number; sleep?: (ms: number) => Promise<void>; intervalMs?: number; now?: Date }) {
  const result = { candidates: 0, sent: 0, failed: 0, skipped: 0, stopped: null as string | null };
  const { data: candidates, error } = await db.rpc("veille_invitation_candidates");
  if (error) throw error;
  result.candidates = candidates?.length ?? 0;
  if (!candidates?.length) return result;
  const now = opts.now ?? new Date();
  const date = parisToday(now);
  const { data: existing } = await db.from("veille_campaigns").select("id").eq("kind", "INVITE").eq("edition_date", date).maybeSingle();
  const campaignId =
    existing?.id ?? (await db.from("veille_campaigns").insert({ kind: "INVITE", edition_date: date, status: "SENDING", note: "Invitation unique à activer la veille" }).select("id").single()).data?.id;
  if (!campaignId) return { ...result, stopped: "Édition d'invitation non créée" };
  const pool = await loadPool(db, 14, now);
  const labels = await loadLabels(db);
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  for (const c of candidates.slice(0, opts.max ?? 50)) {
    if (Date.now() > opts.deadline) break;
    const basis = c.company_sectors?.length ? "entreprise" : null;
    const items = selectOpportunities(pool, { sectors: c.company_sectors ?? [], regions: c.company_region ? [c.company_region] : [], types: [], keywords: [] }, basis, new Set(), 3);
    const shown = items.length ? items : selectOpportunities(pool, { sectors: [], regions: [], types: [], keywords: [] }, null, new Set(), 3);
    // Ligne d'envoi créée avant l'envoi : l'invitation n'est jamais envoyée deux fois
    const { data: row, error: e } = await db.from("veille_sends").insert({ campaign_id: campaignId, user_id: c.user_id, email: c.email, status: "SENDING", opportunity_ids: shown.map((o) => o.id), personalized: Boolean(items.length && basis), attempts: 1 }).select("id, token").single();
    if (e || !row) {
      result.skipped++;
      continue;
    }
    const firstName = c.full_name?.trim().split(/\s+/)[0] || null;
    const mail = renderVeilleInvitation({ base: siteUrl(), token: row.token, firstName, items: shown, personalized: Boolean(items.length && basis), sectorLabel: labels.sectorLabel });
    const r = await opts.send({ to: c.email, subject: mail.subject, html: mail.html, text: mail.text, token: row.token });
    if (r.status === "SENT") {
      await db.from("veille_sends").update({ status: "SENT", subject: mail.subject, sent_at: new Date().toISOString() }).eq("id", row.id);
      result.sent++;
    } else if (r.status === "SKIPPED") {
      // Aucun service d'envoi : rien n'est marqué envoyé, l'invitation partira au prochain passage
      await db.from("veille_sends").delete().eq("id", row.id);
      result.stopped = r.error ?? "Aucun service d'envoi configuré";
      break;
    } else {
      await db.from("veille_sends").update({ status: r.permanent ? "BOUNCED" : "FAILED", error: r.error ?? null }).eq("id", row.id);
      if (r.permanent) await db.from("veille_suppressions").upsert({ email: c.email, reason: "BOUNCE" }, { onConflict: "email", ignoreDuplicates: true });
      result.failed++;
    }
    await sleep(opts.intervalMs ?? 2000);
  }
  const { count: left } = await db.from("veille_sends").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).in("status", ["PENDING", "SENDING"]);
  await db.from("veille_campaigns").update({ status: left ? "SENDING" : "SENT", completed_at: left ? null : new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", campaignId);
  await refreshCampaign(db, campaignId);
  return result;
}

/** Aperçu d'un e-mail de suivi pour un utilisateur (ou un compte type), sans rien enregistrer. */
export async function suiviPreviewFor(db: DB, step: SuiviStep, userId: string | null, now = new Date()) {
  const base = userId ? await memberFor(db, userId) : null;
  const { data: u } = userId ? await db.from("users").select("created_at, last_seen_at").eq("id", userId).maybeSingle() : { data: null };
  const m: SuiviMember = {
    ...(base ?? { user_id: "apercu", email: "", full_name: "", frequency: "TWICE_WEEKLY", sectors: [], regions: [], types: [], keywords: [], company_name: null, company_sectors: [], company_region: null, consent: "apercu" }),
    created_at: u?.created_at ?? new Date(now.getTime() - 10 * 86_400_000).toISOString(),
    last_seen_at: u?.last_seen_at ?? new Date(now.getTime() - 9 * 86_400_000).toISOString(),
    has_company: Boolean(base?.company_name),
    has_logo: false,
    profile_complete: false,
    has_alert: false,
    veille_on: false,
    has_need: false,
  };
  const pool = await loadPool(db, 30, now);
  const { criteria, basis } = criteriaFor(m);
  const items = selectOpportunities(pool, criteria, basis, new Set(), step === "RETOUR" ? 6 : 3);
  const news = SUIVI_NEWS.find((n) => !n.when || n.when(m)) ?? null;
  const lastSeen = new Date(m.last_seen_at!).getTime();
  const newSince = selectOpportunities(pool.filter((o) => o.published_at && new Date(o.published_at).getTime() > lastSeen), criteria, basis, new Set(), 1000).length;
  return { member: m, items, email: renderSuiviEmail({ step, base: siteUrl(), token: "apercu", member: m, items, news: step === "PROFIL" || step === "ALERTE" ? null : news, newSince, now, ...(await loadLabels(db)) }) };
}

/** Chiffres du suivi sur 30 jours, par étape (envois, ouvertures, clics réellement enregistrés). */
export async function suiviStats(db: DB, now = new Date()) {
  const { data } = await db
    .from("veille_sends")
    .select("step, status, opened_at, clicked_at, unsubscribed_at")
    .not("step", "is", null)
    .gte("created_at", new Date(now.getTime() - 30 * 86_400_000).toISOString())
    .limit(20000);
  const by: Record<string, { sent: number; opened: number; clicked: number; unsubscribed: number }> = {};
  for (const r of data ?? []) {
    if (r.status !== "SENT") continue;
    const b = (by[r.step!] ??= { sent: 0, opened: 0, clicked: 0, unsubscribed: 0 });
    b.sent++;
    if (r.opened_at) b.opened++;
    if (r.clicked_at) b.clicked++;
    if (r.unsubscribed_at) b.unsubscribed++;
  }
  return by;
}
