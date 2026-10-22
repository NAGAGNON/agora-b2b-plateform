/**
 * Mise en relation automatique pour chaque besoin publié par une entreprise inscrite.
 *
 * À la publication (et chaque jour pour les besoins pas encore traités) :
 *  1. analyse du besoin : secteur, compétences, zone, budget, délais, critères, métiers et codes NAF ;
 *  2. entreprises INSCRITES correspondantes (profil réel : secteur, compétences, zone, taille),
 *     score justifié ; les plus pertinentes reçoivent une notification (espace + e-mail selon leurs
 *     préférences), au plus une tous les 2 jours par entreprise, une relance au plus après 5 jours ;
 *  3. campagne de PROSPECTION dédiée (entreprises non inscrites, base Outreach) avec l'action
 *     « Envoyer un message », soumise aux limites, exclusions et à la validation de l'Outreach ;
 *  4. suivi : chiffres réellement enregistrés (vues, clics, e-mails, intérêts, réponses, échanges).
 * Rien n'est inventé : sans donnée, pas de correspondance ; sans adresse, pas d'e-mail.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { analyzeOpportunity } from "@/lib/outreach/matching";
import { budgetLabel, loadReferentials } from "@/lib/outreach/data";
import { buildNeedOutreachCampaign, enrichProspects, processSendQueue } from "@/lib/outreach/pipeline";
import { COMPANY_SIZE_LABELS, OPPORTUNITY_TYPE_LABELS, type CompanySize, type OpportunityType } from "@/lib/constants";
import { logServerError } from "@/lib/errors";

type DB = SupabaseClient<Database>;
const DAY = 86_400_000;

/** Score minimum d'une entreprise inscrite pour être notifiée, nombre maximal de notifications par besoin. */
export const MEMBER_MIN_SCORE = 40;
export const MEMBER_MAX_NOTIFIED = 25;
/** Une entreprise ne reçoit pas plus d'une proposition de besoin tous les 2 jours. */
export const MEMBER_MIN_GAP_DAYS = 2;
/** Relance unique après 5 jours sans réponse. */
export const MEMBER_REMINDER_DAYS = 5;

const NEED_FIELDS =
  "id, title, summary, description, type, origin, status, visibility, is_demo, company_id, sector_slug, skills, keywords, services, constraints, criteria, city, department_code, region, budget_min, budget_max, budget_visible, start_date, response_deadline, target_company_size, max_suppliers, published_at, company:companies(name)";

export type NeedRow = {
  id: string;
  title: string;
  summary: string | null;
  description: string;
  type: string;
  origin: string;
  status: string;
  visibility: string;
  is_demo: boolean;
  company_id: string | null;
  sector_slug: string | null;
  skills: string[];
  keywords: string[];
  services: string | null;
  constraints: string | null;
  criteria: string | null;
  city: string | null;
  department_code: string | null;
  region: string | null;
  budget_min: number | null;
  budget_max: number | null;
  budget_visible: boolean;
  start_date: string | null;
  response_deadline: string | null;
  target_company_size: string | null;
  max_suppliers: number | null;
  published_at: string | null;
  company: { name: string } | { name: string }[] | null;
};

export type NeedAnalysis = {
  type: string;
  sector: string | null;
  sector_label: string | null;
  skills: string[];
  keywords: string[];
  services: string | null;
  zone: { city: string | null; department: string | null; department_name: string | null; region: string | null };
  budget: string | null;
  start_date: string | null;
  deadline: string | null;
  criteria: string | null;
  constraints: string | null;
  target_size: string | null;
  max_suppliers: number | null;
  profiles: string[];
  naf: string[];
};

/** Analyse structurée d'un besoin, uniquement à partir des champs renseignés. */
export function analyzeNeed(o: NeedRow, ref: Awaited<ReturnType<typeof loadReferentials>>): NeedAnalysis {
  const a = analyzeOpportunity({ ...o, description: o.description ?? "" });
  const dep = ref.department(o.department_code);
  return {
    type: OPPORTUNITY_TYPE_LABELS[o.type as OpportunityType] ?? o.type,
    sector: o.sector_slug,
    sector_label: ref.sectorLabel(o.sector_slug),
    skills: o.skills ?? [],
    keywords: a.keywords,
    services: o.services,
    zone: { city: o.city, department: o.department_code, department_name: dep?.name ?? null, region: o.region ?? dep?.region ?? null },
    budget: o.budget_visible ? budgetLabel(o.budget_min, o.budget_max) : null,
    start_date: o.start_date,
    deadline: o.response_deadline,
    criteria: o.criteria,
    constraints: o.constraints,
    target_size: o.target_company_size ? (COMPANY_SIZE_LABELS[o.target_company_size as CompanySize] ?? o.target_company_size) : null,
    max_suppliers: o.max_suppliers,
    profiles: a.profiles,
    naf: [...new Set([...a.primaryNaf, ...a.sectorNaf])],
  };
}

/** Besoin publié par une entreprise inscrite, public, réel et encore ouvert. */
export function isOpenNeed(o: Pick<NeedRow, "origin" | "status" | "visibility" | "is_demo" | "response_deadline">, now = Date.now()) {
  return o.origin === "INTERNAL" && o.status === "PUBLISHED" && o.visibility === "PUBLIC" && !o.is_demo && (!o.response_deadline || new Date(o.response_deadline).getTime() > now);
}

/** Entreprises inscrites correspondantes : enregistrement, puis notification des plus pertinentes. */
async function matchMembers(db: DB, need: NeedRow, campaignId: string, now: Date) {
  const { data: found, error } = await db.rpc("need_member_candidates", { p_opportunity_id: need.id, p_limit: 100 });
  if (error) throw error;
  const candidates = found ?? [];
  const relevant = candidates.filter((c) => c.score >= MEMBER_MIN_SCORE);
  if (candidates.length) {
    await db.from("need_matches").upsert(
      candidates.map((c) => ({ need_campaign_id: campaignId, opportunity_id: need.id, company_id: c.company_id, score: c.score, reasons: c.reasons ?? [] })),
      { onConflict: "opportunity_id,company_id", ignoreDuplicates: true },
    );
  }
  // Déjà notifiées pour ce besoin : jamais deux fois
  const { data: known } = await db.from("need_matches").select("company_id, status").eq("opportunity_id", need.id);
  const done = new Set((known ?? []).filter((k) => k.status !== "IDENTIFIED").map((k) => k.company_id));
  const ids = relevant.map((c) => c.company_id).filter((id) => !done.has(id));
  // Fréquence : une entreprise ne reçoit pas plus d'un besoin tous les 2 jours (tous besoins confondus)
  const { data: recent } = ids.length
    ? await db.from("need_matches").select("company_id").in("company_id", ids).gte("notified_at", new Date(now.getTime() - MEMBER_MIN_GAP_DAYS * DAY).toISOString())
    : { data: [] };
  const busy = new Set((recent ?? []).map((r) => r.company_id));
  const alreadyNotified = (known ?? []).filter((k) => ["NOTIFIED", "REMINDED", "RESPONDED"].includes(k.status)).length;
  let notified = 0;
  const buyer = (Array.isArray(need.company) ? need.company[0] : need.company)?.name ?? "Une entreprise";
  for (const c of relevant) {
    if (done.has(c.company_id)) continue;
    if (alreadyNotified + notified >= MEMBER_MAX_NOTIFIED) break;
    if (busy.has(c.company_id)) {
      await db.from("need_matches").update({ status: "SKIPPED", skip_reason: "Autre besoin proposé il y a moins de 2 jours" }).eq("opportunity_id", need.id).eq("company_id", c.company_id).eq("status", "IDENTIFIED");
      continue;
    }
    const why = (c.reasons ?? []).slice(0, 2).join(", ").toLowerCase();
    const { error: e } = await db.rpc("notify_company", {
      p_company_id: c.company_id,
      p_type: "need_match",
      p_title: `Un besoin correspond à votre activité : ${need.title}`.slice(0, 180),
      p_body: `${buyer} a publié ce besoin sur LinkProB2B${why ? ` (${why})` : ""}. Consultez-le et envoyez un message à l'entreprise si vous pouvez y répondre.`,
      p_link: `/opportunites/${need.id}?message=1`,
    });
    if (e) {
      logServerError("need notify", e);
      continue;
    }
    await db.from("need_matches").update({ status: "NOTIFIED", notified_at: now.toISOString() }).eq("opportunity_id", need.id).eq("company_id", c.company_id);
    notified++;
  }
  return { identified: candidates.length, relevant: relevant.length, notified };
}

/** Relance unique, 5 jours après la notification, des entreprises inscrites qui n'ont pas répondu. */
export async function remindMembers(db: DB, now = new Date()) {
  const { data: due } = await db
    .from("need_matches")
    .select("id, company_id, opportunity_id, opportunity:opportunities(id, title, origin, status, visibility, is_demo, response_deadline)")
    .eq("status", "NOTIFIED")
    .lte("notified_at", new Date(now.getTime() - MEMBER_REMINDER_DAYS * DAY).toISOString())
    .limit(100);
  let reminded = 0;
  for (const m of due ?? []) {
    const o = (Array.isArray(m.opportunity) ? m.opportunity[0] : m.opportunity) as Pick<NeedRow, "id" | "title" | "origin" | "status" | "visibility" | "is_demo" | "response_deadline"> | null;
    const responded = await hasResponded(db, m.opportunity_id, m.company_id);
    // Échéance dans moins de 2 jours ou besoin fermé : pas de relance
    const open = o && isOpenNeed(o, now.getTime() + 2 * DAY);
    if (responded || !open) {
      await db.from("need_matches").update({ status: responded ? "RESPONDED" : "SKIPPED", skip_reason: responded ? null : "Besoin fermé ou échéance trop proche" }).eq("id", m.id);
      continue;
    }
    await db.rpc("notify_company", {
      p_company_id: m.company_id,
      p_type: "need_match",
      p_title: `Rappel : ${o.title}`.slice(0, 180),
      p_body: "Ce besoin correspond toujours à votre activité et attend des réponses. Un message suffit pour entrer en contact avec l'entreprise.",
      p_link: `/opportunites/${o.id}?message=1`,
    });
    await db.from("need_matches").update({ status: "REMINDED", reminded_at: now.toISOString() }).eq("id", m.id);
    reminded++;
  }
  return { reminded };
}

async function hasResponded(db: DB, opportunityId: string, companyId: string) {
  const [i, p] = await Promise.all([
    db.from("interests").select("id", { count: "exact", head: true }).eq("opportunity_id", opportunityId).eq("company_id", companyId).neq("status", "WITHDRAWN"),
    db.from("proposals").select("id", { count: "exact", head: true }).eq("opportunity_id", opportunityId).eq("company_id", companyId),
  ]);
  return (i.count ?? 0) + (p.count ?? 0) > 0;
}

export type NeedRunResult = { opportunityId: string; status: string; members?: { identified: number; relevant: number; notified: number }; prospects?: { campaignId: string | null; identified: number; relevant: number; skipped?: string }; note?: string };

/**
 * Traite un besoin : analyse, entreprises inscrites, campagne de prospection dédiée.
 * Idempotent : relancé, il complète sans renvoyer les notifications ni recréer la campagne.
 */
export async function runNeedCampaign(db: DB, opportunityId: string, { now = new Date(), deadline = Date.now() + 120_000, prospects = true }: { now?: Date; deadline?: number; prospects?: boolean } = {}): Promise<NeedRunResult> {
  const { data } = await db.from("opportunities").select(NEED_FIELDS).eq("id", opportunityId).maybeSingle();
  const need = data as unknown as NeedRow | null;
  if (!need || need.origin !== "INTERNAL") return { opportunityId, status: "SKIPPED", note: "Pas un besoin d'entreprise inscrite" };
  const ref = await loadReferentials(db);
  const analysis = analyzeNeed(need, ref);
  const { data: existing } = await db.from("need_campaigns").select("id, runs, outreach_campaign_id").eq("opportunity_id", opportunityId).maybeSingle();
  if (!isOpenNeed(need, now.getTime())) {
    if (existing) await db.from("need_campaigns").update({ status: "CLOSED", updated_at: now.toISOString() }).eq("id", existing.id);
    return { opportunityId, status: "CLOSED", note: "Besoin non publié, privé, de démonstration ou fermé" };
  }
  const { data: nc, error } = await db
    .from("need_campaigns")
    .upsert({ opportunity_id: opportunityId, analysis: analysis as never, status: "RUNNING", runs: (existing?.runs ?? 0) + 1, last_run_at: now.toISOString(), updated_at: now.toISOString(), error: null }, { onConflict: "opportunity_id" })
    .select("id")
    .single();
  if (error) throw error;
  try {
    const members = await matchMembers(db, need, nc.id, now);
    let outreach: NeedRunResult["prospects"];
    if (prospects && Date.now() < deadline - 20_000) {
      const r = await buildNeedOutreachCampaign(db, opportunityId, { deadline: deadline - 15_000 });
      outreach = { campaignId: r.campaignId, identified: r.identified ?? 0, relevant: r.relevant ?? 0, skipped: r.skipped };
      // Adresses manquantes recherchées, puis premiers envois si la campagne est validée (limites de l'Outreach)
      if (r.campaignId && !r.skipped && Date.now() < deadline - 40_000) {
        await enrichProspects(db, { campaignId: r.campaignId, deadline: Math.min(deadline - 30_000, Date.now() + 60_000) }).catch((e) => logServerError("need enrich", e));
      }
      if (r.campaignId && Date.now() < deadline - 30_000) await processSendQueue(db, { deadline: deadline - 10_000 }).catch((e) => logServerError("need send", e));
    }
    const { data: prev } = await db.from("need_campaigns").select("prospects_identified, prospects_relevant, outreach_campaign_id, members_notified").eq("id", nc.id).single();
    await db
      .from("need_campaigns")
      .update({
        members_identified: members.identified,
        members_relevant: members.relevant,
        members_notified: (prev?.members_notified ?? 0) + members.notified,
        ...(outreach && !outreach.skipped ? { prospects_identified: outreach.identified, prospects_relevant: outreach.relevant } : {}),
        outreach_campaign_id: outreach?.campaignId ?? prev?.outreach_campaign_id ?? null,
        note: [
          `${members.identified} entreprise(s) inscrite(s) identifiée(s), ${members.relevant} pertinente(s), ${members.notified} notifiée(s) ce passage.`,
          outreach ? (outreach.skipped ? `Prospection : ${outreach.skipped}.` : `Prospection : ${outreach.identified} entreprise(s) analysée(s), ${outreach.relevant} retenue(s).`) : null,
        ]
          .filter(Boolean)
          .join(" "),
        updated_at: new Date().toISOString(),
      })
      .eq("id", nc.id);
    return { opportunityId, status: "RUNNING", members, prospects: outreach };
  } catch (e) {
    logServerError("need campaign", e);
    await db.from("need_campaigns").update({ status: "FAILED", error: e instanceof Error ? e.message.slice(0, 500) : String(e), updated_at: new Date().toISOString() }).eq("id", nc.id);
    return { opportunityId, status: "FAILED", note: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Passage quotidien : besoins ouverts jamais traités (nouvelles publications manquées, besoins
 * antérieurs), besoins en échec, besoins à compléter (nouvelles entreprises inscrites), relances,
 * puis clôture des besoins fermés.
 */
export async function processNeedCampaigns(db: DB, { deadline = Date.now() + 120_000, now = new Date() }: { deadline?: number; now?: Date } = {}) {
  const { data: open } = await db
    .from("opportunities")
    .select("id, response_deadline, published_at")
    .eq("origin", "INTERNAL")
    .eq("status", "PUBLISHED")
    .eq("visibility", "PUBLIC")
    .eq("is_demo", false)
    .or(`response_deadline.is.null,response_deadline.gt.${now.toISOString()}`)
    .order("published_at", { ascending: false })
    .limit(200);
  const ids = (open ?? []).map((o) => o.id);
  const { data: campaigns } = ids.length ? await db.from("need_campaigns").select("opportunity_id, status, last_run_at").in("opportunity_id", ids) : { data: [] };
  const byId = new Map((campaigns ?? []).map((c) => [c.opportunity_id, c]));
  // Jamais traités d'abord, puis échecs, puis mise à jour quotidienne (nouvelles entreprises inscrites)
  const todo = [
    ...ids.filter((id) => !byId.has(id)),
    ...ids.filter((id) => byId.get(id)?.status === "FAILED"),
    ...ids.filter((id) => {
      const c = byId.get(id);
      return c?.status === "RUNNING" && (!c.last_run_at || now.getTime() - new Date(c.last_run_at).getTime() > 0.9 * DAY);
    }),
  ];
  const results: NeedRunResult[] = [];
  for (const id of todo) {
    if (Date.now() > deadline - 30_000) break;
    // Prospection seulement au premier passage (une campagne par besoin) ; la mise à jour quotidienne complète les entreprises inscrites
    results.push(await runNeedCampaign(db, id, { now, deadline: Math.min(deadline, Date.now() + 100_000), prospects: !byId.has(id) || byId.get(id)?.status === "FAILED" }));
  }
  const reminders = Date.now() < deadline - 10_000 ? await remindMembers(db, now) : { reminded: 0 };
  // Besoins fermés depuis le dernier passage
  const { data: running } = await db.from("need_campaigns").select("id, opportunity_id").eq("status", "RUNNING");
  const closed = (running ?? []).filter((c) => !ids.includes(c.opportunity_id)).map((c) => c.id);
  if (closed.length) await db.from("need_campaigns").update({ status: "CLOSED", updated_at: now.toISOString() }).in("id", closed);
  return { processed: results.length, results, reminded: reminders.reminded, closed: closed.length };
}

export type NeedMetrics = {
  views: number;
  messageClicks: number;
  shareClicks: number;
  membersIdentified: number;
  membersRelevant: number;
  membersNotified: number;
  membersReminded: number;
  prospectsIdentified: number;
  prospectsRelevant: number;
  emailsPrepared: number;
  emailsWaitingAddress: number;
  emailsSent: number;
  emailsSimulated: number;
  emailsOpened: number;
  emailsClicked: number;
  interests: number;
  proposals: number;
  conversations: number;
  selected: number;
  outcome: string | null;
};

/** Indicateurs d'un besoin, tous issus d'événements réellement enregistrés. */
export async function needMetrics(db: DB, opportunityId: string): Promise<NeedMetrics> {
  const count = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
  const { data: nc } = await db.from("need_campaigns").select("members_identified, members_relevant, prospects_identified, prospects_relevant, outreach_campaign_id").eq("opportunity_id", opportunityId).maybeSingle();
  const { data: o } = await db.from("opportunities").select("outcome").eq("id", opportunityId).maybeSingle();
  const camp = nc?.outreach_campaign_id ?? null;
  const rec = (status: string[]) => (camp ? count(db.from("outreach_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", camp).in("status", status)) : Promise.resolve(0));
  const [views, messageClicks, shareClicks, notified, reminded, prepared, waiting, sent, simulated, opened, clicked, interests, proposals, conversations, selected] = await Promise.all([
    count(db.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_name", "view_opportunity").eq("properties->>opportunity_id", opportunityId)),
    count(db.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_name", "need_message_click").eq("properties->>opportunity_id", opportunityId)),
    count(db.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_name", "need_share_click").eq("properties->>opportunity_id", opportunityId)),
    count(db.from("need_matches").select("id", { count: "exact", head: true }).eq("opportunity_id", opportunityId).not("notified_at", "is", null)),
    count(db.from("need_matches").select("id", { count: "exact", head: true }).eq("opportunity_id", opportunityId).not("reminded_at", "is", null)),
    rec(["PENDING", "QUEUED", "SENDING"]),
    rec(["NO_EMAIL"]),
    rec(["SENT"]),
    rec(["SIMULATED"]),
    camp ? count(db.from("outreach_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", camp).not("opened_at", "is", null)) : Promise.resolve(0),
    camp ? count(db.from("outreach_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", camp).not("clicked_at", "is", null)) : Promise.resolve(0),
    count(db.from("interests").select("id", { count: "exact", head: true }).eq("opportunity_id", opportunityId).neq("status", "WITHDRAWN")),
    count(db.from("proposals").select("id", { count: "exact", head: true }).eq("opportunity_id", opportunityId).neq("status", "WITHDRAWN")),
    count(db.from("conversations").select("id", { count: "exact", head: true }).eq("opportunity_id", opportunityId)),
    count(db.from("proposals").select("id", { count: "exact", head: true }).eq("opportunity_id", opportunityId).eq("status", "SELECTED")),
  ]);
  return {
    views,
    messageClicks,
    shareClicks,
    membersIdentified: nc?.members_identified ?? 0,
    membersRelevant: nc?.members_relevant ?? 0,
    membersNotified: notified,
    membersReminded: reminded,
    prospectsIdentified: nc?.prospects_identified ?? 0,
    prospectsRelevant: nc?.prospects_relevant ?? 0,
    emailsPrepared: prepared,
    emailsWaitingAddress: waiting,
    emailsSent: sent,
    emailsSimulated: simulated,
    emailsOpened: opened,
    emailsClicked: clicked,
    interests,
    proposals,
    conversations,
    selected,
    outcome: o?.outcome ?? null,
  };
}

/** Besoin qui manque de visibilité ou de réponses (signal pour l'administration). */
export function needAlert(m: NeedMetrics, publishedAt: string | null, now = Date.now()): string | null {
  const age = publishedAt ? (now - new Date(publishedAt).getTime()) / DAY : 0;
  if (m.interests + m.proposals + m.conversations > 0) return null;
  if (m.membersNotified === 0 && m.emailsSent === 0 && age >= 1) return "Aucune entreprise contactée";
  if (age >= 3 && m.views < 10) return "Peu de vues";
  if (age >= 5) return "Aucune réponse";
  return null;
}
