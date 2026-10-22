import "server-only";
import { logServerError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { analyzeOpportunity, contentFingerprint, groupByProspect, scoreMatch, type OpportunityAnalysis, type ProspectInput } from "@/lib/outreach/matching";
import { DISCOVERY_SOURCE, companyAltNames, discoverCompanies } from "@/lib/outreach/discovery";
import { buildEmail, loadRecipientBundles, loadReferentials, loadSettings, loadSuppressions, realSendBlockers, selectAll, type Db, type OutreachSettings } from "@/lib/outreach/data";
import { sendOutreachEmail } from "@/lib/outreach/send";
import { configuredSearchers, enrichCompany } from "@/lib/outreach/enrich";
import { decideRamp, RAMP_INTERVAL_DAYS } from "@/lib/outreach/ramp";
import { refreshPublicAwards } from "@/lib/outreach/public-awards";
import { parisDayStart, parisToday } from "@/lib/daily-report";
import { currentStrategy } from "@/lib/growth/engine";

/**
 * Chaîne quotidienne de LinkProB2B Outreach :
 *  1. synchroniser les opportunités LinkProB2B (nouvelles / modifiées / expirées) ;
 *  2. ne retenir que les nouvelles, ouvertes et dont l'échéance laisse le temps de répondre ;
 *  3. analyser chaque besoin (métiers et codes NAF concernés) ;
 *  4. découvrir des entreprises (source publique SIRENE) ;
 *  5. calculer les scores, éliminer les correspondances faibles ;
 *  6. regrouper par entreprise (UN e-mail par entreprise) ;
 *  7. préparer la campagne (prévisualisation) puis, si elle est validée, envoyer
 *     dans la limite quotidienne — en simulation tant que l'envoi réel n'est pas autorisé.
 */

const ENRICH_COMPANY_TIMEOUT_MS = 30_000;
const DAY = 86_400_000;
const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
/** Jour calendaire de Paris (date de campagne, limites quotidiennes). */
const today = () => parisToday();
/** Minuit (heure de Paris) du jour en cours, en instant UTC. */
const startOfParisDay = () => parisDayStart(parisToday()).toISOString();
/** Marge avant la fin du budget (la tâche dispose d'environ 30 s de plus) : un envoi SMTP peut durer jusqu'à une minute. */
const SEND_SAFETY_MS = 40_000;

const OPP_FIELDS = "id, title, summary, description, sector_slug, skills, keywords, city, department_code, region, response_deadline, status, visibility, is_demo, published_at";

/** 1. États des opportunités vues par l'outil. */
export async function syncOpportunityStates(db: Db, settings: OutreachSettings) {
  const since = new Date(Date.now() - settings.lookback_days * DAY).toISOString();
  const minDeadline = Date.now() + settings.min_days_before_deadline * DAY;
  const result = { scanned: 0, new: 0, modified: 0, expired: 0 };
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("opportunities")
      .select("id, title, description, response_deadline, department_code, sector_slug, status")
      .eq("status", "PUBLISHED")
      .eq("visibility", "PUBLIC")
      .eq("is_demo", false)
      .gte("published_at", since)
      .order("published_at", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    const rows = data ?? [];
    result.scanned += rows.length;
    for (const part of chunk(rows, 300)) {
      const { data: states, error: e2 } = await db.from("outreach_opportunity_states").select("opportunity_id, status, content_hash").in("opportunity_id", part.map((o) => o.id));
      if (e2) throw e2;
      const known = new Map((states ?? []).map((s) => [s.opportunity_id, s]));
      const inserts = [];
      for (const o of part) {
        const hash = contentFingerprint(o);
        const tooLate = o.response_deadline !== null && new Date(o.response_deadline).getTime() < minDeadline;
        const s = known.get(o.id);
        if (!s) {
          inserts.push({ opportunity_id: o.id, content_hash: hash, status: tooLate ? "EXPIRED" : "NEW" });
          if (tooLate) result.expired++;
          else result.new++;
        } else if (s.content_hash !== hash && s.status === "PROCESSED") {
          await db.from("outreach_opportunity_states").update({ status: "MODIFIED", content_hash: hash, updated_at: new Date().toISOString() }).eq("opportunity_id", o.id);
          result.modified++;
        } else if (s.content_hash !== hash) {
          await db.from("outreach_opportunity_states").update({ content_hash: hash, updated_at: new Date().toISOString() }).eq("opportunity_id", o.id);
        }
      }
      if (inserts.length) {
        const { error: e3 } = await db.from("outreach_opportunity_states").upsert(inserts, { onConflict: "opportunity_id", ignoreDuplicates: true });
        if (e3) throw e3;
      }
    }
    if (rows.length < 1000) break;
  }
  // Expiration : une opportunité fermée, retirée ou dont l'échéance est trop proche n'est plus jamais proposée.
  const open = await selectAll((from, to) =>
    db
      .from("outreach_opportunity_states")
      .select("opportunity_id, opportunity:opportunities(status, response_deadline)")
      .in("status", ["NEW", "MODIFIED", "PROCESSED"])
      .order("opportunity_id")
      .range(from, to),
  );
  const expire = open
    .filter((s) => {
      const o = s.opportunity as unknown as { status: string; response_deadline: string | null } | null;
      return !o || o.status !== "PUBLISHED" || (o.response_deadline !== null && new Date(o.response_deadline).getTime() < Date.now());
    })
    .map((s) => s.opportunity_id);
  for (const ids of chunk(expire, 300)) {
    await db.from("outreach_opportunity_states").update({ status: "EXPIRED", updated_at: new Date().toISOString() }).in("opportunity_id", ids);
  }
  result.expired += expire.length;
  return result;
}

/** 4. Découverte d'entreprises (API publique), limitée et mise en cache 30 jours par couple NAF × département. */
export async function discoverProspects(db: Db, analyses: OpportunityAnalysis[], deadline: number, maxCalls = 60) {
  const pairs: [string, string][] = [];
  for (const a of analyses) {
    if (!a.department) continue;
    for (const naf of [...a.primaryNaf.slice(0, 2), ...a.sectorNaf.slice(0, 1)]) {
      if (!pairs.some(([n, d]) => n === naf && d === a.department)) pairs.push([naf, a.department]);
    }
  }
  if (pairs.length === 0) return { calls: 0, added: 0, errors: 0 };
  const since = new Date(Date.now() - 30 * DAY).toISOString();
  const runs = await selectAll((from, to) =>
    db.from("outreach_discovery_runs").select("naf_code, department_code, ran_at, error").gte("ran_at", since).order("naf_code").order("department_code").range(from, to),
  );
  const fresh = new Set(runs.filter((r) => !r.error).map((r) => `${r.naf_code}|${r.department_code}`));
  const ref = await loadReferentials(db);
  const result = { calls: 0, added: 0, errors: 0 };
  for (const [naf, dept] of pairs.filter(([n, d]) => !fresh.has(`${n}|${d}`))) {
    if (result.calls >= maxCalls || Date.now() > deadline) break;
    result.calls++;
    try {
      const { companies } = await discoverCompanies(naf, dept);
      const rows = companies.map((c) => ({
        name: c.name,
        siren: c.siren,
        siret: c.siret,
        naf_code: c.naf_code,
        city: c.city,
        postal_code: c.postal_code,
        department_code: c.department_code,
        region: ref.department(c.department_code)?.region ?? null,
        size_range: c.size_range,
        is_individual_entrepreneur: c.is_individual_entrepreneur,
        alt_names: c.alt_names,
        alt_names_checked_at: new Date().toISOString(),
        intervention_zone: "REGIONAL",
        source: DISCOVERY_SOURCE,
        source_ref: c.source_ref,
      }));
      if (rows.length) {
        const { data, error } = await db.from("outreach_prospects").upsert(rows, { onConflict: "siren", ignoreDuplicates: true }).select("id");
        if (error) throw error;
        result.added += data?.length ?? 0;
      }
      await db.from("outreach_discovery_runs").upsert({ naf_code: naf, department_code: dept, fetched: rows.length, error: null, ran_at: new Date().toISOString() }, { onConflict: "naf_code,department_code" });
    } catch (e) {
      result.errors++;
      await db
        .from("outreach_discovery_runs")
        .upsert({ naf_code: naf, department_code: dept, fetched: 0, error: e instanceof Error ? e.message.slice(0, 300) : "Erreur", ran_at: new Date().toISOString() }, { onConflict: "naf_code,department_code" });
      if (e instanceof Error && /429/.test(e.message)) break;
    }
    await new Promise((r) => setTimeout(r, 200)); // ≤ 5 requêtes/seconde (limite de l'API : 7)
  }
  return result;
}

const PROSPECT_FIELDS =
  "id, name, email, siren, naf_code, naf_label, sectors, activity, services, keywords, department_code, region, intervention_zone, contacts_count, last_clicked_at, last_contacted_at, is_individual_entrepreneur, status, public_awards_count, size_range";

/**
 * Entreprises candidates pour une opportunité : même activité ET zone compatible. Quand elles
 * sont plus nombreuses que la limite, celles qui remportent le plus de marchés publics passent en premier.
 */
async function candidates(db: Db, a: OpportunityAnalysis, settings: OutreachSettings) {
  const naf = [...new Set([...a.primaryNaf, ...a.sectorNaf])];
  const activity = [naf.length ? `naf_code.in.(${naf.map((n) => `"${n}"`).join(",")})` : null, a.sector ? `sectors.cs.{${a.sector}}` : null].filter(Boolean).join(",");
  if (!activity) return [];
  let q = db.from("outreach_prospects").select(PROSPECT_FIELDS).eq("status", "ACTIVE").or(activity);
  if (!settings.include_individual_entrepreneurs) q = q.eq("is_individual_entrepreneur", false);
  const zone = [
    a.department ? `department_code.eq.${a.department}` : null,
    a.region ? `region.eq."${a.region.replace(/"/g, "")}"` : null,
    "intervention_zone.eq.NATIONAL",
  ].filter(Boolean);
  if (a.department || a.region) q = q.or(zone.join(","));
  const limit = Math.min(settings.max_prospects_per_opportunity, 1000);
  // Entreprises déjà joignables (adresse générique connue) d'abord : sans cela, la limite par
  // opportunité était remplie d'entreprises sans adresse et presque rien ne partait.
  const { data: reachable, error: e1 } = await q.not("email", "is", null).order("public_awards_count", { ascending: false, nullsFirst: false }).order("id").limit(limit);
  if (e1) throw e1;
  const rest = limit - (reachable?.length ?? 0);
  if (rest <= 0) return reachable ?? [];
  let q2 = db.from("outreach_prospects").select(PROSPECT_FIELDS).eq("status", "ACTIVE").or(activity).is("email", null);
  if (!settings.include_individual_entrepreneurs) q2 = q2.eq("is_individual_entrepreneur", false);
  if (a.department || a.region) q2 = q2.or(zone.join(","));
  const { data, error } = await q2.order("public_awards_count", { ascending: false, nullsFirst: false }).order("id").limit(rest);
  if (error) throw error;
  return [...(reachable ?? []), ...(data ?? [])];
}

/** Entreprises joignables (adresse générique connue, actives), pour la sélection inversée. */
async function reachablePool(db: Db, settings: OutreachSettings) {
  return selectAll((from, to) => {
    let q = db.from("outreach_prospects").select(PROSPECT_FIELDS).eq("status", "ACTIVE").not("email", "is", null);
    if (!settings.include_individual_entrepreneurs) q = q.eq("is_individual_entrepreneur", false);
    return q.order("id").range(from, to);
  });
}

/** Même filtre que candidates() (activité, zone), appliqué en mémoire à un ensemble d'entreprises. */
function matchesTarget(a: OpportunityAnalysis, p: { naf_code: string | null; sectors: string[] | null; department_code: string | null; region: string | null; intervention_zone: string | null }) {
  const naf = new Set([...a.primaryNaf, ...a.sectorNaf]);
  const activity = (p.naf_code && naf.has(p.naf_code)) || (a.sector && (p.sectors ?? []).includes(a.sector));
  if (!activity) return false;
  if (!a.department && !a.region) return true;
  return p.department_code === a.department || (a.region && p.region === a.region) || p.intervention_zone === "NATIONAL";
}

export type BuildResult = { campaignId: string | null; skipped?: string; stats?: Record<string, number> };

/**
 * 3–9. Construction de la campagne du jour (prévisualisation).
 * `manual` : campagne lancée à la main (Outreach → « Lancer une campagne maintenant »), sans limite
 * de nombre par jour. Elle reprend les opportunités récentes (fenêtre de détection) sans changer leur
 * état : la campagne automatique du jour n'est pas modifiée. Mêmes garde-fous (exclusions, fréquence).
 */
export async function buildDailyCampaign(
  db: Db,
  { date = today(), force = false, deadline = Date.now() + 120_000, manual }: { date?: string; force?: boolean; deadline?: number; manual?: { userId: string | null; reachableOnly?: boolean; lookbackDays?: number } } = {},
): Promise<BuildResult> {
  const settings = await loadSettings(db);
  const { data: existing } = manual ? { data: null } : await db.from("outreach_campaigns").select("id, status, updated_at").eq("campaign_date", date).eq("kind", "AUTO").maybeSingle();
  if (existing) {
    // Préparation en cours depuis moins de 10 minutes : jamais deux préparations en même temps
    const stalled = existing.status === "BUILDING" && Date.now() - new Date(existing.updated_at).getTime() > 10 * 60_000;
    const rebuildable = stalled || existing.status === "FAILED" || (force && existing.status === "READY");
    if (!rebuildable) return { campaignId: existing.id, skipped: existing.status === "READY" ? "Campagne du jour déjà préparée" : "Campagne du jour déjà validée ou envoyée" };
  }
  const base = {
    campaign_date: date,
    status: "BUILDING",
    dry_run: settings.dry_run,
    min_score: settings.min_score,
    subject_template: settings.subject_template,
    intro_template: settings.intro_template,
    error: null,
    updated_at: new Date().toISOString(),
    ...(manual ? { kind: "MANUAL", launched_by: manual.userId } : {}),
  };
  let campaignId = existing?.id ?? null;
  if (campaignId) {
    // Reconstruction : les opportunités de cette campagne redeviennent « nouvelles ».
    await db.from("outreach_opportunity_states").update({ status: "NEW", processed_at: null }).eq("last_campaign_id", campaignId).eq("status", "PROCESSED");
    await db.from("outreach_recipients").delete().eq("campaign_id", campaignId);
    await db.from("outreach_campaigns").update(base).eq("id", campaignId);
  } else {
    const { data, error } = await db.from("outreach_campaigns").insert(base).select("id").single();
    if (error) throw error;
    campaignId = data.id;
  }

  try {
    const ref = await loadReferentials(db);
    const minDeadline = new Date(Date.now() + settings.min_days_before_deadline * DAY).toISOString();
    const { data: states } = manual
      ? await db
          .from("outreach_opportunity_states")
          .select("opportunity_id")
          .in("status", ["NEW", "MODIFIED", "PROCESSED"])
          .gte("first_seen_at", new Date(Date.now() - (manual.lookbackDays ?? settings.lookback_days) * DAY).toISOString())
          .order("first_seen_at")
          .limit(2000)
      : await db.from("outreach_opportunity_states").select("opportunity_id").eq("status", "NEW").order("first_seen_at").limit(2000);
    const ids = (states ?? []).map((s) => s.opportunity_id);
    const opps = [];
    for (const part of chunk(ids, 300)) {
      const { data, error } = await db.from("opportunities").select(OPP_FIELDS).in("id", part).eq("status", "PUBLISHED").or(`response_deadline.is.null,response_deadline.gte.${minDeadline}`);
      if (error) throw error;
      opps.push(...(data ?? []));
    }
    const analyses = opps.map((o) => analyzeOpportunity(o));
    // Sélection inversée : on part des entreprises déjà joignables (pas de découverte, pas de recherche d'adresse)
    const pool = manual?.reachableOnly ? await reachablePool(db, settings) : null;
    const discovery = settings.discovery_enabled && !pool ? await discoverProspects(db, analyses, deadline - 75_000) : { calls: 0, added: 0, errors: 0 };
    // Marchés publics remportés (DECP, source publique comme la découverte) des entreprises concernées, avant le calcul des scores
    const awards = !settings.discovery_enabled || pool ? null : await refreshPublicAwards(db, {
      nafCodes: analyses.flatMap((a) => [...a.primaryNaf, ...a.sectorNaf]),
      deadline: Math.min(Date.now() + 30_000, deadline - 45_000),
    }).catch((e) => (logServerError("outreach DECP", e), null));

    const [supp, customers] = await Promise.all([
      loadSuppressions(db),
      selectAll((from, to) => db.from("companies").select("siren").not("siren", "is", null).order("id").range(from, to)),
    ]);
    const customerSirens = new Set(customers.map((c) => c.siren!));

    const analyzed = new Set<string>();
    const prospects = new Map<string, Awaited<ReturnType<typeof candidates>>[number]>();
    const pairs: { prospectId: string; opportunityId: string; score: number; reasons: string[]; deadline: string | null }[] = [];
    const perOpp = new Map<string, number>();
    // Opportunités réellement analysées avant la limite de temps (les autres restent « nouvelles »)
    const reached = new Set<string>();
    for (const a of analyses) {
      if (Date.now() > deadline) break;
      reached.add(a.id);
      const o = opps.find((x) => x.id === a.id)!;
      const found = pool ? pool.filter((p) => matchesTarget(a, p)).slice(0, Math.min(settings.max_prospects_per_opportunity, 1000)) : await candidates(db, a, settings);
      for (const p of found) {
        analyzed.add(p.id);
        prospects.set(p.id, p);
        const m = scoreMatch(a, p as ProspectInput, (s) => ref.sectorLabel(s) ?? s);
        if (m.score >= settings.min_score) {
          pairs.push({ prospectId: p.id, opportunityId: a.id, score: m.score, reasons: m.reasons, deadline: o.response_deadline });
          perOpp.set(a.id, (perOpp.get(a.id) ?? 0) + 1);
        }
      }
    }
    const groups = groupByProspect(pairs, settings.min_score, settings.max_opportunities_per_email);

    const oppSector = new Map(opps.map((o) => [o.id, o.sector_slug]));
    const rows = await insertRecipients(db, campaignId!, groups, prospects, settings, { supp, customerSirens, oppSector });

    // Opportunités traitées : profils ciblés et nombre de correspondances (campagne automatique uniquement)
    for (const a of manual ? [] : analyses.filter((x) => reached.has(x.id))) {
      await db
        .from("outreach_opportunity_states")
        .update({ status: "PROCESSED", processed_at: new Date().toISOString(), last_campaign_id: campaignId, target_profiles: a.profiles, target_naf: [...new Set([...a.primaryNaf, ...a.sectorNaf])], matches_count: perOpp.get(a.id) ?? 0, updated_at: new Date().toISOString() })
        .eq("opportunity_id", a.id);
    }

    const stats = {
      opportunities_new: ids.length,
      opportunities_eligible: opps.length,
      prospects_analyzed: analyzed.size,
      matches: pairs.length,
      companies_selected: rows.filter((r) => r.status !== "SUPPRESSED" && r.status !== "FREQUENCY").length,
      emails_prepared: rows.filter((r) => r.status === "PENDING").length,
      no_email: rows.filter((r) => r.status === "NO_EMAIL").length,
      excluded_frequency: rows.filter((r) => r.status === "FREQUENCY").length,
      excluded_suppressed: rows.filter((r) => r.status === "SUPPRESSED").length,
      discovery_calls: discovery.calls,
      discovery_added: discovery.added,
      public_awards_checked: awards?.checked ?? 0,
      public_awards_winners: awards?.winners ?? 0,
    };
    const report = [
      manual
        ? `Campagne manuelle du ${formatDate(date)} (${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}) : ${stats.opportunities_eligible} opportunité(s) récente(s) éligible(s) sur ${stats.opportunities_new}.`
        : `Campagne du ${formatDate(date)} : ${stats.opportunities_eligible} opportunité(s) nouvelle(s) éligible(s) sur ${stats.opportunities_new} détectée(s).`,
      `${stats.prospects_analyzed} entreprise(s) analysée(s), ${stats.matches} correspondance(s) d'au moins ${settings.min_score}/100.`,
      `${stats.companies_selected} entreprise(s) sélectionnée(s), ${stats.emails_prepared} e-mail(s) préparé(s), ${stats.no_email} sans adresse e-mail.`,
      stats.excluded_frequency + stats.excluded_suppressed > 0 ? `${stats.excluded_frequency} écartée(s) (fréquence), ${stats.excluded_suppressed} écartée(s) (liste d'exclusion ou déjà utilisatrices).` : null,
      settings.discovery_enabled ? `Découverte : ${stats.discovery_added} entreprise(s) ajoutée(s) (${stats.discovery_calls} requête(s) à la source publique).` : null,
      awards && (awards.checked || awards.stopped)
        ? `Marchés publics remportés : ${awards.checked} entreprise(s) vérifiée(s), dont ${awards.winners} titulaire(s) d'au moins un marché (DECP).${awards.stopped ? ` Vérification interrompue : ${awards.stopped}` : ""}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
    await db.from("outreach_campaigns").update({ status: "READY", stats, report, updated_at: new Date().toISOString() }).eq("id", campaignId);
    return { campaignId, stats };
  } catch (e) {
    logServerError("outreach build", e);
    await db.from("outreach_campaigns").update({ status: "FAILED", error: e instanceof Error ? e.message.slice(0, 500) : String(e) }).eq("id", campaignId);
    throw e;
  }
}

/**
 * Campagne de prospection dédiée à UN besoin publié par une entreprise inscrite : entreprises de
 * la même activité et de la zone (base Outreach, découverte limitée par la source publique),
 * classées par score, au plus `maxRecipients`, avec les mêmes contrôles que la campagne
 * quotidienne. Une seule campagne par besoin. Validation manuelle si l'Outreach l'exige.
 */
export async function buildNeedOutreachCampaign(
  db: Db,
  opportunityId: string,
  { deadline = Date.now() + 90_000, maxRecipients, discover = true }: { deadline?: number; maxRecipients?: number; discover?: boolean } = {},
): Promise<BuildResult & { identified?: number; relevant?: number; added?: number }> {
  const settings = await loadSettings(db);
  const { data: o } = await db.from("opportunities").select(`${OPP_FIELDS}, origin`).eq("id", opportunityId).maybeSingle();
  if (!o || o.origin !== "INTERNAL" || o.status !== "PUBLISHED" || o.visibility !== "PUBLIC" || o.is_demo) return { campaignId: null, skipped: "Besoin non publié publiquement" };
  const a = analyzeOpportunity(o);
  const { data: existing } = await db.from("outreach_campaigns").select("id, status").eq("kind", "NEED").eq("opportunity_id", opportunityId).maybeSingle();
  if (existing && ["BUILDING", "CANCELLED"].includes(existing.status)) return { campaignId: existing.id, skipped: existing.status === "BUILDING" ? "Campagne en cours de préparation" : "Campagne annulée par l'administrateur" };
  let campaignId = existing?.id ?? null;
  const priorStatus = existing?.status ?? null;
  // Déjà dans la campagne (tous statuts) : jamais deux fois la même entreprise pour un besoin
  const already = new Set<string>();
  // Encore en attente d'envoi : la journée suivante complète jusqu'au quota, sans l'empiler
  let waiting = 0;
  if (campaignId) {
    const rows = await selectAll((from, to) => db.from("outreach_recipients").select("prospect_id, status").eq("campaign_id", campaignId!).order("id").range(from, to));
    for (const r of rows) {
      already.add(r.prospect_id);
      if (["PENDING", "QUEUED", "NO_EMAIL"].includes(r.status)) waiting++;
    }
    await db.from("outreach_campaigns").update({ status: "BUILDING", updated_at: new Date().toISOString() }).eq("id", campaignId);
  } else {
    const { data, error } = await db
      .from("outreach_campaigns")
      .insert({ campaign_date: today(), kind: "NEED", opportunity_id: opportunityId, status: "BUILDING", dry_run: settings.dry_run, min_score: settings.min_score, subject_template: "Besoin publié : {titre}", intro_template: "", updated_at: new Date().toISOString() })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return { campaignId: null, skipped: "Campagne déjà en préparation" };
      throw error;
    }
    campaignId = data.id;
  }
  const quota = Math.max(0, (maxRecipients ?? settings.need_daily_send_cap) - waiting);
  try {
    const ref = await loadReferentials(db);
    // Découverte (source publique SIRENE) pour élargir la base d'entreprises de ce métier dans la zone
    const discovery = discover && settings.discovery_enabled && quota > 0 ? await discoverProspects(db, [a], Math.min(deadline - 30_000, Date.now() + 60_000), 10) : { calls: 0, added: 0, errors: 0 };
    const [found, supp, customers] = await Promise.all([
      quota > 0 ? candidates(db, a, { ...settings, max_prospects_per_opportunity: Math.max(settings.max_prospects_per_opportunity, quota + already.size) }) : Promise.resolve([]),
      loadSuppressions(db),
      selectAll((from, to) => db.from("companies").select("siren").not("siren", "is", null).order("id").range(from, to)),
    ]);
    const fresh = found.filter((p) => !already.has(p.id));
    const prospects = new Map(fresh.map((p) => [p.id, p]));
    const scored = fresh
      .map((p) => ({ p, m: scoreMatch(a, p as ProspectInput, (x) => ref.sectorLabel(x) ?? x) }))
      .filter((x) => x.m.score >= settings.min_score)
      .sort((x, y) => y.m.score - x.m.score || Number(Boolean(y.p.email)) - Number(Boolean(x.p.email)));
    // Les entreprises joignables d'abord, dans la limite du quota du jour pour ce besoin
    const chosen = [...scored.filter((x) => x.p.email), ...scored.filter((x) => !x.p.email)].slice(0, quota);
    const pairs = chosen.map((x) => ({ prospectId: x.p.id, opportunityId, score: x.m.score, reasons: x.m.reasons, deadline: o.response_deadline }));
    const groups = groupByProspect(pairs, settings.min_score, 1);
    const rows = await insertRecipients(db, campaignId!, groups, prospects, settings, {
      supp,
      customerSirens: new Set(customers.map((c) => c.siren!)),
      oppSector: new Map([[opportunityId, o.sector_slug]]),
    });
    const { data: prev } = await db.from("outreach_campaigns").select("stats").eq("id", campaignId!).single();
    const p = (prev?.stats ?? {}) as Record<string, number>;
    const add = (k: string, n: number) => (p[k] ?? 0) + n;
    const stats = {
      prospects_analyzed: add("prospects_analyzed", fresh.length),
      matches: add("matches", scored.length),
      companies_selected: add("companies_selected", rows.filter((r) => r.status !== "SUPPRESSED" && r.status !== "FREQUENCY").length),
      emails_prepared: add("emails_prepared", rows.filter((r) => r.status === "PENDING").length),
      no_email: add("no_email", rows.filter((r) => r.status === "NO_EMAIL").length),
      excluded_frequency: add("excluded_frequency", rows.filter((r) => r.status === "FREQUENCY").length),
      excluded_suppressed: add("excluded_suppressed", rows.filter((r) => r.status === "SUPPRESSED").length),
      discovery_calls: add("discovery_calls", discovery.calls),
      discovery_added: add("discovery_added", discovery.added),
    };
    const addedToday = rows.filter((r) => r.status !== "SUPPRESSED" && r.status !== "FREQUENCY").length;
    const report = [
      `Campagne dédiée au besoin « ${o.title} » : jusqu'à ${settings.need_daily_send_cap} entreprises par jour tant que le besoin est ouvert.`,
      `Dernier passage (${formatDate(today())}) : ${fresh.length} nouvelle(s) entreprise(s) de la même activité dans la zone, ${scored.length} d'au moins ${settings.min_score}/100, ${addedToday} ajoutée(s)${waiting ? ` (${waiting} encore en attente d'envoi)` : ""}.`,
      `Au total : ${stats.companies_selected} entreprise(s) retenue(s), ${stats.emails_prepared} e-mail(s) préparé(s), ${stats.no_email} sans adresse (recherche d'adresse), ${stats.excluded_frequency} écartée(s) (contactée(s) récemment), ${stats.excluded_suppressed} écartée(s) (liste d'opposition ou déjà inscrite(s)).`,
      stats.discovery_calls ? `Découverte : ${stats.discovery_added} entreprise(s) ajoutée(s) à la base (${stats.discovery_calls} requête(s) à la source publique).` : null,
    ]
      .filter(Boolean)
      .join("\n");
    // Validation : une campagne déjà validée le reste ; sinon validation automatique si l'Outreach ne l'exige pas
    const wasValidated = priorStatus !== null && ["VALIDATED", "SENDING", "SENT", "SIMULATED"].includes(priorStatus);
    const hasWork = stats.emails_prepared + stats.no_email > 0;
    const status = wasValidated || (!settings.require_validation && hasWork) ? "VALIDATED" : priorStatus === "READY" || hasWork ? "READY" : (priorStatus ?? "READY");
    await db
      .from("outreach_campaigns")
      .update({ status, ...(status === "VALIDATED" && !wasValidated ? { validated_at: new Date().toISOString() } : {}), stats, report, error: null, updated_at: new Date().toISOString() })
      .eq("id", campaignId!);
    return { campaignId, stats, identified: stats.prospects_analyzed, relevant: stats.companies_selected, added: addedToday };
  } catch (e) {
    logServerError("outreach need build", e);
    await db.from("outreach_campaigns").update({ status: priorStatus ?? "FAILED", error: e instanceof Error ? e.message.slice(0, 500) : String(e) }).eq("id", campaignId!);
    throw e;
  }
}

type Groups = ReturnType<typeof groupByProspect>;
type ProspectRow = Awaited<ReturnType<typeof candidates>>[number];

/**
 * Destinataires d'une campagne : une ligne par entreprise, avec les contrôles d'exclusion (liste
 * d'opposition, entreprise déjà utilisatrice), de fréquence (délai minimum, maximum sur 30 jours,
 * envoi déjà prévu ailleurs, même adresse) et d'adresse manquante. Commun aux campagnes
 * quotidiennes, manuelles et dédiées à un besoin.
 */
async function insertRecipients(
  db: Db,
  campaignId: string,
  groups: Groups,
  prospects: Map<string, ProspectRow>,
  settings: OutreachSettings,
  { supp, customerSirens, oppSector }: { supp: Awaited<ReturnType<typeof loadSuppressions>>; customerSirens: Set<string>; oppSector: Map<string, string | null> },
) {
  // Historique des contacts (fréquence maximale sur 30 jours)
  const recentCounts = new Map<string, number>();
  for (const part of chunk(groups.map((g) => g.prospectId), 300)) {
    const { data } = await db.from("outreach_recipients").select("prospect_id").in("prospect_id", part).eq("status", "SENT").gte("sent_at", new Date(Date.now() - 30 * DAY).toISOString());
    for (const r of data ?? []) recentCounts.set(r.prospect_id, (recentCounts.get(r.prospect_id) ?? 0) + 1);
  }
  // Déjà en attente d'envoi dans une autre campagne (automatique, manuelle ou complémentaire) : pas deux e-mails
  const pendingElsewhere = new Set<string>();
  for (const part of chunk(groups.map((g) => g.prospectId), 300)) {
    const { data } = await db.from("outreach_recipients").select("prospect_id").in("prospect_id", part).in("status", ["PENDING", "QUEUED", "SENDING"]).neq("campaign_id", campaignId);
    for (const r of data ?? []) pendingElsewhere.add(r.prospect_id);
  }
  const minGap = Date.now() - settings.min_days_between_contacts * DAY;
  // Même adresse e-mail déjà contactée récemment via une autre entreprise (adresse partagée par un groupe)
  const mailedRecently = new Set<string>();
  const groupEmails = [...new Set(groups.map((g) => prospects.get(g.prospectId)?.email?.toLowerCase()).filter((e): e is string => Boolean(e)))];
  for (const part of chunk(groupEmails, 200)) {
    const { data } = await db.from("outreach_recipients").select("email").in("email", part).eq("status", "SENT").gte("sent_at", new Date(minGap).toISOString());
    for (const r of data ?? []) if (r.email) mailedRecently.add(r.email.toLowerCase());
  }
  // Stratégie automatique : secteurs dont les e-mails obtiennent le plus de clics et d'inscriptions
  // envoyés (et recherchés) en premier. Simple ordre de passage : aucune entreprise n'est écartée.
  const sectorPriority = (await currentStrategy(db).catch(() => null))?.outreach.sector_priority ?? {};
  const rows = groups.map((g) => {
    const p = prospects.get(g.prospectId)!;
    const sector = oppSector.get(g.opportunities[0]?.id ?? "");
    const priority = Math.round((sector ? (sectorPriority[sector] ?? 0) : 0) * 10);
    const email = p.email?.toLowerCase() ?? null;
    const domain = email?.split("@")[1] ?? null;
    let status = "PENDING";
    if ((p.siren && (supp.SIREN.has(p.siren) || customerSirens.has(p.siren))) || (email && supp.EMAIL.has(email)) || (domain && supp.DOMAIN.has(domain))) status = "SUPPRESSED";
    else if ((p.last_contacted_at && new Date(p.last_contacted_at).getTime() > minGap) || (recentCounts.get(p.id) ?? 0) >= settings.max_contacts_per_30_days || pendingElsewhere.has(p.id) || (email && mailedRecently.has(email))) status = "FREQUENCY";
    else if (!email) status = "NO_EMAIL";
    return { campaign_id: campaignId, prospect_id: g.prospectId, email, score: g.score, reasons: g.reasons, status, priority };
  });
  for (const part of chunk(rows, 200)) {
    const { data: inserted, error } = await db.from("outreach_recipients").insert(part).select("id, prospect_id");
    if (error) throw error;
    const links = (inserted ?? []).flatMap((r) =>
      groups.find((g) => g.prospectId === r.prospect_id)!.opportunities.map((o, position) => ({ recipient_id: r.id, opportunity_id: o.id, score: o.score, reasons: o.reasons, position })),
    );
    for (const lp of chunk(links, 500)) {
      const { error: e2 } = await db.from("outreach_recipient_opportunities").insert(lp);
      if (e2) throw e2;
    }
    await db.from("outreach_events").insert((inserted ?? []).map((r) => ({ recipient_id: r.id, campaign_id: campaignId, type: "PREPARED" })));
  }

  return rows;
}

/**
 * 11–13. File d'envoi (worker) : campagnes validées, un e-mail à la fois, jamais en masse.
 *   prospect → file (destinataires PENDING / QUEUED) → worker → SMTP → envoyé
 * Avant CHAQUE envoi : liste d'opposition (adresse, domaine, SIREN), entreprise « Ne plus
 * contacter », pas déjà reçu dans cette campagne, nombre de tentatives. Limites progressives :
 * par jour (toutes campagnes), par heure, intervalle entre deux envois, et limite propre à la
 * campagne automatique. Notre base enregistre chaque tentative (date, réponse SMTP, erreur).
 */
export async function processSendQueue(db: Db, { deadline = Date.now() + 60_000, sleep = wait }: { deadline?: number; sleep?: (ms: number) => Promise<void> } = {}) {
  // Un seul envoi à la fois (tâches planifiées qui se chevauchent, lancement manuel) : limites et
  // intervalle entre deux e-mails respectés globalement. Verrou libéré à la fin, ou expiré si la
  // fonction est arrêtée en cours de route.
  const lock = new Date(Math.max(deadline, Date.now()) + 2 * 60_000).toISOString();
  const { data: locked } = await db
    .from("outreach_settings")
    .update({ send_lock_until: lock })
    .eq("id", true)
    .or(`send_lock_until.is.null,send_lock_until.lt.${new Date().toISOString()}`)
    .select("id");
  if (!locked?.length) return { sent: 0, simulated: 0, failed: 0, skipped: 0, remaining_cap: 0, stopped: "un autre envoi est déjà en cours" as string | null };
  try {
    return await sendQueue(db, deadline, sleep);
  } finally {
    await db.from("outreach_settings").update({ send_lock_until: null }).eq("id", true).eq("send_lock_until", lock);
  }
}

async function sendQueue(db: Db, deadline: number, sleep: (ms: number) => Promise<void>) {
  // Marge de sécurité proportionnée au temps disponible (40 s au plus pour une tâche planifiée)
  const sendMargin = Math.min(SEND_SAFETY_MS, Math.max(0, deadline - Date.now()) / 4);
  const settings = await loadSettings(db);
  const iso = (t: number) => new Date(t).toISOString();
  const startOfDay = startOfParisDay();
  // Envoi interrompu (fonction arrêtée pendant l'envoi) : résultat incertain → jamais renvoyé automatiquement,
  // et compté comme un contact (l'entreprise a peut-être reçu l'e-mail : délai minimum respecté)
  const { data: interrupted } = await db
    .from("outreach_recipients")
    .update({ status: "FAILED", error: "Envoi interrompu : résultat incertain, non renvoyé automatiquement (évite un doublon)" })
    .eq("status", "SENDING")
    .lt("last_attempt_at", iso(Date.now() - 15 * 60_000))
    .select("prospect_id, last_attempt_at");
  for (const r of interrupted ?? []) {
    if (r.last_attempt_at) await db.from("outreach_prospects").update({ last_contacted_at: r.last_attempt_at }).eq("id", r.prospect_id).or(`last_contacted_at.is.null,last_contacted_at.lt.${r.last_attempt_at}`);
  }

  const sentSince = async (since: string, kinds: "AUTO" | "NEED" | "NOT_NEED" | "ALL") => {
    let q = db.from("outreach_recipients").select("id, campaign:outreach_campaigns!inner(kind)", { count: "exact", head: true }).eq("status", "SENT").gte("sent_at", since);
    if (kinds === "AUTO" || kinds === "NEED") q = q.eq("campaign.kind", kinds);
    else if (kinds === "NOT_NEED") q = q.neq("campaign.kind", "NEED");
    return (await q).count ?? 0;
  };
  const [autoToday, allToday, needToday, lastHour] = await Promise.all([sentSince(startOfDay, "AUTO"), sentSince(startOfDay, "NOT_NEED"), sentSince(startOfDay, "NEED"), sentSince(iso(Date.now() - 3_600_000), "ALL")]);
  let autoRemaining = Math.max(0, settings.daily_send_cap - autoToday);
  // Limite quotidienne des campagnes automatiques et manuelles ; les besoins publiés ont leur propre quota
  let totalRemaining = Math.max(0, settings.total_daily_send_cap - allToday);
  let needRemaining = Math.max(0, settings.need_daily_send_cap - needToday);
  let hourRemaining = Math.max(0, settings.hourly_send_cap - lastHour);
  const result = { sent: 0, simulated: 0, failed: 0, skipped: 0, remaining_cap: Math.min(totalRemaining + needRemaining, hourRemaining), stopped: null as string | null };

  const { data: listed } = await db.from("outreach_campaigns").select("id, dry_run, kind").in("status", ["VALIDATED", "SENDING"]).order("campaign_date");
  if (!listed?.length) return result;
  // Besoins publiés par des entreprises inscrites d'abord (mise en relation attendue)
  const campaigns = [...listed.filter((c) => c.kind === "NEED"), ...listed.filter((c) => c.kind !== "NEED")];
  const ref = await loadReferentials(db);
  const blockers = realSendBlockers(settings);
  const supp = await loadSuppressions(db);
  // Entreprises déjà utilisatrices de LinkProB2B : jamais prospectées (contrôle repris à l'envoi,
  // une campagne pouvant partir plusieurs jours après sa préparation)
  const customers = new Set(
    (await selectAll((from, to) => db.from("companies").select("siren").not("siren", "is", null).order("id").range(from, to))).map((c) => c.siren!),
  );
  const gap = settings.send_interval_seconds * 1000;

  campaignsLoop: for (const c of campaigns) {
    // Simulation : campagne validée en simulation. Une campagne réelle n'est jamais « simulée » faute
    // d'envoi possible (mode simulation activé, envoi coupé…) : elle reste en file jusqu'à ce que l'envoi reprenne.
    const simulate = c.dry_run;
    if (!simulate && blockers.length) {
      result.stopped = `envoi réel suspendu : ${blockers[0]}`;
      continue;
    }
    const need = c.kind === "NEED";
    const capped = c.kind === "AUTO";
    await db.from("outreach_campaigns").update({ status: "SENDING" }).eq("id", c.id);
    while (Date.now() < deadline) {
      const room = simulate ? 25 : Math.min(25, need ? needRemaining : totalRemaining, hourRemaining, capped ? autoRemaining : 25);
      if (room <= 0) {
        if (!simulate && hourRemaining <= 0) {
          result.stopped = "limite horaire";
          break campaignsLoop;
        }
        // Quota des besoins épuisé : on passe aux autres campagnes (et inversement)
        if (!simulate && !need && totalRemaining <= 0) result.stopped = "limite quotidienne";
        break;
      }
      const { data: batch } = await db.from("outreach_recipients").select("id").eq("campaign_id", c.id).in("status", ["PENDING", "QUEUED"]).order("priority", { ascending: false }).order("score", { ascending: false }).limit(room);
      if (!batch?.length) break;
      const bundles = await loadRecipientBundles(db, batch.map((b) => b.id));
      for (const b of bundles) {
        if (Date.now() >= deadline) break campaignsLoop;
        const now = new Date().toISOString();
        const rid = b.recipient.id;
        const skip = async (status: "EXCLUDED" | "SUPPRESSED" | "FAILED" | "FREQUENCY", error: string) => {
          await db.from("outreach_recipients").update({ status, error, updated_at: now }).eq("id", rid);
          result.skipped++;
        };
        // ---- Contrôles avant CHAQUE envoi
        const email = b.recipient.email?.trim().toLowerCase() ?? null;
        const opps = b.opportunities.filter((o) => !o.excluded && o.status === "PUBLISHED" && (!o.response_deadline || new Date(o.response_deadline).getTime() > Date.now()));
        if (!email || opps.length === 0) {
          await skip("EXCLUDED", "Plus aucune opportunité ouverte");
          continue;
        }
        const domain = email.split("@")[1] ?? "";
        if (supp.EMAIL.has(email) || supp.DOMAIN.has(domain) || (b.prospect.siren && supp.SIREN.has(b.prospect.siren))) {
          await skip("SUPPRESSED", "Liste d'opposition (adresse, domaine ou entreprise)");
          continue;
        }
        if (b.prospect.status !== "ACTIVE") {
          await skip("SUPPRESSED", "Entreprise « Ne plus contacter »");
          continue;
        }
        if (b.prospect.siren && customers.has(b.prospect.siren)) {
          await skip("SUPPRESSED", "Entreprise déjà utilisatrice de LinkProB2B");
          continue;
        }
        const { count: already } = await db.from("outreach_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).neq("id", rid).eq("email", email).in("status", ["SENT", "SENDING", "SIMULATED"]);
        if (already) {
          await skip("EXCLUDED", "Cette adresse a déjà reçu cette campagne");
          continue;
        }
        // Délai minimum entre deux e-mails à une même entreprise, toutes campagnes confondues
        const recent = b.prospect.last_contacted_at && new Date(b.prospect.last_contacted_at).getTime() > Date.now() - settings.min_days_between_contacts * DAY;
        const { count: inFlight } = await db.from("outreach_recipients").select("id", { count: "exact", head: true }).eq("prospect_id", b.prospect.id).neq("id", rid).eq("status", "SENDING");
        // Même adresse e-mail rattachée à une autre entreprise (groupe, adresse partagée) : même délai minimum
        const { count: sameMailbox } = await db
          .from("outreach_recipients")
          .select("id", { count: "exact", head: true })
          .eq("email", email)
          .neq("id", rid)
          .or(`status.eq.SENDING,and(status.eq.SENT,sent_at.gte.${iso(Date.now() - settings.min_days_between_contacts * DAY)})`);
        if (recent || inFlight || sameMailbox) {
          await skip("FREQUENCY", "Entreprise ou adresse déjà contactée récemment (autre campagne)");
          continue;
        }
        if (b.recipient.attempts >= settings.max_send_attempts) {
          await skip("FAILED", `Nombre maximal de tentatives atteint (${settings.max_send_attempts})`);
          continue;
        }
        const message = buildEmail({ ...b, opportunities: opps }, ref);
        if (simulate) {
          await db.from("outreach_recipients").update({ status: "SIMULATED", subject: b.recipient.subject, sent_at: now, updated_at: now }).eq("id", rid);
          await db.from("outreach_events").insert({ recipient_id: rid, campaign_id: c.id, type: "SIMULATED" });
          result.simulated++;
          continue;
        }
        // Pas d'envoi commencé juste avant l'arrêt de la tâche : il pourrait être coupé en cours de route
        if (deadline - Date.now() < sendMargin) break campaignsLoop;
        // ---- Réservation (évite un double envoi si deux workers tournent en même temps)
        const { data: claimed } = await db
          .from("outreach_recipients")
          .update({ status: "SENDING", attempts: b.recipient.attempts + 1, last_attempt_at: now, updated_at: now })
          .eq("id", rid)
          .in("status", ["PENDING", "QUEUED"])
          .select("id");
        if (!claimed?.length) continue;
        const r = await sendOutreachEmail({ to: email, subject: message.subject, html: message.html, text: message.text, senderName: settings.sender_name, replyTo: settings.reply_to, unsubscribeUrl: message.urls.unsubscribeOneClick, idempotencyKey: `outreach-${rid}` });
        const done = new Date().toISOString();
        const trace = { smtp_response: r.response?.slice(0, 500) ?? null, transport: r.transport ?? null, updated_at: done };
        if (r.status === "SENT") {
          await db.from("outreach_recipients").update({ status: "SENT", sent_at: done, provider_id: r.id ?? null, error: null, ...trace }).eq("id", rid);
          await db.from("outreach_prospects").update({ last_contacted_at: done, contacts_count: b.prospect.contacts_count + 1, updated_at: done }).eq("id", b.prospect.id);
          await db.from("outreach_events").insert({ recipient_id: rid, campaign_id: c.id, type: "SENT", meta: { transport: r.transport ?? null } });
          result.sent++;
          if (need) needRemaining--;
          else totalRemaining--;
          hourRemaining--;
          if (capped) autoRemaining--;
        } else if (r.status === "SKIPPED") {
          // Envoi coupé ou non configuré : rien n'est parti, l'e-mail reste dans la file
          await db.from("outreach_recipients").update({ status: "QUEUED", attempts: b.recipient.attempts, error: r.error ?? null, ...trace }).eq("id", rid);
          result.stopped = r.error ?? "envoi non configuré";
          break campaignsLoop;
        } else {
          // Identifiants SMTP refusés : problème de configuration, la tentative n'est pas décomptée
          const configError = /authentification/i.test(r.error ?? "");
          const exhausted = !configError && b.recipient.attempts + 1 >= settings.max_send_attempts;
          const status = r.permanent || (!r.retryable && !configError) || exhausted ? "FAILED" : "QUEUED";
          await db
            .from("outreach_recipients")
            .update({ status, error: r.error?.slice(0, 300) ?? null, ...(configError ? { attempts: b.recipient.attempts } : {}), ...trace })
            .eq("id", rid);
          await db.from("outreach_events").insert({ recipient_id: rid, campaign_id: c.id, type: "FAILED", meta: { error: r.error ?? null, response: r.response ?? null, permanent: Boolean(r.permanent) } });
          result.failed++;
          // Rebond définitif (adresse inexistante ou refusée) : ajoutée à la liste d'opposition
          if (r.permanent) {
            await db.from("outreach_suppressions").upsert({ kind: "EMAIL", value: email, reason: "BOUNCE" }, { onConflict: "kind,value", ignoreDuplicates: true });
            supp.EMAIL.add(email);
          } else {
            // Erreur temporaire ou de configuration du serveur : on s'arrête, nouvelle tentative au passage suivant
            result.stopped = r.error ?? "erreur du serveur d'envoi";
            break campaignsLoop;
          }
        }
        // Envoi progressif : intervalle entre deux e-mails (jamais d'envoi simultané)
        if (gap > 0 && Date.now() + gap < deadline) await sleep(gap);
      }
    }
    const { count: left } = await db.from("outreach_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).in("status", ["PENDING", "QUEUED", "SENDING"]);
    if (!left) await db.from("outreach_campaigns").update({ status: simulate ? "SIMULATED" : "SENT", sent_at: new Date().toISOString() }).eq("id", c.id);
  }
  result.remaining_cap = Math.min(totalRemaining + needRemaining, hourRemaining);
  return result;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Recherche des adresses génériques des entreprises sélectionnées sans e-mail
 * (puis des autres entreprises actives), dans la limite quotidienne. Une adresse
 * trouvée rend le destinataire de la campagne en cours « prêt à envoyer », sauf
 * exclusion.
 */
export async function enrichProspects(db: Db, { campaignId = null, deadline = Date.now() + 60_000 }: { campaignId?: string | null; deadline?: number } = {}) {
  const settings = await loadSettings(db);
  const searchers = configuredSearchers();
  const result = {
    searched: 0,
    found: 0,
    no_website: 0,
    no_email: 0,
    blocked: 0,
    errors: 0,
    /** Recherches reportées : service de recherche saturé (limite de requêtes), sans faute de l'entreprise */
    deferred: 0,
    /** Causes des erreurs (les plus fréquentes), pour le rapport */
    error_reasons: {} as Record<string, number>,
    skipped: searchers.length === 0 ? "aucune méthode de recherche active" : null as string | null,
    limit_reached: false,
    already_searched: 0,
  };
  if (!settings.enrichment_enabled || searchers.length === 0) return result;
  const { count: today } = await db.from("outreach_prospects").select("id", { count: "exact", head: true }).gte("enriched_at", startOfParisDay());
  const budget = Math.max(0, settings.enrichment_daily_limit - (today ?? 0));
  if (!budget) return { ...result, limit_reached: true };
  // Nouvelle tentative pour les entreprises sans adresse trouvée, après un délai (sites mis à jour entre-temps)
  const retryBefore = new Date(Date.now() - ENRICH_RETRY_DAYS * DAY).toISOString();
  // Erreur (site lent, service saturé) : nouvel essai après quelques heures, jamais en boucle à chaque passage
  const errorRetryBefore = new Date(Date.now() - ENRICH_ERROR_RETRY_HOURS * 3_600_000).toISOString();
  const nowIso = new Date().toISOString();
  const searchable = (p: { enrichment_status: string; enriched_at: string | null; enrichment_deferred_until: string | null }) =>
    (p.enrichment_status === "PENDING" && (!p.enrichment_deferred_until || p.enrichment_deferred_until < nowIso)) ||
    (p.enrichment_status === "ERROR" && (!p.enriched_at || p.enriched_at < errorRetryBefore)) ||
    (["NO_WEBSITE", "NO_EMAIL", "BLOCKED"].includes(p.enrichment_status) && (!p.enriched_at || p.enriched_at < retryBefore));
  // Priorité : entreprises de la campagne sans e-mail, puis les autres
  const ids: string[] = [];
  if (campaignId) {
    const { data, error } = await db.from("outreach_recipients").select("prospect_id").eq("campaign_id", campaignId).eq("status", "NO_EMAIL").order("priority", { ascending: false }).order("score", { ascending: false }).limit(Math.min(budget, 1000));
    if (error) throw error;
    ids.push(...(data ?? []).map((r) => r.prospect_id));
  }
  // Par paquets (adresse de requête bornée), dans l'ordre de priorité de la campagne
  type Row = {
    id: string;
    name: string;
    city: string | null;
    siren: string | null;
    website: string | null;
    enrichment_status: string;
    enriched_at: string | null;
    enrichment_deferred_until: string | null;
    alt_names: string[];
    alt_names_checked_at: string | null;
    size_range: string | null;
    is_individual_entrepreneur: boolean;
  };
  const rows: Row[] = [];
  for (const part of chunk(ids, 200)) {
    const { data, error } = await db.from("outreach_prospects").select(ENRICH_FIELDS).in("id", part).is("email", null).eq("status", "ACTIVE");
    if (error) throw error;
    const byId = new Map((data ?? []).map((r) => [r.id, r]));
    for (const id of part) if (byId.has(id)) rows.push(byId.get(id)!);
  }
  // Entreprises avec salariés d'abord (elles ont bien plus souvent un site), entrepreneurs individuels en dernier
  const rank = (p: Row) => (p.is_individual_entrepreneur ? 2 : hasEmployees(p.size_range) ? 0 : 1);
  const queue = rows.filter(searchable).sort((a, b) => rank(a) - rank(b));
  result.already_searched = rows.length - queue.length;
  // Hors campagne : d'abord les entreprises avec salariés, puis les autres
  for (const withStaff of [true, false]) {
    if (queue.length >= budget) break;
    let q = db
      .from("outreach_prospects")
      .select(ENRICH_FIELDS)
      .is("email", null)
      .eq("status", "ACTIVE")
      .eq("enrichment_status", "PENDING")
      .or(`enrichment_deferred_until.is.null,enrichment_deferred_until.lt.${nowIso}`)
      .eq("is_individual_entrepreneur", false);
    q = withStaff ? q.not("size_range", "is", null).neq("size_range", "0 salarié") : q.or("size_range.is.null,size_range.eq.0 salarié");
    const { data: more } = await q.order("updated_at", { ascending: false }).limit(budget - queue.length);
    for (const p of more ?? []) if (!queue.some((x) => x.id === p.id)) queue.push(p);
  }
  const supp = await loadSuppressions(db, ["EMAIL", "DOMAIN"]);
  const blocked = new Set([...supp.EMAIL, ...supp.DOMAIN]);
  const work = queue.slice(0, budget);
  const handle = async (p: (typeof work)[number]) => {
    result.searched++;
    // Autres noms publics (sigle, enseignes) pour les entreprises découvertes avant leur enregistrement
    if (!p.alt_names_checked_at && p.siren && !p.website) {
      const names = await companyAltNames(p.siren, p.name).catch(() => null);
      if (names) {
        p.alt_names = names;
        await db.from("outreach_prospects").update({ alt_names: names, alt_names_checked_at: new Date().toISOString() }).eq("id", p.id);
      }
    }
    // Temps borné par entreprise (sites lents) : la tâche garde le temps d'envoyer les e-mails
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error("Délai dépassé : nouvel essai plus tard")), ENRICH_COMPANY_TIMEOUT_MS)));
    const r = await Promise.race([enrichCompany(p, searchers), timeout])
      .catch((e) => ({ status: "ERROR" as const, website: null, email: null, source: null, note: e instanceof Error ? e.message.slice(0, 200) : "Erreur" }))
      .finally(() => clearTimeout(timer));
    const now = new Date().toISOString();
    // Service saturé : l'entreprise reste à rechercher (non décomptée de la limite du jour), mais
    // n'est reprise qu'après quelques heures : les passages suivants cherchent d'autres entreprises
    if (r.status === "ERROR" && r.note?.startsWith("[report]")) {
      result.deferred++;
      result.searched--;
      const until = new Date(Date.now() + ENRICH_DEFER_HOURS * 3_600_000).toISOString();
      await db.from("outreach_prospects").update({ enrichment_status: "PENDING", enrichment_note: r.note.replace("[report] ", ""), enrichment_deferred_until: until, updated_at: now }).eq("id", p.id);
      return;
    }
    const email = r.email && !blocked.has(r.email) && !blocked.has(r.email.split("@")[1]) ? r.email : null;
    const { error } = await db
      .from("outreach_prospects")
      .update({ enrichment_status: email ? "FOUND" : r.status === "FOUND" ? "NO_EMAIL" : r.status, enriched_at: now, enrichment_deferred_until: null, enrichment_note: r.note || null, website: r.website ?? p.website, ...(email ? { email, email_source: r.source } : {}), updated_at: now })
      .eq("id", p.id);
    if (error?.code === "23505") {
      await db.from("outreach_prospects").update({ enrichment_status: "NO_EMAIL", enriched_at: now, enrichment_note: "Adresse déjà utilisée par une autre entreprise" }).eq("id", p.id);
      result.no_email++;
      return;
    }
    if (email) {
      result.found++;
      if (campaignId) await db.from("outreach_recipients").update({ email, status: "PENDING", updated_at: now }).eq("campaign_id", campaignId).eq("prospect_id", p.id).eq("status", "NO_EMAIL");
    } else if (r.status === "NO_WEBSITE") result.no_website++;
    else if (r.status === "BLOCKED") result.blocked++;
    else if (r.status === "ERROR") {
      result.errors++;
      const reason = errorReason(r.note);
      result.error_reasons[reason] = (result.error_reasons[reason] ?? 0) + 1;
    }
    else result.no_email++;
  };
  // Plusieurs entreprises à la fois (chaque recherche attend surtout le réseau), dans le temps imparti.
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(ENRICH_CONCURRENCY, work.length) }, async () => {
      while (next < work.length && Date.now() < deadline) await handle(work[next++]);
    }),
  );
  return result;
}

/** Regroupe les messages d'erreur en quelques causes lisibles. */
export function errorReason(note: string | null | undefined): string {
  const n = note ?? "";
  if (/délai dépassé|timeout|aborted/i.test(n)) return "site trop lent";
  if (/Site inaccessible \((5\d\d)/.test(n)) return "site en panne (erreur serveur)";
  if (/Site inaccessible \(4\d\d/.test(n)) return "page introuvable";
  if (/adresse non publique|ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(n)) return "site introuvable (adresse invalide)";
  if (/certificate|SSL|TLS|self.signed/i.test(n)) return "certificat de sécurité invalide";
  if (/Brave|Dropcontact/i.test(n)) return "service de recherche en erreur";
  if (/fetch failed|ECONNRE|socket|network/i.test(n)) return "connexion au site impossible";
  return "autre";
}

/** Délai avant un nouvel essai après une erreur (site lent, panne passagère). */
const ENRICH_ERROR_RETRY_HOURS = 12;
/** Recherche reportée (service de recherche saturé) : reprise après ce délai. */
const ENRICH_DEFER_HOURS = 6;
// Recherches simultanées (chaque recherche attend surtout le réseau) : plus d'entreprises par passage
const ENRICH_CONCURRENCY = 10;
const ENRICH_FIELDS = "id, name, city, siren, website, enrichment_status, enriched_at, enrichment_deferred_until, alt_names, alt_names_checked_at, size_range, is_individual_entrepreneur";
const hasEmployees = (size: string | null) => Boolean(size && size !== "0 salarié");
/** Délai avant une nouvelle recherche d'adresse pour une entreprise sans résultat. */
const ENRICH_RETRY_DAYS = 30;

/** Ligne de rapport de la recherche d'adresses (ajoutée au rapport de la campagne). */
export function enrichmentReport(r: Awaited<ReturnType<typeof enrichProspects>>): string {
  if (r.skipped) return `Recherche d'adresses e-mail : non lancée (${r.skipped}).`;
  if (r.limit_reached) return "Recherche d'adresses e-mail : limite quotidienne atteinte (Outreach → Paramètres pour l'augmenter).";
  if (!r.searched)
    return r.already_searched
      ? `Recherche d'adresses e-mail : les ${r.already_searched} entreprise(s) sans e-mail de cette campagne ont déjà été recherchées (site introuvable ou aucune adresse générique publiée) ; nouvelle tentative automatique après ${ENRICH_RETRY_DAYS} jours.`
      : "Recherche d'adresses e-mail : aucune entreprise sans e-mail à rechercher.";
  const reasons = Object.entries(r.error_reasons ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, n]) => `${k} : ${n}`)
    .join(", ");
  return `Recherche d'adresses e-mail : ${r.searched} entreprise(s) recherchée(s), ${r.found} adresse(s) trouvée(s) ; ${r.no_website} sans site identifié, ${r.no_email} sans adresse générique publiée, ${r.blocked} site(s) refusant l'exploration, ${r.errors} erreur(s)${reasons ? ` (${reasons})` : ""}${r.deferred ? ` ; ${r.deferred} recherche(s) reportée(s) (service de recherche saturé)` : ""}.`;
}

/**
 * Recherche des adresses pour la campagne du jour, puis envoi : utilisé par la
 * tâche dédiée (/api/cron/outreach-contacts) et le bouton du tableau de bord.
 * Les adresses trouvées après la préparation remettent la campagne dans la file d'envoi
 * (fonctionnement automatique uniquement).
 */
export async function enrichCampaignAndSend(db: Db, { campaignId, deadline = Date.now() + 240_000 }: { campaignId: string; deadline?: number }) {
  const settings = await loadSettings(db);
  const enrichment = await enrichProspects(db, { campaignId, deadline: deadline - 30_000 });
  const { data: c } = await db.from("outreach_campaigns").select("status, report").eq("id", campaignId).single();
  const line = `${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })} — ${enrichmentReport(enrichment)}`;
  const patch: { report: string; status?: string; validated_at?: string } = { report: [c?.report, line].filter(Boolean).join("\n") };
  if (!settings.require_validation && c) {
    // Fonctionnement automatique : une campagne préparée part sans validation, et une campagne
    // déjà envoyée repart dès que de nouvelles adresses sont prêtes.
    if (c.status === "READY") Object.assign(patch, { status: "VALIDATED", validated_at: new Date().toISOString() });
    else if (["SENT", "SIMULATED"].includes(c.status)) {
      const { count } = await db.from("outreach_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).in("status", ["PENDING", "QUEUED"]);
      if (count) patch.status = "SENDING";
    }
  }
  await db.from("outreach_campaigns").update(patch).eq("id", campaignId);
  const send = await processSendQueue(db, { deadline });
  return { enrichment, send };
}

const today_ = () => parisToday();

/**
 * Conversions : une inscription venue d'Outreach dont l'entreprise a souscrit
 * un abonnement payant (actif ou en essai) — calculé à partir des données réelles.
 */
export async function updateConversions(db: Db) {
  const pending = await selectAll((from, to) =>
    db.from("outreach_events").select("id, recipient_id, campaign_id, user_id").eq("type", "SIGNUP").not("user_id", "is", null).order("id").range(from, to),
  );
  if (!pending.length) return { converted: 0 };
  const already = new Set<string>();
  for (const part of chunk([...new Set(pending.map((s) => s.recipient_id!))], 200)) {
    const { data: done, error } = await db.from("outreach_recipients").select("id").in("id", part).not("converted_at", "is", null);
    if (error) throw error;
    for (const r of done ?? []) already.add(r.id);
  }
  let converted = 0;
  for (const s of pending.filter((x) => !already.has(x.recipient_id!))) {
    const { data: members } = await db.from("company_members").select("company_id").eq("user_id", s.user_id!);
    const companies = (members ?? []).map((m) => m.company_id);
    if (!companies.length) continue;
    const { count } = await db.from("subscriptions").select("id", { count: "exact", head: true }).in("company_id", companies).in("status", ["active", "trialing"]);
    if (!count) continue;
    const now = new Date().toISOString();
    // Une seule conversion par destinataire (plusieurs inscriptions, passages répétés)
    const { data: marked } = await db.from("outreach_recipients").update({ converted_at: now }).eq("id", s.recipient_id!).is("converted_at", null).select("id");
    already.add(s.recipient_id!);
    if (!marked?.length) continue;
    await db.from("outreach_events").insert({ recipient_id: s.recipient_id, campaign_id: s.campaign_id, type: "CONVERSION", user_id: s.user_id });
    converted++;
  }
  return { converted };
}

/**
 * Montée en charge automatique (une fois par jour, tâche du matin) : la limite quotidienne
 * monte d'un palier par semaine si les rebonds et désinscriptions restent faibles.
 */
export async function applySendRamp(db: Db, now = Date.now()) {
  const settings = await loadSettings(db);
  const since = new Date(now - RAMP_INTERVAL_DAYS * 86_400_000).toISOString();
  const [sent, bounces, unsubscribes] = await Promise.all([
    db.from("outreach_recipients").select("id", { count: "exact", head: true }).eq("status", "SENT").gte("sent_at", since),
    db.from("outreach_suppressions").select("id", { count: "exact", head: true }).eq("reason", "BOUNCE").gte("created_at", since),
    db.from("outreach_suppressions").select("id", { count: "exact", head: true }).eq("kind", "EMAIL").in("reason", ["UNSUBSCRIBE", "COMPLAINT"]).gte("created_at", since),
  ]);
  const decision = decideRamp({
    enabled: settings.send_ramp_enabled,
    cap: settings.total_daily_send_cap,
    hourlyCap: settings.hourly_send_cap,
    target: settings.send_ramp_target,
    lastAt: settings.send_ramp_last_at,
    now,
    sent: sent.count ?? 0,
    bounces: bounces.count ?? 0,
    unsubscribes: unsubscribes.count ?? 0,
  });
  if (decision.action !== "hold") {
    await db
      .from("outreach_settings")
      .update({ total_daily_send_cap: decision.cap, hourly_send_cap: decision.hourlyCap, send_ramp_last_at: new Date(now).toISOString() })
      .eq("id", true);
  }
  return { ...decision, previous: settings.total_daily_send_cap };
}

/**
 * Passage d'envoi seul (/api/cron/envoi, plusieurs fois par jour) : aucune recherche
 * d'entreprise ni d'adresse, uniquement la file d'attente, dans les limites réglées.
 */
export async function runSendPass(db: Db, { budgetMs = 270_000 }: { budgetMs?: number } = {}) {
  return processSendQueue(db, { deadline: Date.now() + budgetMs });
}

/** Tâche quotidienne complète (appelée par /api/cron/outreach). */
export async function runOutreachDaily(db: Db, { budgetMs = 240_000 }: { budgetMs?: number } = {}) {
  const deadline = Date.now() + budgetMs;
  const ramp = await applySendRamp(db).catch((e) => (logServerError("outreach ramp", e), null));
  const settings = await loadSettings(db);
  const sync = await syncOpportunityStates(db, settings);
  const build = await buildDailyCampaign(db, { deadline: deadline - 120_000 });
  const enrichment = await enrichProspects(db, { campaignId: build.campaignId, deadline: deadline - 45_000 }).catch((e) => (logServerError("outreach enrichment", e), null));
  if (build.campaignId && enrichment) {
    const { data: c } = await db.from("outreach_campaigns").select("report").eq("id", build.campaignId).single();
    const rampLine = ramp && ramp.action !== "hold" ? `Envois par jour : ${ramp.previous} → ${ramp.cap} (${ramp.reason.toLowerCase()})` : null;
    await db.from("outreach_campaigns").update({ report: [c?.report, enrichmentReport(enrichment), rampLine].filter(Boolean).join("\n") }).eq("id", build.campaignId);
  }
  if (build.campaignId && !build.skipped && !settings.require_validation) {
    await db.from("outreach_campaigns").update({ status: "VALIDATED", validated_at: new Date().toISOString() }).eq("id", build.campaignId).eq("status", "READY");
  }
  const send = await processSendQueue(db, { deadline });
  const conversions = await updateConversions(db).catch((e) => (logServerError("outreach conversions", e), { converted: 0 }));
  return { ramp, sync, build, enrichment, send, conversions };
}

/**
 * Relances automatiques de la journée (/api/cron/outreach-contacts, plusieurs fois par jour) :
 * si la campagne du jour n'existe pas encore (ou a échoué), elle est préparée ; sinon la
 * recherche d'adresses continue et les e-mails devenus possibles partent aussitôt.
 */
export async function runOutreachFollowUp(db: Db, { budgetMs = 270_000 }: { budgetMs?: number } = {}) {
  const { data: campaign } = await db.from("outreach_campaigns").select("id, status, updated_at").eq("campaign_date", today_()).eq("kind", "AUTO").maybeSingle();
  // Préparation interrompue (tâche arrêtée en cours de route) : reprise après 10 minutes sans progrès.
  const stalled = campaign?.status === "BUILDING" && Date.now() - new Date(campaign.updated_at).getTime() > 10 * 60_000;
  if (!campaign || campaign.status === "FAILED" || stalled) return { mode: "daily" as const, ...(await runOutreachDaily(db, { budgetMs: budgetMs - 30_000 })) };
  if (campaign.status === "BUILDING" || campaign.status === "CANCELLED") return { mode: "skipped" as const, skipped: campaign.status === "BUILDING" ? "Campagne du jour en cours de préparation" : "Campagne du jour annulée" };
  const deadline = Date.now() + budgetMs;
  // D'abord les entreprises déjà joignables (rapide, sans recherche), puis la recherche d'adresses
  const reachableFirst = await topUpToTarget(db, Math.min(deadline, Date.now() + 130_000), { reachableOnly: true });
  const contacts = await enrichCampaignAndSend(db, { campaignId: campaign.id, deadline: deadline - 120_000 });
  // Objectif quotidien (50 e-mails pertinents par défaut) pas encore atteint : nouvelle recherche
  // d'entreprises et d'adresses (campagne complémentaire), autant de passages que nécessaire.
  const topUp = await topUpToTarget(db, deadline);
  return { mode: "contacts" as const, ...contacts, reachable_first: reachableFirst, top_up: topUp };
}

/** E-mails Outreach réellement envoyés depuis minuit (heure de Paris), toutes campagnes. */
export async function sentTodayCount(db: Db) {
  const { count } = await db.from("outreach_recipients").select("id", { count: "exact", head: true }).eq("status", "SENT").gte("sent_at", startOfParisDay());
  return count ?? 0;
}

/** Complète la journée jusqu'à l'objectif d'envois : rien si atteint, ou si le temps manque. */
export async function topUpToTarget(db: Db, deadline: number, { reachableOnly = false }: { reachableOnly?: boolean } = {}) {
  const settings = await loadSettings(db);
  const target = Math.min(settings.daily_send_target, settings.total_daily_send_cap);
  const before = await sentTodayCount(db);
  if (!target || before >= target) return { target, sent_before: before, ran: false, reason: "Objectif du jour atteint" };
  if (deadline - Date.now() < (reachableOnly ? 60_000 : 100_000)) return { target, sent_before: before, ran: false, reason: "Temps insuffisant dans ce passage" };
  // Économie de temps de calcul : entreprises déjà joignables, mais une campagne complémentaire préparée
  // il y a moins de 90 minutes n'a rien trouvé à envoyer → inutile de tout recalculer maintenant
  const { data: recentTopUps } = !reachableOnly ? { data: null } : await db
    .from("outreach_campaigns")
    .select("stats")
    .eq("kind", "MANUAL")
    .is("launched_by", null)
    .gte("created_at", new Date(Date.now() - 90 * 60_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(2);
  if (reachableOnly && recentTopUps?.length && recentTopUps.every((c) => !((c.stats as { emails_prepared?: number } | null)?.emails_prepared ?? 0))) {
    return { target, sent_before: before, ran: false, reason: "Campagne complémentaire récente sans nouvel e-mail : nouvel essai plus tard" };
  }
  // 1. Entreprises déjà joignables qui correspondent aux opportunités ouvertes des 14 derniers jours
  const reachable = await runManualCampaign(db, { userId: null, budgetMs: Math.min(150_000, deadline - Date.now() - 10_000), reachableOnly: true, lookbackDays: 14 }).catch(
    (e) => (logServerError("outreach top-up (joignables)", e), null),
  );
  const mid = await sentTodayCount(db);
  if (reachableOnly) return { target, sent_before: before, ran: true, sent_after: mid, reachable, run: null };
  // 2. Toujours sous l'objectif : nouvelles entreprises et recherche d'adresses
  const run = mid < target && deadline - Date.now() > 100_000 ? await runManualCampaign(db, { userId: null, budgetMs: deadline - Date.now() - 10_000 }).catch((e) => (logServerError("outreach top-up", e), null)) : null;
  return { target, sent_before: before, ran: true, sent_after: await sentTodayCount(db), reachable, run };
}

/**
 * Campagne lancée à la main (Outreach), autant de fois que voulu dans la journée : opportunités
 * récentes → entreprises → recherche d'adresses → envoi. N'affecte pas la campagne automatique
 * (ni ses opportunités, ni sa limite d'envois). Mêmes garde-fous : exclusions, désinscriptions,
 * délai minimum entre deux e-mails à une même entreprise.
 */
export async function runManualCampaign(db: Db, { userId, budgetMs = 270_000, reachableOnly = false, lookbackDays }: { userId: string | null; budgetMs?: number; reachableOnly?: boolean; lookbackDays?: number }) {
  const deadline = Date.now() + budgetMs;
  const settings = await loadSettings(db);
  const sync = await syncOpportunityStates(db, settings);
  const build = await buildDailyCampaign(db, { manual: { userId, reachableOnly, lookbackDays }, deadline: deadline - (reachableOnly ? 45_000 : 150_000) });
  if (!build.campaignId) return { sync, build, enrichment: null, send: null };
  const enrichment = await enrichProspects(db, { campaignId: build.campaignId, deadline: deadline - 60_000 }).catch((e) => (logServerError("outreach manual enrichment", e), null));
  const { data: c } = await db.from("outreach_campaigns").select("report").eq("id", build.campaignId).single();
  await db
    .from("outreach_campaigns")
    .update({
      report: [c?.report, enrichment ? enrichmentReport(enrichment) : null].filter(Boolean).join("\n"),
      ...(settings.require_validation ? {} : { status: "VALIDATED", validated_at: new Date().toISOString(), validated_by: userId }),
    })
    .eq("id", build.campaignId)
    .eq("status", "READY");
  const send = settings.require_validation ? null : await processSendQueue(db, { deadline });
  return { sync, build, enrichment, send };
}
