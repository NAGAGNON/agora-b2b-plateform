import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { parisDayStart, REPORT_MODEL } from "@/lib/daily-report";
import { reportRecipients } from "@/lib/daily-report-email";
import { sendEmail } from "@/lib/email/send";
import { escapeHtml } from "@/lib/email/templates";
import { siteUrl } from "@/lib/seo";
import { logServerError } from "@/lib/errors";
import { selectAll } from "@/lib/outreach/data";
import type { Json } from "@/lib/database.types";
import {
  fallbackSummary,
  frWeek,
  parisDate,
  unknownNumbers,
  variation,
  weekDays,
  WeeklySummarySchema,
  type WeeklyFacts,
  type WeeklyMetric,
  type WeeklySummary,
} from "@/lib/weekly-review-core";

type DB = ReturnType<typeof createAdminClient>;
const OPENED = ["RESPONSE_PREPARING", "RESPONSE_SENT", "DISCUSSION", "NEGOTIATION", "WON", "LOST"];

/** Chiffres d'une fenêtre [from, to[ — comptes de l'équipe et de démonstration exclus. */
export async function windowNumbers(db: DB, from: Date, to: Date, excluded: Set<string>) {
  const f = from.toISOString();
  const t = to.toISOString();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [users, events, items, questions, needs, emails, companies] = await Promise.all([
    selectAll((a, b) => db.from("users").select("id").gte("created_at", f).lt("created_at", t).order("id").range(a, b)),
    selectAll((a, b) => db.from("analytics_events").select("user_id, event_name, created_at").in("event_name", ["view_opportunity", "view_application"]).gte("created_at", f).lt("created_at", t).order("id").range(a, b)),
    selectAll((a, b) => db.from("pipeline_items").select("id, stage, created_at, work_started_at, companies!inner(is_demo)").eq("companies.is_demo", false).or(`and(created_at.gte.${f},created_at.lt.${t}),and(work_started_at.gte.${f},work_started_at.lt.${t})`).order("id").range(a, b)),
    selectAll((a, b) => db.from("application_questions").select("user_id").gte("created_at", f).lt("created_at", t).order("id").range(a, b)),
    count(db.from("opportunities").select("id", { count: "exact", head: true }).eq("origin", "INTERNAL").eq("is_demo", false).gte("created_at", f).lt("created_at", t)),
    count(db.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "SENT").gte("sent_at", f).lt("sent_at", t)),
    count(db.from("companies").select("id", { count: "exact", head: true }).eq("is_demo", false).gte("created_at", f).lt("created_at", t)),
  ]);
  // Consultations des membres connectés seulement (hors équipe) : les fiches d'offres sont réservées aux
  // membres depuis le 31 octobre 2026 ; les consultations sans compte d'avant (surtout des robots
  // d'indexation, jusqu'à 12 000 par jour) faussaient les totaux sur 30 jours
  const realEvents = events.filter((e) => e.user_id && !excluded.has(e.user_id));
  const newUsers = new Set(users.filter((u) => !excluded.has(u.id)).map((u) => u.id));
  // Membres revenus : venus consulter des offres pendant la période un AUTRE jour (heure de Paris) que
  // celui de leur inscription. Une visite le jour même de l'inscription ne compte pas ; un membre inscrit
  // pendant la période qui revient un jour suivant compte (avant : seuls les inscrits d'avant la période
  // comptaient, si bien que le chiffre baissait quand la période s'allongeait : 3 sur 30 jours, 7 sur 7).
  const ids = [...new Set(realEvents.map((e) => e.user_id as string))];
  const signupDay = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from("users").select("id, created_at").in("id", ids.slice(i, i + 200));
    for (const u of data ?? []) signupDay.set(u.id, parisDate(u.created_at));
  }
  const returning = new Set(
    realEvents.filter((e) => {
      const day = signupDay.get(e.user_id as string);
      return day !== undefined && parisDate(e.created_at) > day;
    }).map((e) => e.user_id as string),
  );
  return {
    inscrits: newUsers.size,
    entreprises: companies,
    revenus: returning.size,
    offres_vues: realEvents.filter((e) => e.event_name === "view_opportunity").length,
    fiches: realEvents.filter((e) => e.event_name === "view_application").length,
    dossiers: items.filter((i) => i.created_at >= f && i.created_at < t && OPENED.includes(i.stage)).length,
    travail: items.filter((i) => i.work_started_at && i.work_started_at >= f && i.work_started_at < t).length,
    questions: questions.filter((q) => !q.user_id || !excluded.has(q.user_id)).length,
    besoins: needs,
    emails,
  };
}

const LABELS: [keyof Awaited<ReturnType<typeof windowNumbers>>, string][] = [
  ["inscrits", "Nouveaux inscrits"],
  ["entreprises", "Entreprises créées"],
  ["revenus", "Membres revenus consulter des offres"],
  ["offres_vues", "Offres consultées"],
  ["fiches", "Fiches de candidature ouvertes"],
  ["dossiers", "Dossiers de candidature ouverts"],
  ["travail", "Candidatures avec travail commencé"],
  ["questions", "Questions posées à l'assistant"],
  ["besoins", "Besoins publiés par les entreprises"],
  ["emails", "E-mails envoyés"],
];

/** Faits de la semaine écoulée et de la semaine d'avant. */
export async function buildWeeklyFacts(now = new Date()): Promise<{ weekStart: string; facts: WeeklyFacts }> {
  const db = createAdminClient();
  const w = weekDays(now);
  const { data: team } = await db.from("users").select("id").or("is_internal.eq.true,is_demo.eq.true");
  const excluded = new Set((team ?? []).map((u) => u.id));
  const [cur, prev] = await Promise.all([
    windowNumbers(db, parisDayStart(w.start), parisDayStart(w.nextMonday), excluded),
    windowNumbers(db, parisDayStart(w.prevStart), parisDayStart(w.start), excluded),
  ]);
  const chiffres: WeeklyMetric[] = LABELS.map(([cle, libelle]) => ({ cle, libelle, semaine: cur[cle], precedente: prev[cle] }));
  return { weekStart: w.start, facts: { semaine: { du: w.start, au: w.end }, precedente: { du: w.prevStart, au: w.prevEnd }, chiffres } };
}

const SYSTEM = `Tu es l'« Analyste du lundi » de LinkProB2B, une plateforme française d'appels d'offres et de besoins entre entreprises (PME, artisans).
Chaque lundi, tu lis les chiffres de la semaine écoulée comparés à la semaine d'avant, et tu écris au fondateur un résumé court, en français très simple (il n'est pas technicien).
Règles absolues :
- N'utilise QUE les chiffres fournis. N'invente aucun chiffre, aucune cause certaine, aucun nom. Si une explication est une hypothèse, dis « peut-être ».
- 3 à 5 constats, du plus important au moins important. Chaque constat cite le chiffre de la semaine et celui de la semaine d'avant. « alerte » pour ce qui demande une attention rapide.
- 1 à 3 actions concrètes et réalistes pour la semaine qui commence, en lien direct avec les constats.
- Phrases courtes, vouvoiement, pas de jargon, pas de mise en forme markdown.`;

/** Rédaction du résumé (Haiku). Résumé de secours calculé si la clé manque, si la réponse échoue ou contient un nombre inconnu. */
async function writeSummary(facts: WeeklyFacts): Promise<{ summary: WeeklySummary; model: string | null; error: string | null }> {
  if (!process.env.ANTHROPIC_API_KEY) return { summary: fallbackSummary(facts), model: null, error: null };
  try {
    const ai = new Anthropic({ timeout: 60_000, maxRetries: 1 });
    const res = await ai.beta.messages.parse({
      model: REPORT_MODEL,
      max_tokens: 3000,
      output_config: { format: betaZodOutputFormat(WeeklySummarySchema) },
      system: SYSTEM,
      messages: [{ role: "user", content: `Chiffres de la semaine ${frWeek(facts.semaine)} (colonne « semaine ») et de la semaine ${frWeek(facts.precedente)} (colonne « precedente ») :\n${JSON.stringify(facts.chiffres)}` }],
    });
    const s = res.parsed_output;
    if (res.stop_reason === "refusal" || !s || !s.points.length) return { summary: fallbackSummary(facts), model: null, error: "Résumé rédigé indisponible : chiffres bruts affichés" };
    const bad = unknownNumbers(s, facts);
    if (bad.length) return { summary: fallbackSummary(facts), model: null, error: `Résumé écarté (nombres non vérifiés : ${bad.join(", ")}) : chiffres bruts affichés` };
    return { summary: { titre: s.titre, points: s.points.slice(0, 5), actions: s.actions.slice(0, 3) }, model: REPORT_MODEL, error: null };
  } catch (e) {
    logServerError("weekly review", e);
    return { summary: fallbackSummary(facts), model: null, error: "Rédaction impossible : chiffres bruts affichés" };
  }
}

/** Prépare (ou met à jour) le bilan de la semaine écoulée. */
export async function generateWeeklyReview(now = new Date()) {
  const { weekStart, facts } = await buildWeeklyFacts(now);
  const { summary, model, error } = await writeSummary(facts);
  const db = createAdminClient();
  const { error: dbError } = await db
    .from("weekly_reviews")
    .upsert({ week_start: weekStart, generated_at: new Date().toISOString(), facts: facts as unknown as NonNullable<Json>, summary: summary as unknown as Json, model, error });
  if (dbError) throw dbError;
  return { weekStart, summary, model, error };
}

export type WeeklyReviewRow = { week_start: string; generated_at: string; facts: WeeklyFacts; summary: WeeklySummary | null; error: string | null; emailed_at: string | null };

const NAVY = "#0F2D4A";
const TONE: Record<string, [string, string]> = { hausse: ["▲", "#0F766E"], baisse: ["▼", "#BE123C"], stable: ["■", "#64748B"], alerte: ["!", "#C2410C"] };
const e = (s: string | number) => escapeHtml(String(s));

/** E-mail du bilan (HTML + texte). */
export function renderWeeklyReviewEmail(row: WeeklyReviewRow) {
  const f = row.facts;
  const s = row.summary ?? fallbackSummary(f);
  const link = `${siteUrl()}/admin`;
  const rows = f.chiffres
    .map((m) => {
      const v = variation(m);
      const d = m.semaine - m.precedente;
      const color = d > 0 ? "#0F766E" : d < 0 ? "#BE123C" : "#64748B";
      const delta = d === 0 ? "=" : `${d > 0 ? "+" : "−"}${Math.abs(d)}${v !== null ? ` (${d > 0 ? "+" : "−"}${Math.abs(v)} %)` : ""}`;
      return `<tr><td style="padding:7px 8px;border-top:1px solid #E2E8F0;font-size:13px;color:#334155">${e(m.libelle)}</td><td style="padding:7px 8px;border-top:1px solid #E2E8F0;font-size:14px;font-weight:700;color:${NAVY};text-align:right">${e(m.semaine)}</td><td style="padding:7px 8px;border-top:1px solid #E2E8F0;font-size:13px;color:#64748B;text-align:right">${e(m.precedente)}</td><td style="padding:7px 8px;border-top:1px solid #E2E8F0;font-size:13px;font-weight:600;color:${color};text-align:right">${e(delta)}</td></tr>`;
    })
    .join("");
  const points = s.points
    .map((p) => {
      const [icon, color] = TONE[p.tendance] ?? TONE.stable;
      return `<tr><td width="22" style="width:22px;vertical-align:top;padding:6px 10px 6px 0;font-size:14px;font-weight:700;color:${color}">${icon}</td><td style="padding:6px 0;font-size:14px;line-height:21px;color:#334155">${e(p.texte)}</td></tr>`;
    })
    .join("");
  const actions = s.actions.length
    ? `<h2 style="margin:24px 0 8px;font-size:16px;color:${NAVY}">À faire cette semaine</h2><ol style="margin:0;padding-left:20px">${s.actions.map((a) => `<li style="margin:0 0 6px;font-size:14px;line-height:21px;color:#334155">${e(a)}</li>`).join("")}</ol>`
    : "";
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;padding:24px;background:#ffffff">
<p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0D9488">Analyste du lundi</p>
<h1 style="margin:0 0 6px;font-size:21px;line-height:28px;color:${NAVY}">${e(s.titre)}</h1>
<p style="margin:0 0 18px;font-size:13px;color:#64748B">Semaine ${e(frWeek(f.semaine))}, comparée à la semaine ${e(frWeek(f.precedente))}. Comptes de l'équipe et de test exclus.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${points}</table>
${actions}
<h2 style="margin:24px 0 8px;font-size:16px;color:${NAVY}">Les chiffres</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><th style="text-align:left;padding:6px 8px;background:#F1F5F9;font-size:12px;color:${NAVY}">Indicateur</th><th style="text-align:right;padding:6px 8px;background:#F1F5F9;font-size:12px;color:${NAVY}">Semaine</th><th style="text-align:right;padding:6px 8px;background:#F1F5F9;font-size:12px;color:${NAVY}">Avant</th><th style="text-align:right;padding:6px 8px;background:#F1F5F9;font-size:12px;color:${NAVY}">Évolution</th></tr>${rows}</table>
<p style="margin:24px 0 0"><a href="${link}" style="display:inline-block;background:${NAVY};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 18px;border-radius:10px">Voir dans l'administration</a></p>
</div>`;
  const text = [
    `Analyste du lundi — ${s.titre}`,
    `Semaine ${frWeek(f.semaine)} (comparée à la semaine ${frWeek(f.precedente)})`,
    "",
    ...s.points.map((p) => `- ${p.texte}`),
    ...(s.actions.length ? ["", "À faire cette semaine :", ...s.actions.map((a, i) => `${i + 1}. ${a}`)] : []),
    "",
    "Les chiffres (semaine / semaine d'avant) :",
    ...f.chiffres.map((m) => `- ${m.libelle} : ${m.semaine} / ${m.precedente}`),
    "",
    link,
  ].join("\n");
  return { subject: `Analyste du lundi : ${s.titre}`.slice(0, 180), html, text };
}

/**
 * Bilan du lundi : préparé puis envoyé une seule fois par semaine (DAILY_REPORT_EMAIL, sinon les
 * super-administrateurs). `force` renvoie l'e-mail même s'il est déjà parti.
 */
export async function sendWeeklyReview({ now = new Date(), force = false }: { now?: Date; force?: boolean } = {}) {
  const db = createAdminClient();
  const weekStart = weekDays(now).start;
  const load = async () => (await db.from("weekly_reviews").select("week_start, generated_at, facts, summary, error, emailed_at").eq("week_start", weekStart).maybeSingle()).data as WeeklyReviewRow | null;
  const existing = await load();
  if (existing?.emailed_at && !force) return { sent: 0, skipped: "Bilan de la semaine déjà envoyé", recipients: [] as string[] };
  await generateWeeklyReview(now);
  const row = await load();
  if (!row) return { sent: 0, skipped: "Bilan de la semaine introuvable", recipients: [] as string[] };
  const to = await reportRecipients();
  if (!to.length) return { sent: 0, skipped: "Aucun destinataire", recipients: [] as string[] };
  if (!force) {
    // Une seule fois par semaine, même si deux passages se chevauchent
    const { data: claimed } = await db.from("weekly_reviews").update({ emailed_at: new Date().toISOString() }).eq("week_start", weekStart).is("emailed_at", null).select("week_start");
    if (!claimed?.length) return { sent: 0, skipped: "Bilan de la semaine déjà envoyé", recipients: [] as string[] };
  }
  const msg = renderWeeklyReviewEmail(row);
  let sent = 0;
  const errors: string[] = [];
  for (const address of to) {
    const r = await sendEmail({ to: address, subject: msg.subject, html: msg.html, text: msg.text, idempotencyKey: `weekly-review-${weekStart}-${address}${force ? `-${Date.now()}` : ""}` });
    if (r.status === "SENT") sent++;
    else if (r.error) errors.push(`${address} : ${r.error}`);
  }
  return { sent, recipients: to, errors };
}

/** Dernier bilan enregistré (administration). */
export async function latestWeeklyReview(): Promise<WeeklyReviewRow | null> {
  const { data } = await createAdminClient().from("weekly_reviews").select("week_start, generated_at, facts, summary, error, emailed_at").order("week_start", { ascending: false }).limit(1).maybeSingle();
  return (data as WeeklyReviewRow | null) ?? null;
}

