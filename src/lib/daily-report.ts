import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/errors";
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
    .describe("1 à 4 éléments qui ont bien fonctionné (domaine : Audience, Outreach, Référencement naturel, Collecte, Articles, Inscriptions…)"),
  points_faibles: z.array(z.object({ domaine: z.string(), constat: z.string() })).describe("0 à 4 éléments décevants, en panne ou à surveiller"),
  automatique: z
    .array(z.object({ domaine: z.string(), bilan: z.string() }))
    .describe("Bilan de chaque tâche automatique du jour : Collecte des opportunités, Outreach, Référencement naturel, Articles, E-mails et alertes"),
  recommandations: z.array(z.string()).describe("1 à 3 actions concrètes et réalistes pour le propriétaire"),
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

  const [todayW, yesterdayW, weekW, campaign, events, sentToday, discovered, found, runs, newOpps, articles, users, companies, subs, cron, outreachSettings] = await Promise.all([
    db.rpc("audience_window", { p_from: iso, p_to: now.toISOString() }),
    db.rpc("audience_window", { p_from: yStart.toISOString(), p_to: iso }),
    db.rpc("audience_window", { p_from: weekStart.toISOString(), p_to: iso }),
    db.from("outreach_campaigns").select("id, status, stats, report").eq("campaign_date", day).maybeSingle(),
    db.from("outreach_events").select("type").gte("created_at", iso).limit(20_000),
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
    db.from("outreach_settings").select("dry_run, require_validation, daily_send_cap").eq("id", true).maybeSingle(),
  ]);
  if (todayW.error) throw todayW.error;
  const t = todayW.data as unknown as Window;
  const y = yesterdayW.data as unknown as Window | null;
  const w = weekW.data as unknown as Window | null;

  const evCount: Record<string, number> = {};
  for (const e of events.data ?? []) evCount[e.type] = (evCount[e.type] ?? 0) + 1;
  const stats = (campaign.data?.stats ?? {}) as Record<string, number>;
  const cronValue = (cron.data?.value ?? {}) as { last_run_at?: string; failed_steps?: string[] };

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
      limite_envois_par_jour: outreachSettings.data?.daily_send_cap ?? null,
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
    },
    collecte: {
      opportunites_ajoutees_aujourdhui: newOpps,
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
    taches_automatiques: { derniere_execution_tache_quotidienne: cronValue.last_run_at ? `${ymd(new Date(cronValue.last_run_at))} ${hm(new Date(cronValue.last_run_at))}` : null, etapes_en_echec: cronValue.failed_steps ?? [] },
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

async function writeSummary(facts: DailyFacts, correction?: string) {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: REPORT_MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(ReportSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: `Faits de la journée (JSON) :\n\n${JSON.stringify(facts, null, 2)}` + (correction ? `\n\nIMPORTANT : ${correction}` : "") }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error(`Analyse impossible (${response.stop_reason})`);
  return { summary: response.parsed_output, model: response.model };
}

/**
 * Calcule les faits du jour, rédige le bilan et l'enregistre (un bilan par jour, le plus
 * récent remplace le précédent). Sans clé ANTHROPIC_API_KEY, seuls les faits sont enregistrés.
 */
export async function generateDailyReport(now = new Date()) {
  const db = createAdminClient();
  const facts = await buildDailyFacts(now);
  let summary: DailySummary | null = null;
  let model: string | null = null;
  let note: string | null = null;
  let error: string | null = null;
  if (!process.env.ANTHROPIC_API_KEY) error = "ANTHROPIC_API_KEY absente : chiffres affichés sans commentaire.";
  else {
    try {
      ({ summary, model } = await writeSummary(facts));
      let unknown = unknownReportNumbers(summary, facts);
      if (unknown.length) {
        ({ summary, model } = await writeSummary(facts, `une première version contenait des nombres absents des faits (${unknown.join(", ")}). Supprime-les ou remplace-les par des nombres présents dans les faits.`));
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
