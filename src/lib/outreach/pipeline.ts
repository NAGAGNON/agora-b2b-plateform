import "server-only";
import { logServerError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { analyzeOpportunity, contentFingerprint, groupByProspect, scoreMatch, type OpportunityAnalysis, type ProspectInput } from "@/lib/outreach/matching";
import { DISCOVERY_SOURCE, discoverCompanies } from "@/lib/outreach/discovery";
import { buildEmail, loadRecipientBundles, loadReferentials, loadSettings, realSendBlockers, type Db, type OutreachSettings } from "@/lib/outreach/data";
import { sendOutreachEmail } from "@/lib/outreach/send";
import { configuredSearchers, enrichCompany } from "@/lib/outreach/enrich";

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

const DAY = 86_400_000;
const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const today = () => new Date().toISOString().slice(0, 10);

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
  const { data: open } = await db
    .from("outreach_opportunity_states")
    .select("opportunity_id, opportunity:opportunities(status, response_deadline)")
    .in("status", ["NEW", "MODIFIED", "PROCESSED"])
    .limit(5000);
  const expire = (open ?? [])
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
export async function discoverProspects(db: Db, analyses: OpportunityAnalysis[], deadline: number, maxCalls = 25) {
  const pairs: [string, string][] = [];
  for (const a of analyses) {
    if (!a.department) continue;
    for (const naf of [...a.primaryNaf.slice(0, 2), ...a.sectorNaf.slice(0, 1)]) {
      if (!pairs.some(([n, d]) => n === naf && d === a.department)) pairs.push([naf, a.department]);
    }
  }
  if (pairs.length === 0) return { calls: 0, added: 0, errors: 0 };
  const { data: runs } = await db
    .from("outreach_discovery_runs")
    .select("naf_code, department_code, ran_at, error")
    .gte("ran_at", new Date(Date.now() - 30 * DAY).toISOString());
  const fresh = new Set((runs ?? []).filter((r) => !r.error).map((r) => `${r.naf_code}|${r.department_code}`));
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
  "id, name, email, siren, naf_code, naf_label, sectors, activity, services, keywords, department_code, region, intervention_zone, contacts_count, last_clicked_at, last_contacted_at, is_individual_entrepreneur, status";

/** Entreprises candidates pour une opportunité : même activité ET zone compatible. */
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
  const { data, error } = await q.limit(settings.max_prospects_per_opportunity);
  if (error) throw error;
  return data ?? [];
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
  { date = today(), force = false, deadline = Date.now() + 120_000, manual }: { date?: string; force?: boolean; deadline?: number; manual?: { userId: string | null } } = {},
): Promise<BuildResult> {
  const settings = await loadSettings(db);
  const { data: existing } = manual ? { data: null } : await db.from("outreach_campaigns").select("id, status").eq("campaign_date", date).eq("kind", "AUTO").maybeSingle();
  if (existing) {
    const rebuildable = ["BUILDING", "FAILED"].includes(existing.status) || (force && existing.status === "READY");
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
          .gte("first_seen_at", new Date(Date.now() - settings.lookback_days * DAY).toISOString())
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
    const discovery = settings.discovery_enabled ? await discoverProspects(db, analyses, deadline - 30_000) : { calls: 0, added: 0, errors: 0 };

    const [{ data: suppressions }, { data: customers }] = await Promise.all([
      db.from("outreach_suppressions").select("kind, value").limit(100_000),
      db.from("companies").select("siren").not("siren", "is", null).limit(100_000),
    ]);
    const supp = { EMAIL: new Set<string>(), DOMAIN: new Set<string>(), SIREN: new Set<string>() };
    for (const s of suppressions ?? []) supp[s.kind as keyof typeof supp]?.add(s.value.toLowerCase());
    const customerSirens = new Set((customers ?? []).map((c) => c.siren!));

    const analyzed = new Set<string>();
    const prospects = new Map<string, Awaited<ReturnType<typeof candidates>>[number]>();
    const pairs: { prospectId: string; opportunityId: string; score: number; reasons: string[]; deadline: string | null }[] = [];
    const perOpp = new Map<string, number>();
    for (const a of analyses) {
      if (Date.now() > deadline) break;
      const o = opps.find((x) => x.id === a.id)!;
      for (const p of await candidates(db, a, settings)) {
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

    // Historique des contacts (fréquence maximale sur 30 jours)
    const recentCounts = new Map<string, number>();
    for (const part of chunk(groups.map((g) => g.prospectId), 300)) {
      const { data } = await db.from("outreach_recipients").select("prospect_id").in("prospect_id", part).eq("status", "SENT").gte("sent_at", new Date(Date.now() - 30 * DAY).toISOString());
      for (const r of data ?? []) recentCounts.set(r.prospect_id, (recentCounts.get(r.prospect_id) ?? 0) + 1);
    }
    const minGap = Date.now() - settings.min_days_between_contacts * DAY;
    const rows = groups.map((g) => {
      const p = prospects.get(g.prospectId)!;
      const email = p.email?.toLowerCase() ?? null;
      const domain = email?.split("@")[1] ?? null;
      let status = "PENDING";
      if ((p.siren && (supp.SIREN.has(p.siren) || customerSirens.has(p.siren))) || (email && supp.EMAIL.has(email)) || (domain && supp.DOMAIN.has(domain))) status = "SUPPRESSED";
      else if ((p.last_contacted_at && new Date(p.last_contacted_at).getTime() > minGap) || (recentCounts.get(p.id) ?? 0) >= settings.max_contacts_per_30_days) status = "FREQUENCY";
      else if (!email) status = "NO_EMAIL";
      return { campaign_id: campaignId!, prospect_id: g.prospectId, email, score: g.score, reasons: g.reasons, status };
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
      await db.from("outreach_events").insert((inserted ?? []).map((r) => ({ recipient_id: r.id, campaign_id: campaignId!, type: "PREPARED" })));
    }

    // Opportunités traitées : profils ciblés et nombre de correspondances (campagne automatique uniquement)
    for (const a of manual ? [] : analyses) {
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
    };
    const report = [
      manual
        ? `Campagne manuelle du ${formatDate(date)} (${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}) : ${stats.opportunities_eligible} opportunité(s) récente(s) éligible(s) sur ${stats.opportunities_new}.`
        : `Campagne du ${formatDate(date)} : ${stats.opportunities_eligible} opportunité(s) nouvelle(s) éligible(s) sur ${stats.opportunities_new} détectée(s).`,
      `${stats.prospects_analyzed} entreprise(s) analysée(s), ${stats.matches} correspondance(s) d'au moins ${settings.min_score}/100.`,
      `${stats.companies_selected} entreprise(s) sélectionnée(s), ${stats.emails_prepared} e-mail(s) préparé(s), ${stats.no_email} sans adresse e-mail.`,
      stats.excluded_frequency + stats.excluded_suppressed > 0 ? `${stats.excluded_frequency} écartée(s) (fréquence), ${stats.excluded_suppressed} écartée(s) (liste d'exclusion ou déjà utilisatrices).` : null,
      settings.discovery_enabled ? `Découverte : ${stats.discovery_added} entreprise(s) ajoutée(s) (${stats.discovery_calls} requête(s) à la source publique).` : null,
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

/** 11–13. File d'envoi : campagnes validées, dans la limite quotidienne. */
export async function processSendQueue(db: Db, { deadline = Date.now() + 60_000 }: { deadline?: number } = {}) {
  const settings = await loadSettings(db);
  const startOfDay = `${today()}T00:00:00Z`;
  // Limite quotidienne : campagnes automatiques uniquement (les campagnes lancées à la main n'en consomment pas)
  const { count: sentToday } = await db
    .from("outreach_recipients")
    .select("id, campaign:outreach_campaigns!inner(kind)", { count: "exact", head: true })
    .eq("campaign.kind", "AUTO")
    .in("status", ["SENT", "SIMULATED"])
    .gte("sent_at", startOfDay);
  let remaining = Math.max(0, settings.daily_send_cap - (sentToday ?? 0));
  const result = { sent: 0, simulated: 0, failed: 0, remaining_cap: remaining };
  const { data: campaigns } = await db.from("outreach_campaigns").select("id, dry_run, kind").in("status", ["VALIDATED", "SENDING"]).order("campaign_date");
  const ref = await loadReferentials(db);
  const blockers = realSendBlockers(settings);
  for (const c of campaigns ?? []) {
    // Simulation si la campagne a été validée en simulation OU si l'envoi réel n'est pas possible.
    const simulate = c.dry_run || blockers.length > 0;
    const capped = c.kind !== "MANUAL";
    await db.from("outreach_campaigns").update({ status: "SENDING" }).eq("id", c.id);
    while ((!capped || remaining > 0) && Date.now() < deadline) {
      const { data: batch } = await db.from("outreach_recipients").select("id").eq("campaign_id", c.id).in("status", ["PENDING", "QUEUED"]).order("score", { ascending: false }).limit(capped ? Math.min(25, remaining) : 25);
      if (!batch?.length) break;
      const bundles = await loadRecipientBundles(db, batch.map((b) => b.id));
      for (const b of bundles) {
        const now = new Date().toISOString();
        const opps = b.opportunities.filter((o) => !o.excluded && o.status === "PUBLISHED" && (!o.response_deadline || new Date(o.response_deadline).getTime() > Date.now()));
        if (opps.length === 0 || !b.recipient.email) {
          await db.from("outreach_recipients").update({ status: "EXCLUDED", error: "Plus aucune opportunité ouverte", updated_at: now }).eq("id", b.recipient.id);
          continue;
        }
        const email = buildEmail({ ...b, opportunities: opps }, ref);
        if (simulate) {
          await db.from("outreach_recipients").update({ status: "SIMULATED", subject: b.recipient.subject, sent_at: now, updated_at: now }).eq("id", b.recipient.id);
          await db.from("outreach_events").insert({ recipient_id: b.recipient.id, campaign_id: c.id, type: "SIMULATED" });
          result.simulated++;
        } else {
          const r = await sendOutreachEmail({ to: b.recipient.email, subject: email.subject, html: email.html, text: email.text, senderName: settings.sender_name, replyTo: settings.reply_to, unsubscribeUrl: email.urls.unsubscribeOneClick, idempotencyKey: `outreach-${b.recipient.id}` });
          if (r.status === "SENT") {
            await db.from("outreach_recipients").update({ status: "SENT", sent_at: now, provider_id: r.id ?? null, updated_at: now }).eq("id", b.recipient.id);
            await db.from("outreach_prospects").update({ last_contacted_at: now, contacts_count: b.prospect.contacts_count + 1, updated_at: now }).eq("id", b.prospect.id);
            await db.from("outreach_events").insert({ recipient_id: b.recipient.id, campaign_id: c.id, type: "SENT" });
            result.sent++;
          } else {
            await db.from("outreach_recipients").update({ status: r.retryable ? "QUEUED" : "FAILED", error: r.error?.slice(0, 300) ?? null, updated_at: now }).eq("id", b.recipient.id);
            await db.from("outreach_events").insert({ recipient_id: b.recipient.id, campaign_id: c.id, type: "FAILED", meta: { error: r.error ?? null } });
            result.failed++;
            if (r.retryable) break;
          }
        }
        if (capped) remaining--;
      }
    }
    const { count: left } = await db.from("outreach_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).in("status", ["PENDING", "QUEUED"]);
    if (!left) await db.from("outreach_campaigns").update({ status: simulate ? "SIMULATED" : "SENT", sent_at: new Date().toISOString() }).eq("id", c.id);
  }
  result.remaining_cap = remaining;
  return result;
}

/**
 * Recherche des adresses génériques des entreprises sélectionnées sans e-mail
 * (puis des autres entreprises actives), dans la limite quotidienne. Une adresse
 * trouvée rend le destinataire de la campagne en cours « prêt à envoyer », sauf
 * exclusion.
 */
export async function enrichProspects(db: Db, { campaignId = null, deadline = Date.now() + 60_000 }: { campaignId?: string | null; deadline?: number } = {}) {
  const settings = await loadSettings(db);
  const searchers = configuredSearchers();
  const result = { searched: 0, found: 0, no_website: 0, no_email: 0, blocked: 0, errors: 0, skipped: searchers.length === 0 ? "Aucune clé BRAVE_SEARCH_API_KEY ni DROPCONTACT_API_KEY" : null as string | null };
  if (!settings.enrichment_enabled || searchers.length === 0) return result;
  const { count: today } = await db.from("outreach_prospects").select("id", { count: "exact", head: true }).gte("enriched_at", `${today_()}T00:00:00Z`);
  const budget = Math.max(0, settings.enrichment_daily_limit - (today ?? 0));
  if (!budget) return result;
  // Priorité : entreprises de la campagne sans e-mail, puis les autres
  const ids: string[] = [];
  if (campaignId) {
    const { data } = await db.from("outreach_recipients").select("prospect_id").eq("campaign_id", campaignId).eq("status", "NO_EMAIL").order("score", { ascending: false }).limit(budget);
    ids.push(...(data ?? []).map((r) => r.prospect_id));
  }
  const { data: rows } = await db
    .from("outreach_prospects")
    .select("id, name, city, siren, website, enrichment_status")
    .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
    .is("email", null)
    .eq("status", "ACTIVE");
  const queue = (rows ?? []).filter((p) => p.enrichment_status === "PENDING" || p.enrichment_status === "ERROR");
  if (queue.length < budget) {
    const { data: more } = await db
      .from("outreach_prospects")
      .select("id, name, city, siren, website, enrichment_status")
      .is("email", null)
      .eq("status", "ACTIVE")
      .eq("enrichment_status", "PENDING")
      .eq("is_individual_entrepreneur", false)
      .order("updated_at", { ascending: false })
      .limit(budget - queue.length);
    for (const p of more ?? []) if (!queue.some((q) => q.id === p.id)) queue.push(p);
  }
  const { data: supp } = await db.from("outreach_suppressions").select("kind, value").in("kind", ["EMAIL", "DOMAIN"]).limit(100_000);
  const blocked = new Set((supp ?? []).map((s) => s.value.toLowerCase()));
  const work = queue.slice(0, budget);
  const handle = async (p: (typeof work)[number]) => {
    result.searched++;
    const r = await enrichCompany(p, searchers).catch((e) => ({ status: "ERROR" as const, website: null, email: null, source: null, note: e instanceof Error ? e.message.slice(0, 200) : "Erreur" }));
    const now = new Date().toISOString();
    const email = r.email && !blocked.has(r.email) && !blocked.has(r.email.split("@")[1]) ? r.email : null;
    const { error } = await db
      .from("outreach_prospects")
      .update({ enrichment_status: email ? "FOUND" : r.status === "FOUND" ? "NO_EMAIL" : r.status, enriched_at: now, enrichment_note: r.note || null, website: r.website ?? p.website, ...(email ? { email, email_source: r.source } : {}), updated_at: now })
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
    else if (r.status === "ERROR") result.errors++;
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

const ENRICH_CONCURRENCY = 6;

/** Ligne de rapport de la recherche d'adresses (ajoutée au rapport de la campagne). */
export function enrichmentReport(r: Awaited<ReturnType<typeof enrichProspects>>): string {
  if (r.skipped) return `Recherche d'adresses e-mail : non lancée (${r.skipped}).`;
  if (!r.searched) return "Recherche d'adresses e-mail : aucune entreprise à traiter (limite quotidienne atteinte ou toutes déjà recherchées).";
  return `Recherche d'adresses e-mail : ${r.searched} entreprise(s) recherchée(s), ${r.found} adresse(s) trouvée(s) ; ${r.no_website} sans site identifié, ${r.no_email} sans adresse générique publiée, ${r.blocked} site(s) refusant l'exploration, ${r.errors} erreur(s).`;
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

const today_ = () => new Date().toISOString().slice(0, 10);

/**
 * Conversions : une inscription venue d'Outreach dont l'entreprise a souscrit
 * un abonnement payant (actif ou en essai) — calculé à partir des données réelles.
 */
export async function updateConversions(db: Db) {
  const { data: signups } = await db.from("outreach_events").select("recipient_id, campaign_id, user_id").eq("type", "SIGNUP").not("user_id", "is", null).limit(5000);
  const pending = signups ?? [];
  if (!pending.length) return { converted: 0 };
  const { data: done } = await db.from("outreach_recipients").select("id").in("id", pending.map((s) => s.recipient_id!)).not("converted_at", "is", null);
  const already = new Set((done ?? []).map((r) => r.id));
  let converted = 0;
  for (const s of pending.filter((x) => !already.has(x.recipient_id!))) {
    const { data: members } = await db.from("company_members").select("company_id").eq("user_id", s.user_id!);
    const companies = (members ?? []).map((m) => m.company_id);
    if (!companies.length) continue;
    const { count } = await db.from("subscriptions").select("id", { count: "exact", head: true }).in("company_id", companies).in("status", ["active", "trialing"]);
    if (!count) continue;
    const now = new Date().toISOString();
    await db.from("outreach_recipients").update({ converted_at: now }).eq("id", s.recipient_id!).is("converted_at", null);
    await db.from("outreach_events").insert({ recipient_id: s.recipient_id, campaign_id: s.campaign_id, type: "CONVERSION", user_id: s.user_id });
    converted++;
  }
  return { converted };
}

/** Tâche quotidienne complète (appelée par /api/cron/outreach). */
export async function runOutreachDaily(db: Db, { budgetMs = 240_000 }: { budgetMs?: number } = {}) {
  const deadline = Date.now() + budgetMs;
  const settings = await loadSettings(db);
  const sync = await syncOpportunityStates(db, settings);
  const build = await buildDailyCampaign(db, { deadline: deadline - 120_000 });
  const enrichment = await enrichProspects(db, { campaignId: build.campaignId, deadline: deadline - 45_000 }).catch((e) => (logServerError("outreach enrichment", e), null));
  if (build.campaignId && enrichment) {
    const { data: c } = await db.from("outreach_campaigns").select("report").eq("id", build.campaignId).single();
    await db.from("outreach_campaigns").update({ report: [c?.report, enrichmentReport(enrichment)].filter(Boolean).join("\n") }).eq("id", build.campaignId);
  }
  if (build.campaignId && !build.skipped && !settings.require_validation) {
    await db.from("outreach_campaigns").update({ status: "VALIDATED", validated_at: new Date().toISOString() }).eq("id", build.campaignId).eq("status", "READY");
  }
  const send = await processSendQueue(db, { deadline });
  const conversions = await updateConversions(db).catch((e) => (logServerError("outreach conversions", e), { converted: 0 }));
  return { sync, build, enrichment, send, conversions };
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
  return { mode: "contacts" as const, ...(await enrichCampaignAndSend(db, { campaignId: campaign.id, deadline: Date.now() + budgetMs })) };
}

/**
 * Campagne lancée à la main (Outreach), autant de fois que voulu dans la journée : opportunités
 * récentes → entreprises → recherche d'adresses → envoi. N'affecte pas la campagne automatique
 * (ni ses opportunités, ni sa limite d'envois). Mêmes garde-fous : exclusions, désinscriptions,
 * délai minimum entre deux e-mails à une même entreprise.
 */
export async function runManualCampaign(db: Db, { userId, budgetMs = 270_000 }: { userId: string | null; budgetMs?: number }) {
  const deadline = Date.now() + budgetMs;
  const settings = await loadSettings(db);
  const sync = await syncOpportunityStates(db, settings);
  const build = await buildDailyCampaign(db, { manual: { userId }, deadline: deadline - 150_000 });
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
