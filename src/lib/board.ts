import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDailyFacts, parisToday, REPORT_MODEL } from "@/lib/daily-report";
import { boardDecisionToken, type BoardVerdict } from "@/lib/board-token";
import { reportRecipients } from "@/lib/daily-report-email";
import { latestWeeklyReview, windowNumbers } from "@/lib/weekly-review";
import { launchReadiness } from "@/lib/launch-readiness";
import { stripeMode } from "@/lib/billing/stripe";
import { sendEmail } from "@/lib/email/send";
import { escapeHtml } from "@/lib/email/templates";
import { siteUrl } from "@/lib/seo";
import { logServerError } from "@/lib/errors";
import type { Json } from "@/lib/database.types";
import {
  allowedNumbers,
  ArbitrageSchema,
  AUTHOR_LABEL,
  CritiqueSchema,
  DIRECTOR_KEYS,
  DIRECTORS,
  DirectorNoteSchema,
  inventedNumbers,
  noteFactText,
  proposalFactText,
  type Arbitrage,
  type DirectorKey,
  type DirectorNote,
  type Proposal,
} from "@/lib/board-core";

/** Le CEO arbitre avec un modèle plus puissant ; les directeurs et le contradicteur avec Haiku. */
export const BOARD_CEO_MODEL = "claude-sonnet-5-5";
const DAY = 86_400_000;
type DB = ReturnType<typeof createAdminClient>;

/* ------------------------------------------------------------------ */
/* Données du comité                                                   */
/* ------------------------------------------------------------------ */

/** Retire les données personnelles (noms des inscrits) avant de les donner aux agents. */
function scrub(facts: unknown): unknown {
  if (!facts || typeof facts !== "object") return facts;
  const f = structuredClone(facts) as Record<string, unknown>;
  const g = f.google_articles_inscriptions as { inscriptions_du_jour?: Record<string, unknown> } | undefined;
  if (g?.inscriptions_du_jour) delete g.inscriptions_du_jour.liste;
  delete f.besoins_publies;
  // Compteurs nommés sans ambiguïté : un seul chiffre d'inscriptions de référence (comptes créés)
  const v = f.actions_des_visiteurs as Record<string, unknown> | undefined;
  if (v && "inscriptions" in v) {
    v.formulaires_d_inscription_suivis_dans_le_navigateur_indicatif = v.inscriptions;
    delete v.inscriptions;
  }
  const fid = f.fidelite as Record<string, unknown> | null | undefined;
  if (fid && "inscrits_venus_aujourdhui" in fid) {
    fid.membres_deja_inscrits_venus_sur_le_site_aujourdhui = fid.inscrits_venus_aujourdhui;
    delete fid.inscrits_venus_aujourdhui;
  }
  const p = f.plateforme as Record<string, unknown> | undefined;
  if (p && "nouveaux_comptes" in p) {
    p.inscriptions_reference = p.nouveaux_comptes;
    delete p.nouveaux_comptes;
  }
  return f;
}

export type BoardKind = "MATIN" | "SOIR" | "EXCEPTIONNELLE";
export const KIND_LABEL: Record<BoardKind, string> = { MATIN: "Réunion du matin", SOIR: "Réunion du soir", EXCEPTIONNELLE: "Réunion exceptionnelle" };

/** Toutes les données utiles au comité (agrégées, sans nom ni adresse de personne). */
async function boardFacts(db: DB, now: Date, kind: BoardKind) {
  const today = parisToday(now);
  const { data: team } = await db.from("users").select("id").or("is_internal.eq.true,is_demo.eq.true");
  const excluded = new Set((team ?? []).map((u) => u.id));
  const since24 = new Date(now.getTime() - DAY).toISOString();
  const since7 = new Date(now.getTime() - 7 * DAY).toISOString();
  const iso = now.toISOString();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const safe = <T,>(p: Promise<T>, fallback: T) => p.catch((e) => (logServerError("board facts", e), fallback));
  const [report, liveToday, cur, prev, month, weekly, launch, companies, subs, totals, failedEmails, failedRuns, briefs, openOpps, briefsOpen, needsOpen, interests7, favorites7, alerts7, reportsOpen, contactOpen, testimonials] = await Promise.all([
    db.from("daily_reports").select("day, facts").lt("day", today).order("day", { ascending: false }).limit(1).maybeSingle(),
    // Le soir et en réunion exceptionnelle : la journée en cours, en direct
    kind === "MATIN" ? Promise.resolve(null) : safe(buildDailyFacts(now).then(scrub), null),
    windowNumbers(db, new Date(now.getTime() - 7 * DAY), now, excluded),
    windowNumbers(db, new Date(now.getTime() - 14 * DAY), new Date(now.getTime() - 7 * DAY), excluded),
    windowNumbers(db, new Date(now.getTime() - 30 * DAY), now, excluded),
    safe(latestWeeklyReview(), null),
    safe(launchReadiness(now), null),
    db.from("companies").select("plan_code, trial_ends_at, created_at").eq("is_demo", false).eq("status", "ACTIVE"),
    db.from("subscriptions").select("plan_code, status, unit_amount_cents, billing_interval, cancel_at_period_end").in("status", ["active", "trialing", "past_due"]),
    count(db.from("users").select("id", { count: "exact", head: true }).eq("is_internal", false).eq("is_demo", false)),
    count(db.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "FAILED").gte("created_at", since24)),
    count(db.from("source_sync_runs").select("id", { count: "exact", head: true }).neq("status", "SUCCESS").gte("started_at", since24)),
    count(db.from("tender_briefs").select("opportunity_id", { count: "exact", head: true }).gte("created_at", since24)),
    count(db.from("opportunities").select("id", { count: "exact", head: true }).eq("status", "PUBLISHED").eq("is_demo", false).gt("response_deadline", iso)),
    count(db.from("tender_briefs").select("opportunity_id, opportunities!inner(status, response_deadline)", { count: "exact", head: true }).eq("opportunities.status", "PUBLISHED").gt("opportunities.response_deadline", iso)),
    count(db.from("opportunities").select("id", { count: "exact", head: true }).eq("origin", "INTERNAL").eq("status", "PUBLISHED").eq("is_demo", false).gt("response_deadline", iso)),
    count(db.from("interests").select("id", { count: "exact", head: true }).gte("created_at", since7)),
    count(db.from("favorites").select("id", { count: "exact", head: true }).gte("created_at", since7)),
    count(db.from("alerts").select("id", { count: "exact", head: true }).gte("created_at", since7)),
    count(db.from("reports").select("id", { count: "exact", head: true }).eq("status", "OPEN")),
    count(db.from("contact_messages").select("id", { count: "exact", head: true }).eq("handled", false)),
    count(db.from("testimonials").select("id", { count: "exact", head: true })),
  ]);
  const plans: Record<string, number> = {};
  for (const c of companies.data ?? []) plans[c.plan_code ?? "FREE"] = (plans[c.plan_code ?? "FREE"] ?? 0) + 1;
  const inTrial = (companies.data ?? []).filter((c) => c.trial_ends_at && c.trial_ends_at > iso);
  const active = (subs.data ?? []).filter((s) => s.status === "active");
  const monthly = active.reduce((sum, s) => sum + (s.billing_interval === "year" ? (s.unit_amount_cents ?? 0) / 12 : (s.unit_amount_cents ?? 0)), 0);
  return {
    definitions: {
      inscriptions:
        "Chiffre de référence unique : comptes créés, hors comptes de l'équipe et de test (« inscriptions_reference » pour une journée, « inscrits » dans la tendance, « nombre » dans inscriptions_du_jour). « formulaires_d_inscription_suivis_dans_le_navigateur_indicatif » n'est qu'un indicateur de suivi (bloqueurs de publicité, connexions Google) : ne pas l'utiliser comme nombre d'inscriptions. « membres_deja_inscrits_venus_sur_le_site_aujourdhui » compte des visites de membres, pas des inscriptions.",
      periodes: "La tendance compte des jours glissants (les 7 ou 30 derniers jours jusqu'à maintenant) ; le bilan hebdomadaire compte du lundi au dimanche : un écart d'une unité entre les deux est normal.",
      offres_consultees:
        "Consultations de fiches d'offres par des membres connectés, hors équipe. Les consultations sans compte (avant le 31 octobre 2026, surtout des robots d'indexation) ne sont plus comptées.",
    },
    type_de_reunion: KIND_LABEL[kind],
    date: today,
    heure: new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(now),
    journee_en_cours: liveToday ?? "réunion du matin : la journée commence, voir le bilan de la veille",
    bilan_de_la_veille: report.data ? { journee: report.data.day, chiffres: scrub(report.data.facts) } : "indisponible",
    tendance: { "7_derniers_jours": cur, "7_jours_precedents": prev, "30_derniers_jours": month },
    seuils_du_lancement_payant_fixes_par_le_fondateur: launch
      ? { tous_atteints: launch.pret, date_de_reexamen: launch.reexamen, criteres: launch.criteres.map((c) => ({ critere: c.libelle, actuel: c.actuel, seuil: c.seuil, atteint: c.atteint })) }
      : "indisponible",
    dernier_bilan_hebdomadaire: weekly ? { semaine: weekly.facts.semaine, chiffres: weekly.facts.chiffres } : null,
    plateforme: {
      inscrits_au_total: totals,
      entreprises_actives: (companies.data ?? []).length,
      entreprises_creees_7_jours: (companies.data ?? []).filter((c) => c.created_at >= since7).length,
      appels_d_offres_ouverts: openOpps,
      appels_d_offres_ouverts_avec_fiche_synthese_prete: briefsOpen,
      besoins_d_entreprises_ouverts: needsOpen,
      interets_manifestes_7_jours: interests7,
      favoris_ajoutes_7_jours: favorites7,
      alertes_creees_7_jours: alerts7,
      signalements_ouverts: reportsOpen,
      messages_de_contact_non_traites: contactOpen,
      temoignages_recus_au_total: testimonials,
    },
    finances: {
      paiement_stripe: stripeMode() === "live" ? "en production (encaissements réels)" : stripeMode() === "test" ? "en mode test : aucun encaissement réel tant que le fondateur n'a pas lancé le payant" : "non configuré",
      entreprises_par_formule: plans,
      entreprises_en_essai: inTrial.length,
      essais_qui_finissent_sous_3_jours: inTrial.filter((c) => c.trial_ends_at! < new Date(now.getTime() + 3 * DAY).toISOString()).length,
      abonnements_actifs: active.length,
      abonnements_en_essai_stripe: (subs.data ?? []).filter((s) => s.status === "trialing").length,
      paiements_en_echec: (subs.data ?? []).filter((s) => s.status === "past_due").length,
      resiliations_programmees: active.filter((s) => s.cancel_at_period_end).length,
      revenu_mensuel_recurrent_euros: Math.round(monthly / 100),
    },
    technique_dernieres_24_heures: {
      emails_en_echec: failedEmails,
      synchronisations_de_sources_en_echec: failedRuns,
      fiches_synthese_preparees: briefs,
    },
  };
}
export type BoardFacts = Awaited<ReturnType<typeof boardFacts>>;

/** Décisions des 30 derniers jours : la mémoire du comité. */
async function boardMemory(db: DB, now: Date) {
  const { data } = await db
    .from("board_decisions")
    .select("created_at, proposer, decision, status, ceo_reason, founder_comment, metric, target")
    .gte("created_at", new Date(now.getTime() - 30 * DAY).toISOString())
    .order("created_at", { ascending: false })
    .limit(40);
  return (data ?? []).map((d) => ({
    date: d.created_at.slice(0, 10),
    par: d.proposer,
    decision: d.decision,
    statut: d.status,
    raison_du_ceo: d.ceo_reason,
    commentaire_du_fondateur: d.founder_comment,
    indicateur: d.metric,
    cible: d.target,
  }));
}

/* ------------------------------------------------------------------ */
/* Appels aux agents                                                   */
/* ------------------------------------------------------------------ */

const RULES = `Règles absolues de LinkProB2B (plateforme française d'appels d'offres et de besoins entre entreprises, pour PME et artisans) :
- N'utilise QUE les chiffres présents dans les données fournies. N'invente aucun chiffre, aucun client, aucun partenaire, aucun résultat. Si une donnée manque, écris qu'elle manque.
- Une hypothèse se dit « peut-être ». Ne présente jamais une proposition comme une décision prise.
- Contraintes fixées par le fondateur : aucun service payant acheté sans son accord ; aucun e-mail envoyé à des utilisateurs sans sa validation écrite ; aucun e-mail le week-end ; mieux vaut 50 e-mails corrects que 5 000 ; le paiement Stripe reste en mode test tant qu'il ne l'a pas décidé ; ne rien supprimer sans sauvegarde et validation.
- Une proposition doit être réalisable par l'équipe : modification du site, contenu à rédiger, réglage, analyse. Pas de recrutement, pas de dépense sans budget chiffré.
- Ne repropose pas une décision déjà en attente ou refusée par le fondateur dans la mémoire, sauf si des chiffres nouveaux le justifient (dis lesquels). Tiens compte des commentaires du fondateur.
- Français simple, vouvoiement envers le fondateur, phrases courtes, pas de jargon, pas de markdown.`;

function client() {
  return new Anthropic({ timeout: 120_000, maxRetries: 1 });
}

/** Appel structuré ; le CEO utilise le modèle puissant, avec repli serveur en cas de refus. */
async function ask<S extends z.ZodType>(schema: S, system: string, user: string, model: string, maxTokens: number): Promise<z.infer<S> | null> {
  const ai = client();
  const ceo = model === BOARD_CEO_MODEL;
  const res = await ai.beta.messages.parse({
    model,
    max_tokens: maxTokens,
    ...(ceo ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const, output_config: { format: betaZodOutputFormat(schema), effort: "medium" as const } } : { output_config: { format: betaZodOutputFormat(schema) } }),
    system,
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) return null;
  return res.parsed_output as z.infer<S>;
}

/** Note d'un directeur ; une seconde tentative si elle cite un chiffre absent des données, puis filtrage. */
async function directorNote(key: DirectorKey, context: string, allowed: Set<string>): Promise<{ note: DirectorNote; issues: string[] }> {
  const d = DIRECTORS[key];
  const system = `Tu es le ${d.title} (${d.short}) du comité de direction de LinkProB2B. Chaque matin, tu lis les chiffres et tu fais ta note au comité.
Ton domaine : ${d.focus}
Concentre-toi sur ton domaine. Écris un constat, 1 à 4 observations chiffrées, puis 0 à 2 propositions. Zéro proposition est une bonne réponse si rien ne le justifie : ne crée pas de problème pour avoir l'air utile.
${RULES}`;
  let user = context;
  const issues: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    // La réflexion du modèle compte dans la limite : marge large, et une réponse coupée (JSON
    // incomplet) déclenche la seconde tentative au lieu d'arrêter la note
    const note = await ask(DirectorNoteSchema, system, user, REPORT_MODEL, 16000).catch((e) => {
      logServerError(`board ${key} (tentative ${attempt + 1})`, e);
      return undefined;
    });
    if (note === undefined) {
      if (attempt === 0) continue;
      return { note: { constat: "Note indisponible aujourd'hui.", points: [], propositions: [] }, issues: ["réponse illisible deux fois de suite"] };
    }
    if (!note) return { note: { constat: "Note indisponible aujourd'hui.", points: [], propositions: [] }, issues: ["note indisponible"] };
    const bad = [...inventedNumbers(noteFactText(note), allowed), ...note.propositions.flatMap((p) => inventedNumbers(proposalFactText(p), allowed))];
    if (!bad.length) return { note: { ...note, points: note.points.slice(0, 4), propositions: note.propositions.slice(0, 2) }, issues };
    if (attempt === 0) {
      user = `${context}\n\nATTENTION : ta première note citait des nombres absents des données (${[...new Set(bad)].join(", ")}). Réécris-la en n'utilisant que les chiffres fournis.`;
      continue;
    }
    // Seconde tentative encore fautive : on écarte ce qui n'est pas vérifiable
    issues.push(`chiffres non vérifiés écartés (${[...new Set(bad)].join(", ")})`);
    return {
      note: {
        constat: inventedNumbers(note.constat, allowed).length ? "Constat écarté : il citait un chiffre non vérifié." : note.constat,
        points: note.points.filter((p) => !inventedNumbers(p, allowed).length).slice(0, 4),
        propositions: note.propositions.filter((p) => !inventedNumbers(proposalFactText(p), allowed).length).slice(0, 2),
      },
      issues,
    };
  }
  return { note: { constat: "Note indisponible aujourd'hui.", points: [], propositions: [] }, issues: ["note indisponible"] };
}

type Ref = { ref: string; by: DirectorKey; p: Proposal };

async function critiques(refs: Ref[], context: string, allowed: Set<string>) {
  if (!refs.length) return new Map<string, { par: DirectorKey; avis: string; critique: string }>();
  const system = `Tu joues le rôle de contradicteur au comité de direction de LinkProB2B. Pour chaque proposition, le directeur le plus concerné (jamais son auteur) en fait la critique : le DAF conteste les dépenses et l'absence de retour mesurable, le CTO les délais et les risques techniques, le CMO l'impact sur la croissance, le CPO l'intérêt pour les utilisateurs. La critique est honnête : favorable si la proposition est solide, réservée ou défavorable sinon, toujours argumentée et fondée sur les chiffres.
${RULES}`;
  const list = refs.map((r) => ({ ref: r.ref, auteur: r.by, ...r.p }));
  const out = await ask(CritiqueSchema, system, `${context}\n\nPROPOSITIONS DU JOUR :\n${JSON.stringify(list)}`, REPORT_MODEL, 16000).catch((e) => {
    logServerError("board critique", e);
    return null;
  });
  const map = new Map<string, { par: DirectorKey; avis: string; critique: string }>();
  for (const c of out?.critiques ?? []) {
    const r = refs.find((x) => x.ref === c.ref);
    if (!r || map.has(c.ref)) continue;
    const par = c.par === r.by ? (r.by === "DAF" ? "CTO" : "DAF") : c.par;
    map.set(c.ref, { par, avis: c.avis, critique: inventedNumbers(c.critique, allowed).length ? "Critique écartée : elle citait un chiffre non vérifié." : c.critique });
  }
  return map;
}

async function arbitrate(refs: Ref[], notes: Record<string, DirectorNote>, crit: Map<string, { par: DirectorKey; avis: string; critique: string }>, context: string, allowed: Set<string>): Promise<{ arb: Arbitrage; model: string | null }> {
  const system = `Tu es le CEO de LinkProB2B. Chaque matin, tu présides le comité de direction : tu lis les notes des directeurs, leurs propositions et les critiques, puis tu arbitres.
Pour chaque proposition : « a_valider » si elle mérite d'être soumise au fondateur (il décidera), « refusee » si elle n'est pas justifiée, « plus_d_infos » s'il faut des données complémentaires. Tu n'es pas obligé d'être d'accord avec les directeurs ; justifie chaque arbitrage. Ne soumets au fondateur que ce qui en vaut la peine.
Puis écris au fondateur un message court : la situation et ce qui attend sa décision. Le fondateur reste l'autorité supérieure.
${RULES}`;
  const user = `${context}\n\nNOTES DES DIRECTEURS :\n${JSON.stringify(Object.fromEntries(Object.entries(notes).map(([k, n]) => [k, { constat: n.constat, points: n.points }])))}\n\nPROPOSITIONS ET CRITIQUES :\n${JSON.stringify(refs.map((r) => ({ ref: r.ref, auteur: r.by, ...r.p, critique: crit.get(r.ref) ?? null })))}`;
  for (const model of [BOARD_CEO_MODEL, REPORT_MODEL]) {
    try {
      let prompt = user;
      for (let attempt = 0; attempt < 2; attempt++) {
        const arb = await ask(ArbitrageSchema, system, prompt, model, 16000);
        if (!arb) break;
        const bad = inventedNumbers([arb.titre, arb.message_au_fondateur, ...arb.arbitrages.map((a) => a.raison)].join(" "), allowed);
        if (!bad.length) return { arb, model };
        prompt = `${user}\n\nATTENTION : ton premier arbitrage citait des nombres absents des données (${bad.join(", ")}). Réécris-le en n'utilisant que les chiffres fournis.`;
      }
    } catch (e) {
      logServerError(`board ceo ${model}`, e);
    }
  }
  return {
    arb: {
      titre: refs.length ? `${refs.length} proposition${refs.length > 1 ? "s" : ""} au comité ce matin` : "Comité du matin : aucune proposition",
      message_au_fondateur: "L'arbitrage du CEO est indisponible ce matin : les propositions vous sont soumises telles quelles, avec la critique du contradicteur.",
      arbitrages: refs.map((r) => ({ ref: r.ref, verdict: "a_valider" as const, raison: "Arbitrage indisponible : décision laissée au fondateur." })),
    },
    model: null,
  };
}

/* ------------------------------------------------------------------ */
/* Réunion                                                             */
/* ------------------------------------------------------------------ */

const VERDICT_STATUS = { a_valider: "A_VALIDER", refusee: "REFUSEE_CEO", plus_d_infos: "PLUS_INFO" } as const;

/**
 * Réunit le comité : notes des 4 directeurs, critiques, arbitrage du CEO, puis enregistrement intégral
 * (interventions, décisions) et bilan par e-mail. MATIN et SOIR : une fois par jour chacune ;
 * EXCEPTIONNELLE : sur alerte (une fois par jour et par alerte) ou à la demande du fondateur.
 */
export async function runBoard({ now = new Date(), kind, reason = null, alertKey = null, email = true }: { now?: Date; kind: BoardKind; reason?: string | null; alertKey?: string | null; email?: boolean }) {
  if (!process.env.ANTHROPIC_API_KEY) return { skipped: "Clé du service de rédaction absente" };
  const db = createAdminClient();
  const day = parisToday(now);
  const { data: session, error: sErr } = await db.from("board_sessions").insert({ day, kind, alert_key: alertKey, title: reason }).select("id").single();
  if (sErr || !session) {
    if (sErr?.code === "23505") return { skipped: alertKey ? "Réunion déjà tenue aujourd'hui pour cette alerte" : "Le comité s'est déjà réuni" };
    throw sErr ?? new Error("Réunion impossible");
  }
  const sid = session.id;
  try {
    if (reason) await db.from("board_messages").insert({ session_id: sid, author: alertKey ? "SYSTEME" : "FONDATEUR", kind: alertKey ? "SYSTEME" : "FONDATEUR", content: { texte: reason } });
    const [facts, memory] = await Promise.all([boardFacts(db, now, kind), boardMemory(db, now)]);
    const allowed = allowedNumbers(facts, memory);
    const context = `DONNÉES RÉELLES DU JOUR :\n${JSON.stringify(facts)}\n\nMÉMOIRE DU COMITÉ (décisions des 30 derniers jours, commentaires du fondateur) :\n${JSON.stringify(memory)}${reason ? `\n\n${alertKey ? "RÉUNION EXCEPTIONNELLE DÉCLENCHÉE PAR UNE ALERTE" : "RÉUNION DEMANDÉE PAR LE FONDATEUR"}, motif : ${reason}. Traite ce sujet en priorité.` : ""}`;

    // 1. Notes des directeurs (en parallèle)
    const results = await Promise.all(DIRECTOR_KEYS.map(async (k) => [k, await directorNote(k, context, allowed).catch((e) => (logServerError(`board ${k}`, e), { note: { constat: "Note indisponible aujourd'hui.", points: [], propositions: [] }, issues: ["note indisponible"] }))] as const));
    const notes = Object.fromEntries(results.map(([k, r]) => [k, r.note])) as Record<DirectorKey, DirectorNote>;
    const refs: Ref[] = [];
    for (const [k, r] of results) for (const p of r.note.propositions) refs.push({ ref: `P${refs.length + 1}`, by: k, p });

    // 2. Critiques croisées, 3. arbitrage du CEO
    const crit = await critiques(refs, context, allowed);
    const { arb, model } = await arbitrate(refs, notes, crit, context, allowed);

    // 4. Enregistrement intégral
    await db.from("board_messages").insert(
      results.map(([k, r]) => ({
        session_id: sid,
        author: k,
        kind: "NOTE",
        content: { constat: r.note.constat, points: r.note.points, propositions: refs.filter((x) => x.by === k).map((x) => x.ref), controle: r.issues } as unknown as NonNullable<Json>,
      })),
    );
    for (const r of refs) {
      const c = crit.get(r.ref);
      const a = arb.arbitrages.find((x) => x.ref === r.ref) ?? { verdict: "a_valider" as const, raison: "Non arbitrée par le CEO : décision laissée au fondateur." };
      const { data: dec } = await db
        .from("board_decisions")
        .insert({
          session_id: sid,
          proposer: r.by,
          problem: r.p.probleme,
          decision: r.p.decision,
          justification: r.p.justification,
          data_used: r.p.donnees,
          expected: r.p.effet_attendu,
          budget_eur: r.p.budget_eur,
          risks: r.p.risques,
          urgency: r.p.urgence,
          metric: r.p.indicateur,
          target: r.p.cible,
          check_after_days: Math.min(30, Math.max(3, r.p.delai_jours || 7)),
          critic: c?.par ?? null,
          critic_opinion: c?.avis ?? null,
          critique: c?.critique ?? null,
          ceo_verdict: a.verdict,
          ceo_reason: a.raison,
          status: VERDICT_STATUS[a.verdict],
        })
        .select("id")
        .single();
      if (!dec) continue;
      const msgs: { session_id: string; decision_id: string; author: string; kind: string; content: NonNullable<Json> }[] = [];
      if (c) msgs.push({ session_id: sid, decision_id: dec.id, author: c.par, kind: "CRITIQUE", content: { ref: r.ref, avis: c.avis, texte: c.critique } });
      msgs.push({ session_id: sid, decision_id: dec.id, author: "CEO", kind: "ARBITRAGE", content: { ref: r.ref, verdict: a.verdict, texte: a.raison } });
      await db.from("board_messages").insert(msgs);
    }
    await db.from("board_messages").insert({ session_id: sid, author: "CEO", kind: "ARBITRAGE", content: { titre: arb.titre, texte: arb.message_au_fondateur, modele: model } });
    await db.from("board_sessions").update({ status: "DONE", finished_at: new Date().toISOString(), title: arb.titre, ceo_message: arb.message_au_fondateur }).eq("id", sid);
    const mail = email ? await sendBoardEmail(sid).catch((e) => (logServerError("board email", e), { sent: 0, skipped: "Envoi impossible" })) : null;
    return { sessionId: sid, proposals: refs.length, toValidate: arb.arbitrages.filter((a) => a.verdict === "a_valider").length, mail };
  } catch (e) {
    logServerError("board", e);
    await db.from("board_sessions").update({ status: "FAILED", finished_at: new Date().toISOString(), error: e instanceof Error ? e.message.slice(0, 500) : "Erreur" }).eq("id", sid);
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* Bilan par e-mail après chaque réunion                               */
/* ------------------------------------------------------------------ */

const NAVY = "#0F2D4A";
const e = (s: string | number | null | undefined) => escapeHtml(String(s ?? ""));
const URGENCY: Record<string, string> = { haute: "#BE123C", moyenne: "#C2410C", basse: "#64748B" };
const VERDICT_LABEL: Record<string, string> = { a_valider: "soumise à votre validation", refusee: "refusée par le CEO", plus_d_infos: "plus d'infos demandées" };

type DecisionRow = { id: string; proposer: string; decision: string; problem: string; urgency: string; ceo_verdict: string | null; ceo_reason: string | null; critic: string | null; critic_opinion: string | null; critique: string | null; status: string };
type NoteRow = { author: string; content: { constat?: string; points?: string[] } };

const button = (href: string, label: string, bg: string) =>
  `<a href="${href}" style="display:inline-block;margin:0 6px 6px 0;background:${bg};color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;padding:9px 14px;border-radius:9px">${e(label)}</a>`;

export function renderBoardEmail(
  s: { kind: string; title: string | null; ceo_message: string | null; reason: string | null },
  notes: NoteRow[],
  decisions: DecisionRow[],
  olderPending: number,
  now = Date.now(),
) {
  const base = siteUrl();
  const kindLabel = KIND_LABEL[s.kind as BoardKind] ?? "Réunion du comité";
  const decide = (id: string, v: BoardVerdict) => `${base}/comite/decision?t=${encodeURIComponent(boardDecisionToken(id, v, now))}`;
  const toValidate = decisions.filter((d) => d.status === "A_VALIDER");
  const noteHtml = notes
    .map(
      (n) => `<tr><td width="48" style="width:48px;vertical-align:top;padding:8px 10px 8px 0;font-size:12px;font-weight:700;color:#7C3AED;white-space:nowrap">${e(n.author)}</td><td style="padding:8px 0;font-size:13px;line-height:20px;color:#334155">${e(n.content.constat ?? "")}${(n.content.points ?? []).length ? `<br><span style="color:#64748B">${(n.content.points ?? []).map(e).join(" · ")}</span>` : ""}</td></tr>`,
    )
    .join("");
  const card = (d: DecisionRow) => `<div style="border:1px solid #E2E8F0;border-radius:12px;padding:14px 16px;margin:0 0 12px">
<p style="margin:0 0 4px;font-size:12px;color:#64748B">${e(AUTHOR_LABEL[d.proposer] ?? d.proposer)} · urgence <strong style="color:${URGENCY[d.urgency] ?? "#64748B"}">${e(d.urgency)}</strong> · ${e(VERDICT_LABEL[d.ceo_verdict ?? ""] ?? d.status)}</p>
<p style="margin:0 0 6px;font-size:15px;font-weight:700;color:${NAVY}">${e(d.decision)}</p>
<p style="margin:0 0 6px;font-size:13px;color:#334155">${e(d.problem)}</p>
${d.critique ? `<p style="margin:0 0 6px;font-size:13px;color:#475569"><strong>Contradicteur (${e(d.critic)}, ${e(d.critic_opinion)}) :</strong> ${e(d.critique)}</p>` : ""}
${d.ceo_reason ? `<p style="margin:0 0 10px;font-size:13px;color:#475569"><strong>Le CEO :</strong> ${e(d.ceo_reason)}</p>` : ""}
${d.status === "A_VALIDER" ? `<div>${button(decide(d.id, "VALIDEE"), "Valider", "#0F766E")}${button(decide(d.id, "REFUSEE"), "Refuser", "#BE123C")}${button(decide(d.id, "PLUS_INFO"), "Plus d'infos", "#64748B")}</div>` : ""}
</div>`;
  const subject = `${kindLabel} : ${s.title ?? "bilan"}${toValidate.length ? ` · ${toValidate.length} à valider` : ""}`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#ffffff">
<p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7C3AED">Comité de direction · ${e(kindLabel)}</p>
<h1 style="margin:0 0 10px;font-size:21px;line-height:28px;color:${NAVY}">${e(s.title ?? kindLabel)}</h1>
${s.reason ? `<p style="margin:0 0 12px;font-size:13px;color:#BE123C"><strong>Motif :</strong> ${e(s.reason)}</p>` : ""}
${s.ceo_message ? `<p style="margin:0 0 16px;font-size:14px;line-height:21px;color:#334155"><strong>Le CEO :</strong> ${e(s.ceo_message)}</p>` : ""}
<h2 style="margin:18px 0 6px;font-size:16px;color:${NAVY}">Ce que disent les directeurs</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${noteHtml}</table>
<h2 style="margin:20px 0 10px;font-size:16px;color:${NAVY}">${decisions.length ? `Propositions de la réunion (${decisions.length})` : "Aucune proposition à cette réunion"}</h2>
${decisions.map(card).join("")}
${olderPending ? `<p style="margin:0 0 12px;font-size:13px;color:#475569">${olderPending} décision${olderPending > 1 ? "s" : ""} d'une réunion précédente attend${olderPending > 1 ? "ent" : ""} encore votre réponse.</p>` : ""}
<p style="margin:18px 0 0">${button(`${base}/admin/comite`, "Ouvrir le comité", NAVY)}</p>
<p style="margin:12px 0 0;font-size:12px;color:#94A3B8">Rien n'est exécuté sans votre validation. Les boutons ouvrent une page de confirmation. Compte rendu intégral dans l'administration.</p>
</div>`;
  const text = [
    `${kindLabel} — ${s.title ?? ""}`,
    s.reason ? `Motif : ${s.reason}` : "",
    s.ceo_message ? `Le CEO : ${s.ceo_message}` : "",
    "",
    ...notes.map((n) => `${n.author} : ${n.content.constat ?? ""}`),
    "",
    ...decisions.map((d) => `- [${d.urgency}] ${d.decision} (${d.proposer}, ${VERDICT_LABEL[d.ceo_verdict ?? ""] ?? d.status})${d.status === "A_VALIDER" ? `\n  Valider : ${decide(d.id, "VALIDEE")}\n  Refuser : ${decide(d.id, "REFUSEE")}` : ""}`),
    "",
    `${base}/admin/comite`,
  ]
    .filter((l, i, a) => l || a[i - 1])
    .join("\n");
  return { subject: subject.slice(0, 180), html, text };
}

/** Bilan d'une réunion par e-mail (une seule fois par réunion). */
export async function sendBoardEmail(sessionId: string) {
  const db = createAdminClient();
  const { data: s } = await db.from("board_sessions").select("id, kind, title, ceo_message, emailed_at, status, started_at").eq("id", sessionId).maybeSingle();
  if (!s || s.status !== "DONE") return { sent: 0, skipped: "Réunion non terminée" };
  if (s.emailed_at) return { sent: 0, skipped: "Bilan déjà envoyé" };
  const to = await reportRecipients();
  if (!to.length) return { sent: 0, skipped: "Aucun destinataire" };
  const { data: claimed } = await db.from("board_sessions").update({ emailed_at: new Date().toISOString() }).eq("id", s.id).is("emailed_at", null).select("id");
  if (!claimed?.length) return { sent: 0, skipped: "Bilan déjà envoyé" };
  const [{ data: notes }, { data: decisions }, { data: reasonMsg }, { count: pending }] = await Promise.all([
    db.from("board_messages").select("author, content").eq("session_id", s.id).eq("kind", "NOTE").order("id"),
    db.from("board_decisions").select("id, proposer, decision, problem, urgency, ceo_verdict, ceo_reason, critic, critic_opinion, critique, status").eq("session_id", s.id).order("created_at"),
    db.from("board_messages").select("content").eq("session_id", s.id).in("kind", ["SYSTEME", "FONDATEUR"]).order("id").limit(1).maybeSingle(),
    db.from("board_decisions").select("id", { count: "exact", head: true }).eq("status", "A_VALIDER").neq("session_id", s.id),
  ]);
  const reason = (reasonMsg?.content as { texte?: string } | null)?.texte ?? null;
  const msg = renderBoardEmail({ ...s, reason }, (notes ?? []) as NoteRow[], (decisions ?? []) as DecisionRow[], pending ?? 0);
  let sent = 0;
  for (const address of to) {
    const r = await sendEmail({ to: address, subject: msg.subject, html: msg.html, text: msg.text, idempotencyKey: `board-${s.id}-${address}` });
    if (r.status === "SENT") sent++;
  }
  return { sent, recipients: to };
}

/* ------------------------------------------------------------------ */
/* Alertes : réunions exceptionnelles                                  */
/* ------------------------------------------------------------------ */

/**
 * Seuils vérifiés sans intelligence artificielle (gratuit). Chaque alerte franchie déclenche une
 * réunion exceptionnelle, une seule fois par jour et par alerte.
 */
export async function detectBoardAlerts(now = new Date()): Promise<{ key: string; reason: string }[]> {
  const db = createAdminClient();
  const since = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [cron, failedEmails, sentEmails, failedRuns, pastDue, signups48, signupsPrev7, bounces24] = await Promise.all([
    db.from("platform_settings").select("value").eq("key", "private.cron").maybeSingle(),
    count(db.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "FAILED").gte("created_at", since(24))),
    count(db.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "SENT").gte("sent_at", since(24))),
    count(db.from("source_sync_runs").select("id", { count: "exact", head: true }).neq("status", "SUCCESS").gte("started_at", since(24))),
    count(db.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "past_due")),
    count(db.from("users").select("id", { count: "exact", head: true }).eq("is_internal", false).eq("is_demo", false).gte("created_at", since(48))),
    count(db.from("users").select("id", { count: "exact", head: true }).eq("is_internal", false).eq("is_demo", false).gte("created_at", since(9 * 24)).lt("created_at", since(48))),
    count(db.from("outreach_suppressions").select("id", { count: "exact", head: true }).eq("reason", "BOUNCE").gte("created_at", since(24))),
  ]);
  const alerts: { key: string; reason: string }[] = [];
  const c = (cron.data?.value ?? {}) as { failed_steps?: string[]; last_run_at?: string };
  if ((c.failed_steps ?? []).length) alerts.push({ key: "taches-en-echec", reason: `Tâches automatiques en échec au dernier passage : ${(c.failed_steps ?? []).join(", ")}` });
  if (c.last_run_at && Date.parse(c.last_run_at) < now.getTime() - 26 * 3_600_000) alerts.push({ key: "taches-arretees", reason: "La tâche automatique quotidienne n'a pas tourné depuis plus de 26 heures" });
  if (failedEmails >= 10 && failedEmails > sentEmails / 10) alerts.push({ key: "emails-en-echec", reason: `${failedEmails} e-mails en échec sur les dernières 24 heures (${sentEmails} envoyés)` });
  if (bounces24 >= 10) alerts.push({ key: "rebonds", reason: `${bounces24} adresses e-mail inexistantes (rebonds) en 24 heures : risque pour la réputation du domaine` });
  if (failedRuns >= 2) alerts.push({ key: "collecte", reason: `${failedRuns} synchronisations d'appels d'offres en échec sur les dernières 24 heures` });
  if (pastDue > 0) alerts.push({ key: "paiements", reason: `${pastDue} abonnement${pastDue > 1 ? "s" : ""} en défaut de paiement` });
  // Moyenne des 7 jours précédents d'au moins 1 inscrit par jour, et aucun depuis 48 heures
  if (signups48 === 0 && signupsPrev7 >= 7) alerts.push({ key: "inscriptions-a-zero", reason: `Aucune inscription depuis 48 heures, contre ${signupsPrev7} sur les 7 jours précédents` });
  return alerts;
}

/** Vérifie les alertes et réunit le comité pour chacune (une fois par jour et par alerte). */
export async function runBoardAlerts(now = new Date()) {
  const alerts = await detectBoardAlerts(now);
  const done: unknown[] = [];
  // Au plus deux réunions par passage (durée limitée) : les suivantes au passage d'après
  for (const a of alerts.slice(0, 2)) done.push({ alerte: a.key, ...(await runBoard({ now, kind: "EXCEPTIONNELLE", reason: a.reason, alertKey: a.key })) });
  return { alerts: alerts.length, meetings: done };
}

/* ------------------------------------------------------------------ */
/* Réponse du fondateur                                                */
/* ------------------------------------------------------------------ */

const OPEN_FOR_FOUNDER = ["A_VALIDER", "PLUS_INFO", "REFUSEE_CEO", "PROPOSEE"];

/** Enregistre la réponse du fondateur (administration ou lien de l'e-mail) et l'ajoute au compte rendu. */
export async function founderDecide({ decisionId, verdict, comment, founderId, via }: { decisionId: string; verdict: BoardVerdict; comment: string | null; founderId: string | null; via: "admin" | "email" }) {
  const db = createAdminClient();
  const text = comment?.trim().slice(0, 2000) || null;
  const { data, error } = await db
    .from("board_decisions")
    .update({ status: verdict, founder_comment: text, founder_decided_at: new Date().toISOString(), founder_id: founderId, updated_at: new Date().toISOString() })
    .eq("id", decisionId)
    .in("status", OPEN_FOR_FOUNDER)
    .select("id, session_id, decision")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false as const, error: "Cette décision a déjà reçu une réponse ou n'existe plus." };
  await db.from("board_messages").insert({ session_id: data.session_id, decision_id: data.id, author: "FONDATEUR", kind: "FONDATEUR", content: { verdict, texte: text, via } });
  return { ok: true as const, decision: data.decision };
}
