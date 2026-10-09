import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/errors";
import { selectAll } from "@/lib/outreach/data";
import { emptySeoSnapshot, type SeoSnapshot } from "@/lib/seo-snapshot";
import type { Json } from "@/lib/database.types";

/**
 * Bilan du jour (Administration → Vue d'ensemble) : les faits sont calculés ici à partir
 * des données réelles (audience, Outreach, collecte, articles, inscriptions, tâches
 * automatiques) ; le texte est rédigé uniquement à partir de ces faits, et chaque nombre
 * du texte est comparé aux faits. Réservé aux administrateurs, jamais affiché publiquement.
 */

export const REPORT_MODEL = "claude-opus-5-5";

export const ReportSchema = z.object({
  titre: z.string().describe("Une phrase qui résume la journée jusqu'ici"),
  resume: z.string().describe("2 à 4 phrases : ce qui s'est passé aujourd'hui et ce qui se passe en ce moment"),
  points_forts: z
    .array(z.object({ domaine: z.string(), constat: z.string() }))
    .describe("1 à 6 éléments qui ont bien fonctionné (domaine : Audience, Outreach, Référencement naturel, Collecte, Articles, Inscriptions…)"),
  points_faibles: z.array(z.object({ domaine: z.string(), constat: z.string() })).describe("0 à 6 éléments décevants, en panne ou à surveiller"),
  automatique: z
    .array(z.object({ domaine: z.string(), bilan: z.string() }))
    .describe("Bilan de chaque tâche automatique du jour : Collecte des opportunités, Outreach, Référencement naturel, Articles, E-mails et alertes"),
  recommandations: z.array(z.string()).describe("1 à 5 actions concrètes et réalistes pour le propriétaire"),
});
export type DailySummary = z.infer<typeof ReportSchema>;

const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
const hm = (d: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(d);

/** Minuit (heure de Paris) du jour donné, en instant UTC. */
export function parisDayStart(day: string): Date {
  const utcMidnight = new Date(`${day}T00:00:00Z`);
  const parisHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(utcMidnight));
  return new Date(utcMidnight.getTime() - parisHour * 3_600_000);
}
export const parisToday = (now = new Date()) => ymd(now);

type Window = {
  visits: number;
  page_views: number;
  avg_duration_s: number;
  pages_per_visit: number;
  bounce_rate: number | null;
  signups: number;
  interests: number;
  proposals: number;
  alerts: number;
  outbound: number;
  searches: number;
  channels: { channel: string; visits: number; pages_per_visit: number; bounce_rate: number }[];
  search_engines: { engine: string; visits: number }[];
  sections: { section: string; views: number; visits: number; avg_duration_s: number }[];
  pages: { path: string; views: number; visits: number; avg_duration_s: number }[];
  landing: { path: string; visits: number; bounce_rate: number }[];
  hourly: { hour: number; visits: number }[];
  daily: { day: string; visits: number; page_views: number; seo: number; outreach: number }[];
};

const channelVisits = (w: Window, prefix: string) => w.channels.filter((c) => c.channel.startsWith(prefix)).reduce((s, c) => s + c.visits, 0);

/** Faits de la journée (heure de Paris), jusqu'à l'instant présent. */
export async function buildDailyFacts(now = new Date()) {
  const db = createAdminClient();
  const day = ymd(now);
  const start = parisDayStart(day);
  const yStart = new Date(start.getTime() - 86_400_000);
  const weekStart = new Date(start.getTime() - 7 * 86_400_000);
  const iso = start.toISOString();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;

  const [{ data: seoRaw }, todayW, yesterdayW, weekW, campaign, events, sentToday, discovered, found, runs, newOpps, articles, users, companies, subs, cron, outreachSettings, manualCampaigns, campaignsToday, sentRows, bounces, oppRows] = await Promise.all([
    db.rpc("seo_snapshot", { p_now: now.toISOString() }),
    db.rpc("audience_window", { p_from: iso, p_to: now.toISOString() }),
    db.rpc("audience_window", { p_from: yStart.toISOString(), p_to: iso }),
    db.rpc("audience_window", { p_from: weekStart.toISOString(), p_to: iso }),
    db.from("outreach_campaigns").select("id, status, stats, report").eq("campaign_date", day).eq("kind", "AUTO").maybeSingle(),
    selectAll((from, to) => db.from("outreach_events").select("type").gte("created_at", iso).order("id").range(from, to)).then((data) => ({ data })),
    count(db.from("outreach_recipients").select("id", { count: "exact", head: true }).eq("status", "SENT").gte("sent_at", iso)),
    count(db.from("outreach_prospects").select("id", { count: "exact", head: true }).gte("created_at", iso)),
    count(db.from("outreach_prospects").select("id", { count: "exact", head: true }).eq("enrichment_status", "FOUND").gte("enriched_at", iso)),
    db.from("source_sync_runs").select("status, fetched, created, updated, errors, source:external_sources(name)").gte("started_at", iso),
    count(db.from("opportunities").select("id", { count: "exact", head: true }).gte("created_at", iso)),
    db.from("articles").select("title, slug").eq("status", "PUBLISHED").gte("published_at", iso),
    count(db.from("users").select("id", { count: "exact", head: true }).gte("created_at", iso)),
    count(db.from("companies").select("id", { count: "exact", head: true }).gte("created_at", iso)),
    db.from("subscriptions").select("plan_code, status").gte("created_at", iso),
    db.from("platform_settings").select("value").eq("key", "private.cron").maybeSingle(),
    db.from("outreach_settings").select("dry_run, require_validation, daily_send_cap, total_daily_send_cap, hourly_send_cap, send_ramp_enabled, send_ramp_target").eq("id", true).maybeSingle(),
    count(db.from("outreach_campaigns").select("id", { count: "exact", head: true }).eq("campaign_date", day).eq("kind", "MANUAL")),
    db.from("outreach_campaigns").select("id, kind, launched_by, status, created_at").eq("campaign_date", day).order("created_at"),
    selectAll((from, to) => db.from("outreach_recipients").select("campaign_id").eq("status", "SENT").gte("sent_at", iso).order("id").range(from, to)).then((data) => ({ data })),
    count(db.from("outreach_suppressions").select("id", { count: "exact", head: true }).eq("reason", "BOUNCE").gte("created_at", iso)),
    selectAll((from, to) => db.from("opportunities").select("sector_slug, region").gte("created_at", iso).order("id").range(from, to)).then((data) => ({ data })),
  ]);
  if (todayW.error) throw todayW.error;
  const t = todayW.data as unknown as Window;
  const y = yesterdayW.data as unknown as Window | null;
  const w = weekW.data as unknown as Window | null;

  const evCount: Record<string, number> = {};
  for (const e of events.data ?? []) evCount[e.type] = (evCount[e.type] ?? 0) + 1;
  const stats = (campaign.data?.stats ?? {}) as Record<string, number>;
  const cronValue = (cron.data?.value ?? {}) as { last_run_at?: string; failed_steps?: string[]; history?: { at: string; passe?: string; failed_steps?: string[] }[] };
  const sentByCampaign: Record<string, number> = {};
  for (const r of sentRows.data ?? []) if (r.campaign_id) sentByCampaign[r.campaign_id] = (sentByCampaign[r.campaign_id] ?? 0) + 1;
  const top = (values: (string | null)[], n = 6) => {
    const m = new Map<string, number>();
    for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([nom, nombre]) => ({ nom, nombre }));
  };
  const os = outreachSettings.data;
  const seo = (seoRaw as unknown as SeoSnapshot | null) ?? emptySeoSnapshot();

  return {
    date: day,
    heure_du_bilan: hm(now),
    audience: {
      aujourdhui: {
        visites: t.visits,
        pages_vues: t.page_views,
        duree_moyenne_secondes: t.avg_duration_s,
        pages_par_visite: t.pages_per_visit,
        taux_de_rebond_pourcent: t.bounce_rate,
        canaux: t.channels.map((c) => ({ canal: c.channel, visites: c.visits })),
        moteurs_de_recherche: t.search_engines.map((e) => ({ moteur: e.engine, visites: e.visits })),
        rubriques: t.sections.slice(0, 8).map((s) => ({ rubrique: s.section, pages_vues: s.views })),
        pages_les_plus_vues: t.pages.slice(0, 8).map((p) => ({ page: p.path, vues: p.views })),
        pages_d_entree: t.landing.slice(0, 5).map((p) => ({ page: p.path, visites: p.visits })),
        heure_la_plus_active: t.visits > 0 ? t.hourly.reduce((a, b) => (b.visits > a.visits ? b : a)).hour : null,
      },
      hier_journee_complete: y ? { visites: y.visits, pages_vues: y.page_views, visites_moteurs_de_recherche: channelVisits(y, "Moteurs"), visites_outreach: channelVisits(y, "Outreach") } : null,
      moyenne_7_derniers_jours: w ? { visites_par_jour: Math.round(w.visits / 7), visites_moteurs_par_jour: Math.round(channelVisits(w, "Moteurs") / 7) } : null,
    },
    actions_des_visiteurs: { inscriptions: t.signups, recherches: t.searches, interets_manifestes: t.interests, reponses_envoyees: t.proposals, alertes_creees: t.alerts, clics_vers_les_sources: t.outbound },
    plateforme: { nouveaux_comptes: users, nouvelles_entreprises: companies, nouveaux_abonnements: (subs.data ?? []).map((s) => ({ formule: s.plan_code, statut: s.status })) },
    outreach: {
      mode: outreachSettings.data ? (outreachSettings.data.dry_run ? "simulation" : outreachSettings.data.require_validation ? "réel avec validation manuelle" : "réel et automatique") : "inconnu",
      limite_envois_par_jour: os?.total_daily_send_cap ?? null,
      limite_envois_par_heure: os?.hourly_send_cap ?? null,
      montee_en_charge: os ? (os.send_ramp_enabled ? `automatique, objectif ${os.send_ramp_target} par jour` : "désactivée") : null,
      campagnes_lancees_manuellement_aujourdhui: manualCampaigns,
      campagnes_du_jour: (campaignsToday.data ?? []).map((c) => ({
        type: c.kind === "AUTO" ? "automatique" : c.launched_by ? "manuelle" : "complémentaire",
        heure: hm(new Date(c.created_at)),
        statut: c.status,
        emails_envoyes: sentByCampaign[c.id] ?? 0,
      })),
      campagne_du_jour: campaign.data ? { statut: campaign.data.status, statistiques: stats, journal: (campaign.data.report ?? "").split("\n").slice(-8) } : null,
      entreprises_decouvertes_aujourdhui: discovered,
      adresses_email_trouvees_aujourdhui: found,
      emails_envoyes_aujourdhui: sentToday,
      ouvertures: evCount.OPEN ?? 0,
      clics: evCount.CLICK ?? 0,
      selections_consultees: evCount.LANDING_VIEW ?? 0,
      inscriptions_venues_d_outreach: evCount.SIGNUP ?? 0,
      desinscriptions: evCount.UNSUBSCRIBE ?? 0,
      echecs_d_envoi: evCount.FAILED ?? 0,
      adresses_inexistantes_rebonds: bounces,
      parcours_vers_les_offres: {
        page_d_acces_affichee: evCount.GATE_VIEW ?? 0,
        clics_creer_un_compte: evCount.GATE_SIGNUP_CLICK ?? 0,
        clics_se_connecter: evCount.GATE_LOGIN_CLICK ?? 0,
        connexions: evCount.LOGIN ?? 0,
        acces_aux_offres: evCount.OFFER_ACCESS ?? 0,
        offres_consultees: evCount.OPPORTUNITY_VIEW ?? 0,
      },
    },
    collecte: {
      opportunites_ajoutees_aujourdhui: newOpps,
      principaux_secteurs: top((oppRows.data ?? []).map((o) => o.sector_slug)),
      principales_regions: top((oppRows.data ?? []).map((o) => o.region)),
      sources: (runs.data ?? []).map((r) => ({
        source: (r.source as { name?: string } | null)?.name ?? "Source",
        statut: r.status,
        recues: r.fetched,
        nouvelles: r.created,
        mises_a_jour: r.updated,
        erreurs: Array.isArray(r.errors) ? r.errors.length : 0,
      })),
    },
    referencement_naturel: {
      visites_depuis_les_moteurs_aujourdhui: channelVisits(t, "Moteurs"),
      articles_publies_aujourdhui: (articles.data ?? []).map((a) => a.title),
      vues_des_analyses: t.sections.find((s) => s.section.startsWith("Analyses"))?.views ?? 0,
      vues_des_pages_regions_secteurs: t.sections.find((s) => s.section.startsWith("Pages régions"))?.views ?? 0,
    },
    google_articles_inscriptions: {
      visites_depuis_google: {
        aujourdhui: seo.google.today,
        hier: seo.google.yesterday,
        sept_derniers_jours: seo.google.last_7_days,
        pages_d_arrivee_aujourdhui: seo.google.landing_today.map((p) => ({ page: p.path, visites: p.visits })),
      },
      articles_publies_hier_et_aujourdhui: seo.articles.map((a) => ({
        titre: a.title,
        publie: a.published === "today" ? "aujourd'hui" : "hier",
        vues_aujourdhui: a.views_today,
        vues_hier: a.views_yesterday,
        vues_totales: a.views_total,
        visiteurs_depuis_google: a.visitors_from_google,
      })),
      inscriptions_du_jour: {
        nombre: seo.signups.today,
        venues_de_la_prospection: seo.signups.from_outreach,
        // Noms : affichés dans l'e-mail uniquement, jamais transmis à la rédaction automatique
        liste: seo.signups.list.map((u) => ({ nom: u.name, entreprise: u.company, heure: hm(new Date(u.at)), via_prospection: u.from_outreach })),
      },
    },
    taches_automatiques: {
      derniere_execution_tache_quotidienne: cronValue.last_run_at ? `${ymd(new Date(cronValue.last_run_at))} ${hm(new Date(cronValue.last_run_at))}` : null,
      etapes_en_echec: cronValue.failed_steps ?? [],
      passages_du_jour: (cronValue.history ?? [])
        .filter((h) => ymd(new Date(h.at)) === day)
        .map((h) => ({ heure: hm(new Date(h.at)), passage: h.passe ?? "matin", etapes_en_echec: h.failed_steps ?? [] })),
    },
  };
}
export type DailyFacts = Awaited<ReturnType<typeof buildDailyFacts>>;

/** Nombres du bilan absents des faits (contrôle anti-invention). */
export function unknownReportNumbers(s: DailySummary, facts: unknown): string[] {
  const allowed = new Set((JSON.stringify(facts).match(/\d+/g) ?? []).map((n) => String(Number(n))));
  const text = [s.titre, s.resume, ...s.points_forts.map((p) => p.constat), ...s.points_faibles.map((p) => p.constat), ...s.automatique.map((a) => a.bilan), ...s.recommandations].join(" ");
  const found = (text.replace(/(\d)[\s  ](?=\d{3}\b)/g, "$1").match(/\d+/g) ?? []).map((n) => String(Number(n)));
  return [...new Set(found.filter((n) => !allowed.has(n)))];
}

const SYSTEM = `Tu es l'analyste de LinkProB2B, plateforme B2B française (marchés publics et privés, mise en relation acheteurs-fournisseurs).
Tu rédiges pour le propriétaire du site, qui n'est pas technicien, un bilan clair et direct de la journée en cours, en français simple.
Règles absolues :
- Utilise UNIQUEMENT les faits fournis (JSON). N'invente aucun chiffre, aucune cause, aucun visiteur, aucune entreprise.
- Chaque nombre que tu écris doit figurer tel quel dans les faits. Écris les nombres en chiffres. Pas de pourcentage calculé par toi.
- Si une donnée vaut 0 ou est absente, dis-le simplement (ex. « aucun e-mail envoyé pour l'instant ») sans dramatiser.
- La journée n'est pas terminée : compare à hier avec prudence (hier = journée complète).
- Dis clairement ce qui a bien marché et ce qui a moins marché : audience, Outreach (prospection par e-mail), référencement naturel (visites venant des moteurs de recherche, articles), collecte des opportunités, inscriptions.
- Dans « automatique », fais le bilan de ce que les tâches automatiques ont réellement fait aujourd'hui, une ligne par domaine.
- Recommandations : concrètes, réalistes, liées aux faits ; pas de promesse de résultat.
- Ton sobre, phrases courtes, pas de jargon (explique « taux de rebond » si tu l'emploies).`;

const FINAL = `C'est le bilan de FIN DE JOURNÉE, envoyé par e-mail au propriétaire : il doit être complet et détaillé.
Couvre chaque domaine (audience et pages, visiteurs venus de Google, vues des articles publiés hier et aujourd'hui, inscriptions du jour, Outreach de bout en bout : campagnes, envois, ouvertures, clics, parcours vers les offres, inscriptions ; collecte des opportunités par source, secteur et région ; référencement naturel et articles ; inscriptions et abonnements ; tâches automatiques passage par passage).
Le résumé peut faire jusqu'à 6 phrases. Les recommandations portent sur demain.`;

/** Faits transmis à la rédaction : sans nom de personne ni d'entreprise inscrite (données personnelles). */
export function factsForModel(facts: DailyFacts) {
  const { nombre, venues_de_la_prospection } = facts.google_articles_inscriptions.inscriptions_du_jour;
  return { ...facts, google_articles_inscriptions: { ...facts.google_articles_inscriptions, inscriptions_du_jour: { nombre, venues_de_la_prospection } } };
}

async function writeSummary(facts: DailyFacts, correction?: string, final = false) {
  // Délai borné : la tâche du soir doit avoir le temps d'envoyer le rapport (limite de 300 s)
  const client = new Anthropic({ timeout: 110_000, maxRetries: 1 });
  const response = await client.beta.messages.parse({
    model: REPORT_MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(ReportSchema) },
    system: final ? `${SYSTEM}\n\n${FINAL}` : SYSTEM,
    messages: [{ role: "user", content: `Faits de la journée (JSON) :\n\n${JSON.stringify(factsForModel(facts), null, 2)}` + (correction ? `\n\nIMPORTANT : ${correction}` : "") }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error(`Analyse impossible (${response.stop_reason})`);
  return { summary: response.parsed_output, model: response.model };
}

/**
 * Calcule les faits du jour, rédige le bilan et l'enregistre (un bilan par jour, le plus
 * récent remplace le précédent). Sans clé ANTHROPIC_API_KEY, seuls les faits sont enregistrés.
 */
export async function generateDailyReport(now = new Date(), { final = false }: { final?: boolean } = {}) {
  const db = createAdminClient();
  const facts = await buildDailyFacts(now);
  let summary: DailySummary | null = null;
  let model: string | null = null;
  let note: string | null = null;
  let error: string | null = null;
  if (!process.env.ANTHROPIC_API_KEY) error = "ANTHROPIC_API_KEY absente : chiffres affichés sans commentaire.";
  else {
    try {
      const started = Date.now();
      ({ summary, model } = await writeSummary(facts, undefined, final));
      let unknown = unknownReportNumbers(summary, facts);
      // Réécriture seulement s'il reste le temps (sinon : nombres signalés « à vérifier »)
      if (unknown.length && Date.now() - started < 100_000) {
        ({ summary, model } = await writeSummary(facts, `une première version contenait des nombres absents des faits (${unknown.join(", ")}). Supprime-les ou remplace-les par des nombres présents dans les faits.`, final));
        unknown = unknownReportNumbers(summary, facts);
      }
      if (unknown.length) note = `Nombres non retrouvés dans les données, à vérifier : ${unknown.join(", ")}`;
    } catch (e) {
      logServerError("daily report", e);
      error = e instanceof Error ? e.message.slice(0, 300) : String(e);
    }
  }
  const row = { day: facts.date, generated_at: now.toISOString(), facts: facts as unknown as NonNullable<Json>, summary: summary as unknown as Json, model, note, error };
  const { error: dbError } = await db.from("daily_reports").upsert(row);
  if (dbError) throw dbError;
  return row;
}
