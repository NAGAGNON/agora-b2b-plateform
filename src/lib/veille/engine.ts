import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { siteUrl } from "@/lib/seo";
import { parisDayStart, parisToday } from "@/lib/daily-report";
import { OPPORTUNITY_TYPE_LABELS, SECTOR_LABELS, sectorLabel } from "@/lib/constants";
import { renderVeilleEmail, type VeilleKind } from "@/lib/veille/render";
import { cleanPool, criteriaFor, MIN_DAILY_ITEMS, MIN_NEWSLETTER_ITEMS, selectOpportunities, type AudienceMember, type VeilleOpportunity } from "@/lib/veille/select";
import type { VeilleMessage, VeilleSendResult } from "@/lib/veille/send";

type DB = SupabaseClient<Database>;

export type VeilleSettings = { enabled: boolean; launch_date: string; daily_cap: number; test_sent_at?: string | null; test_sent_to?: string | null };
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
async function alreadySent(db: DB, userIds: string[]) {
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
  const touched = new Set<string>();
  while (Date.now() < opts.deadline) {
    if (remaining <= 0) {
      result.stopped = "Plafond quotidien atteint";
      break;
    }
    const { data: next } = await db
      .from("veille_sends")
      .select("id, campaign_id, user_id, email, token, opportunity_ids, attempts, campaign:veille_campaigns!inner(kind, status)")
      .eq("status", "PENDING")
      .eq("campaign.status", "SENDING")
      .order("created_at")
      .limit(1);
    const s = next?.[0];
    if (!s) break;
    const { data: claimed } = await db.from("veille_sends").update({ status: "SENDING", attempts: s.attempts + 1 }).eq("id", s.id).eq("status", "PENDING").select("id");
    if (!claimed?.length) continue;
    touched.add(s.campaign_id);
    const kind = (s.campaign as unknown as { kind: VeilleKind }).kind;
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
  if (!settings.enabled) return { stopped: "Veille non activée par l'administrateur", editions: [], send: null };
  const now = opts.now?.() ?? new Date();
  const date = parisToday(now);
  const { count } = await db.from("veille_campaigns").select("id", { count: "exact", head: true }).eq("kind", "LAUNCH");
  const editions = [];
  for (const kind of editionsFor(date, settings, (count ?? 0) > 0)) editions.push({ kind, ...(await buildEdition(db, kind, date, now)) });
  const send = await processVeilleQueue(db, settings, opts);
  return { stopped: send.stopped, editions, send };
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
