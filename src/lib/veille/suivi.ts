/**
 * Suivi des inscrits par e-mail : les ramener sur le site sans les submerger.
 *
 * - Accueil (21 premiers jours) : fiche entreprise et logo (J1), alerte (J3), découverte des usages (J6).
 * - Relance des absents : tous les 2 jours la première quinzaine d'absence, puis tous les 3 jours,
 *   puis chaque semaine, puis toutes les 2 semaines ; espacement de 2 semaines si les derniers
 *   messages n'ont jamais été ouverts (réputation de l'adresse d'envoi).
 * - Nouveautés : une fonctionnalité réelle du site par message, jamais deux fois la même.
 * - Personne active (visite il y a moins de 2 jours) hors accueil : aucun message.
 * Un seul e-mail par personne et par jour, veille comprise. Désinscription en un clic dans chaque e-mail.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { escapeHtml } from "@/lib/email/escape";
import { button, callout, heroUrl, note, noteLink, paragraph, sectorBannerUrl, shell, steps } from "@/lib/email/design";
import { parisDayStart, parisToday } from "@/lib/daily-report";
import { clip, renderCards, veilleLinks } from "@/lib/veille/render";
import { criteriaFor, selectOpportunities, type AudienceMember, type VeilleOpportunity } from "@/lib/veille/select";

type DB = SupabaseClient<Database>;
const DAY = 86_400_000;

export type SuiviMember = AudienceMember & {
  created_at: string;
  last_seen_at: string | null;
  has_company: boolean;
  has_logo: boolean;
  profile_complete: boolean;
  has_alert: boolean;
  veille_on: boolean;
  /** L'entreprise a déjà publié au moins un besoin */
  has_need: boolean;
};

export type SuiviStep = "PROFIL" | "ALERTE" | "DECOUVERTE" | "BESOIN" | "RETOUR";

/** Invitation à publier un besoin : tous les 3 jours, tant que l'entreprise n'en a publié aucun. */
export const BESOIN_INTERVAL_DAYS = 3;

/** Historique des envois à une personne (veille et suivi). */
export type SuiviHistory = {
  /** Dernier e-mail de suivi (envoyé ou en attente) */
  lastSuivi: Date | null;
  /** Dernier e-mail, quel qu'il soit */
  lastAny: Date | null;
  steps: Set<string>;
  news: Set<string>;
  /** E-mails de suivi consécutifs jamais ouverts (les plus récents) */
  unopened: number;
  /** Dernière invitation à publier un besoin */
  lastBesoin: Date | null;
};

export const emptyHistory = (): SuiviHistory => ({ lastSuivi: null, lastAny: null, steps: new Set(), news: new Set(), unopened: 0, lastBesoin: null });

/** Nouveautés réelles du site, de la plus récente à la plus ancienne. `when` : à qui elle s'adresse. */
export type SuiviNews = { key: string; title: string; text: string; cta: string; page: string; when?: (m: SuiviMember) => boolean };
export const SUIVI_NEWS: SuiviNews[] = [
  {
    key: "logo-2026-11",
    title: "Votre logo sur LinkProB2B",
    text: "Ajoutez le logo de votre entreprise : il s'affiche sur votre fiche, dans l'annuaire et sur chaque opportunité que vous publiez.",
    cta: "Ajouter mon logo",
    page: "logo",
    when: (m) => m.has_company && !m.has_logo,
  },
  {
    key: "pages-metier-2026-11",
    title: "Les marchés de votre métier, département par département",
    text: "Chaque métier a maintenant sa page dans chaque département : les marchés ouverts près de chez vous, en un coup d'œil.",
    cta: "Voir les marchés près de chez moi",
    page: "opportunites",
  },
  {
    key: "veille-quotidienne-2026-10",
    title: "Vos opportunités chaque matin",
    text: "Activez l'alerte quotidienne : une sélection d'opportunités choisie selon votre secteur et votre zone, uniquement les jours où il y en a.",
    cta: "Activer mon alerte quotidienne",
    page: "quotidien",
    when: (m) => m.frequency !== "DAILY",
  },
  {
    key: "pipeline-2026-10",
    title: "Suivez vos réponses dans votre pipeline",
    text: "Classez les opportunités qui vous intéressent (à étudier, en cours, envoyée, gagnée) et retrouvez-les en un clic.",
    cta: "Ouvrir mon pipeline",
    page: "pipeline",
  },
];

/** Intervalle entre deux relances selon la durée d'absence (en jours). */
export function retourInterval(inactiveDays: number, unopened: number): number {
  const base = inactiveDays < 14 ? 2 : inactiveDays < 30 ? 3 : inactiveDays < 90 ? 7 : 14;
  return unopened >= 6 ? Math.max(base, 14) : base;
}

const daysBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / DAY;

/** Choix du message du jour pour une personne (null : rien aujourd'hui). Fonction pure, testée. */
export function planSuivi(m: SuiviMember, h: SuiviHistory, now: Date): { step: SuiviStep; news: SuiviNews | null } | null {
  // Jamais deux e-mails le même jour (veille comprise) ni deux e-mails de suivi à moins de 20 h d'écart
  if (h.lastAny && daysBetween(h.lastAny, now) < 0.85) return null;
  if (h.lastSuivi && daysBetween(h.lastSuivi, now) < 0.85) return null;
  const age = daysBetween(new Date(m.created_at), now);
  const news = SUIVI_NEWS.find((n) => !h.news.has(n.key) && (!n.when || n.when(m))) ?? null;
  // Accueil : une étape par jour prévu, dans l'ordre, pendant les trois premières semaines
  if (age < 21) {
    // Logo seul manquant : pas d'e-mail (jamais une relance uniquement pour le logo)
    if (age >= 1 && !h.steps.has("PROFIL") && (!m.has_company || !m.profile_complete)) return { step: "PROFIL", news: null };
    if (age >= 3 && !h.steps.has("ALERTE") && !m.has_alert && m.frequency !== "DAILY") return { step: "ALERTE", news: null };
    if (age >= 6 && !h.steps.has("DECOUVERTE")) return { step: "DECOUVERTE", news };
  }
  // Entreprise inscrite sans besoin publié : invitation tous les 3 jours
  if (m.has_company && !m.has_need && age >= 1 && (!h.lastBesoin || daysBetween(h.lastBesoin, now) >= BESOIN_INTERVAL_DAYS - 0.15)) return { step: "BESOIN", news: null };
  // Relance des absents
  const lastSeen = new Date(m.last_seen_at ?? m.created_at);
  const inactive = daysBetween(lastSeen, now);
  if (inactive < 2) return null;
  const since = h.lastSuivi ? daysBetween(h.lastSuivi, now) : Infinity;
  if (since < retourInterval(inactive, h.unopened) - 0.15) return null;
  return { step: "RETOUR", news };
}

export async function loadSuiviSettings(db: DB): Promise<{ enabled: boolean }> {
  const { data } = await db.from("platform_settings").select("value").eq("key", "suivi").maybeSingle();
  return { enabled: true, ...((data?.value ?? {}) as { enabled?: boolean }) };
}

export async function loadSuiviAudience(db: DB): Promise<SuiviMember[]> {
  const { data, error } = await db.rpc("suivi_audience");
  if (error) throw error;
  return ((data ?? []) as Omit<SuiviMember, "consent">[]).map((m) => ({ ...m, consent: "compte" }));
}

/** Historique des 120 derniers jours pour chaque destinataire. */
export async function loadHistories(db: DB, userIds: string[], now: Date): Promise<Map<string, SuiviHistory>> {
  const map = new Map<string, SuiviHistory>();
  const streakDone = new Set<string>();
  const since = new Date(now.getTime() - 120 * DAY).toISOString();
  for (let i = 0; i < userIds.length; i += 200) {
    const { data, error } = await db
      .from("veille_sends")
      .select("user_id, step, news_key, status, sent_at, created_at, opened_at, clicked_at")
      .in("user_id", userIds.slice(i, i + 200))
      .in("status", ["PENDING", "SENDING", "SENT"])
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    if (error) throw error;
    for (const r of data ?? []) {
      const h = map.get(r.user_id) ?? emptyHistory();
      const at = new Date(r.sent_at ?? r.created_at);
      if (!h.lastAny || at > h.lastAny) h.lastAny = at;
      if (r.step) {
        if (!h.lastSuivi || at > h.lastSuivi) h.lastSuivi = at;
        h.steps.add(r.step);
        if (r.step === "BESOIN" && (!h.lastBesoin || at > h.lastBesoin)) h.lastBesoin = at;
        if (r.news_key) h.news.add(r.news_key);
        // Du plus récent au plus ancien : e-mails de suivi consécutifs jamais ouverts
        if (r.status === "SENT" && !streakDone.has(r.user_id)) {
          if (r.opened_at || r.clicked_at) streakDone.add(r.user_id);
          else h.unopened++;
        }
      }
      map.set(r.user_id, h);
    }
  }
  return map;
}

const ITEMS: Record<SuiviStep, number> = { PROFIL: 3, ALERTE: 3, DECOUVERTE: 3, BESOIN: 0, RETOUR: 6 };

/**
 * Prépare le suivi du jour (après les éditions de veille : une personne déjà servie aujourd'hui est ignorée).
 * Idempotent : une campagne « SUIVI » par jour. `max` : nombre d'envois préparés au plus.
 */
export async function buildSuivi(
  db: DB,
  opts: { now?: Date; max: number; loadPool: (days: number) => Promise<VeilleOpportunity[]>; alreadySent: (ids: string[]) => Promise<Map<string, Set<string>>> },
) {
  const now = opts.now ?? new Date();
  const date = parisToday(now);
  const { data: existing } = await db.from("veille_campaigns").select("id").eq("kind", "SUIVI").eq("edition_date", date).maybeSingle();
  if (existing) return { campaignId: existing.id, recipients: 0, created: false, steps: {} };
  const { data: campaign, error } = await db.from("veille_campaigns").insert({ kind: "SUIVI", edition_date: date, status: "BUILDING" }).select("id").single();
  if (error) {
    if (error.code === "23505") return { campaignId: null, recipients: 0, created: false, steps: {} };
    throw error;
  }
  const audience = await loadSuiviAudience(db);
  const histories = await loadHistories(db, audience.map((m) => m.user_id), now);
  // Envois déjà prévus aujourd'hui (veille du jour)
  const { data: today } = await db.from("veille_sends").select("user_id").gte("created_at", parisDayStart(date).toISOString());
  const servedToday = new Set((today ?? []).map((r) => r.user_id));
  const plans = audience
    .filter((m) => !servedToday.has(m.user_id))
    .map((m) => ({ m, plan: planSuivi(m, histories.get(m.user_id) ?? emptyHistory(), now) }))
    .filter((x): x is { m: SuiviMember; plan: NonNullable<ReturnType<typeof planSuivi>> } => x.plan !== null)
    // Accueil d'abord, puis les absents les plus récents (les plus susceptibles de revenir)
    .sort((a, b) => Number(a.plan.step === "RETOUR") - Number(b.plan.step === "RETOUR") || new Date(b.m.last_seen_at ?? b.m.created_at).getTime() - new Date(a.m.last_seen_at ?? a.m.created_at).getTime())
    .slice(0, Math.max(0, opts.max));
  const pool = plans.length ? await opts.loadPool(14) : [];
  const sent = await opts.alreadySent(plans.map((p) => p.m.user_id));
  const rows: Database["public"]["Tables"]["veille_sends"]["Insert"][] = [];
  const steps: Record<string, number> = {};
  for (const { m, plan } of plans) {
    const { criteria, basis } = criteriaFor(m);
    const lastSeen = new Date(m.last_seen_at ?? m.created_at).getTime();
    const fresh = plan.step === "RETOUR" ? pool.filter((o) => o.published_at && new Date(o.published_at).getTime() > lastSeen) : pool;
    let items = selectOpportunities(fresh, criteria, basis, sent.get(m.user_id) ?? new Set(), ITEMS[plan.step]);
    if (!items.length) items = selectOpportunities(pool, criteria, basis, sent.get(m.user_id) ?? new Set(), ITEMS[plan.step]);
    // Rien à montrer (ni annonce, ni nouveauté) : pas d'e-mail vide
    if (plan.step === "RETOUR" && !items.length && !plan.news) continue;
    rows.push({ campaign_id: campaign.id, user_id: m.user_id, email: m.email, opportunity_ids: items.map((o) => o.id), personalized: basis !== null, step: plan.step, news_key: plan.news?.key ?? null });
    steps[plan.step] = (steps[plan.step] ?? 0) + 1;
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
      skipped: audience.length - rows.length,
      note: rows.length ? Object.entries(steps).map(([k, n]) => `${STEP_LABELS[k as SuiviStep]} : ${n}`).join(" · ") : "Personne à relancer aujourd'hui",
      completed_at: rows.length ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaign.id);
  return { campaignId: campaign.id, recipients: rows.length, created: true, steps };
}

export const STEP_LABELS: Record<SuiviStep, string> = { PROFIL: "Accueil — fiche entreprise", ALERTE: "Accueil — alerte", DECOUVERTE: "Accueil — découverte", BESOIN: "Invitation à publier un besoin", RETOUR: "Relance des absents" };

export type SuiviEmailInput = {
  step: SuiviStep;
  base: string;
  token: string;
  member: SuiviMember;
  items: VeilleOpportunity[];
  news: SuiviNews | null;
  /** Nouvelles opportunités correspondant à la personne depuis sa dernière visite */
  newSince: number;
  now: Date;
  sectorLabel: (slug: string) => string;
  typeLabel: (type: string) => string;
};

const link = (base: string, token: string, page: string) => `${base}/api/veille/c?t=${encodeURIComponent(token)}&p=${page}`;

/** Secteur principal lisible de la personne (préférences puis entreprise), pour les objets d'e-mail. */
function mainSector(i: SuiviEmailInput): string | null {
  const s = i.member.sectors[0] ?? i.member.company_sectors[0];
  return s ? i.sectorLabel(s).toLowerCase() : null;
}

function content(i: SuiviEmailInput): { subject: string; kicker: string; title: string; paragraphs: string[]; checklist: string[]; cta: { label: string; page: string } } {
  const first = i.member.full_name?.trim().split(/\s+/)[0] || null;
  const hello = first ? `Bonjour ${first},` : "Bonjour,";
  const company = i.member.company_name;
  const sector = mainSector(i);
  if (i.step === "PROFIL") {
    const missing = [
      !i.member.has_company && "créer la fiche de votre entreprise",
      i.member.has_company && !i.member.profile_complete && "indiquer vos secteurs et décrire votre activité",
      i.member.has_company && !i.member.has_logo && "ajouter votre logo",
    ].filter((x): x is string => Boolean(x));
    return {
      subject: i.member.has_company ? `${first ? `${first}, v` : "V"}otre fiche ${company ?? "entreprise"} est presque prête` : `${first ? `${first}, c` : "C"}réez la fiche de votre entreprise en 2 minutes`,
      kicker: "Bienvenue sur LinkProB2B",
      title: "Faites-vous trouver par les acheteurs",
      paragraphs: [
        hello,
        "Merci de votre inscription. Une fiche entreprise complète vous rend visible dans l'annuaire et permet de vous proposer les opportunités qui correspondent vraiment à votre activité.",
        "Il vous reste à :",
      ],
      checklist: missing,
      cta: { label: i.member.has_company && i.member.profile_complete ? "Ajouter mon logo" : "Compléter ma fiche", page: i.member.has_company && i.member.profile_complete ? "logo" : "entreprise" },
    };
  }
  if (i.step === "ALERTE") {
    return {
      subject: sector ? `Ne ratez plus les marchés ${sector}` : "Ne ratez plus les opportunités qui vous concernent",
      kicker: "Conseil du jour",
      title: "Laissez les opportunités venir à vous",
      paragraphs: [
        hello,
        "Créez une alerte en une minute : choisissez vos secteurs, votre zone et quelques mots-clés, et nous vous prévenons dès qu'une opportunité correspond. Vous pouvez la modifier ou l'arrêter à tout moment.",
        "Pour vous donner une idée, voici des opportunités ouvertes en ce moment :",
      ],
      checklist: [],
      cta: { label: "Créer mon alerte", page: "alertes" },
    };
  }
  if (i.step === "DECOUVERTE") {
    return {
      subject: "3 façons de trouver de nouveaux clients avec LinkProB2B",
      kicker: "Bien utiliser LinkProB2B",
      title: "Ce que vous pouvez faire dès aujourd'hui",
      paragraphs: [hello, "Une semaine que vous êtes inscrit : voici les usages qui apportent le plus de contacts à nos membres."],
      checklist: [
        "Répondre aux opportunités : marchés publics (BOAMP, TED) et besoins publiés par des entreprises, partout en France.",
        "Publier votre besoin : vous recherchez un prestataire ? Décrivez-le, les entreprises intéressées vous répondent.",
        "Soigner votre fiche : les acheteurs consultent l'annuaire pour trouver des fournisseurs près de chez eux.",
      ],
      cta: { label: "Ouvrir mon tableau de bord", page: "tableau" },
    };
  }
  if (i.step === "BESOIN") {
    const variants = [
      `${first ? `${first}, d` : "D"}es prestataires peuvent venir à vous`,
      `Votre prochain fournisseur est peut-être déjà sur LinkProB2B`,
      `Un besoin à pourvoir${company ? ` chez ${company}` : ""} ? Publiez-le gratuitement`,
    ];
    return {
      subject: variants[Math.floor(i.now.getTime() / DAY) % variants.length],
      kicker: "Gagnez du temps sur vos achats",
      title: "Publiez votre besoin, les entreprises vous répondent",
      paragraphs: [
        hello,
        "Vous cherchez un prestataire, un sous-traitant ou un fournisseur ? Au lieu de démarcher vous-même, décrivez votre besoin en quelques minutes sur LinkProB2B.",
        "Dès sa validation, nous le présentons aux entreprises inscrites dont l'activité correspond, et nous allons chercher pour vous d'autres entreprises concernées. Vous recevez leurs réponses directement dans votre messagerie.",
      ],
      checklist: [
        "Gratuit : jusqu'à 5 besoins actifs avec l'offre gratuite.",
        "Ciblé : seules les entreprises du bon métier et de la bonne zone sont contactées.",
        "Sans engagement : vous choisissez librement avec qui échanger.",
      ],
      cta: { label: "Publier mon besoin", page: "publier" },
    };
  }
  const n = i.newSince;
  const where = i.member.regions[0] ?? i.member.company_region;
  const variants = [
    n > 1 ? `${n} nouvelles opportunités${sector ? ` ${sector}` : ""} depuis votre dernière visite` : null,
    first ? `${first}, de nouveaux marchés vous attendent sur LinkProB2B` : null,
    where ? `Nouvelles opportunités en ${where}${sector ? ` : ${sector}` : ""}` : null,
    "Ça fait un moment ! Voici ce que vous avez manqué",
  ].filter((x): x is string => Boolean(x));
  // Objet différent d'une relance à l'autre (selon le jour)
  const subject = variants[Math.floor(i.now.getTime() / DAY) % variants.length];
  return {
    subject,
    kicker: "Depuis votre dernière visite",
    title: n > 1 ? `${n} nouvelles opportunités pour vous` : "De nouvelles opportunités pour vous",
    paragraphs: [
      hello,
      n > 1
        ? `Depuis votre dernière visite, ${n} opportunités${sector ? ` dans votre secteur (${sector})` : ""} ont été publiées sur LinkProB2B. Voici notre sélection, vérifiée ce matin (toujours ouvertes).`
        : "Voici une sélection d'opportunités ouvertes qui pourraient vous intéresser, vérifiées ce matin.",
    ],
    checklist: [],
    cta: { label: "Voir toutes les opportunités", page: "opportunites" },
  };
}

/** E-mail de suivi (HTML adapté au mobile + texte). Aucune donnée inventée : annonces et chiffres réels uniquement. */
export function renderSuiviEmail(i: SuiviEmailInput): { subject: string; html: string; text: string } {
  const c = content(i);
  const L = veilleLinks(i.base, i.token);
  const cta = link(i.base, i.token, c.cta.page);
  const sector = i.member.sectors[0] ?? i.member.company_sectors[0] ?? null;
  const reason = "Vous recevez cet e-mail car vous avez un compte LinkProB2B. Nous vous écrivons au plus une fois par jour, et seulement s'il y a du nouveau pour vous.";
  const html = shell({
    base: i.base,
    subject: c.subject,
    preheader: i.items.length ? clip(i.items[0].title, 90) : c.title,
    kicker: c.kicker,
    title: c.title,
    heroImage: sector ? sectorBannerUrl(i.base, sector) : heroUrl(i.base, "meridiens"),
    body:
      c.paragraphs.map(paragraph).join("") +
      steps(c.checklist) +
      button(c.cta.label, cta) +
      (i.items.length ? renderCards(i.items, L.item, i) : "") +
      (i.news ? callout({ kicker: "Nouveau sur LinkProB2B", title: i.news.title, text: i.news.text, cta: { label: i.news.cta, url: link(i.base, i.token, i.news.page) } }) : ""),
    notes: note(escapeHtml(reason)) + note(`${noteLink("Gérer mes préférences", L.prefs)} · ${noteLink("Ne plus recevoir ces e-mails", L.unsubscribe)}`),
    pixelUrl: i.token !== "apercu" ? L.pixel : null,
  });
  const text = [
    c.title,
    "",
    ...c.paragraphs,
    ...c.checklist.map((x) => `• ${x}`),
    "",
    `${c.cta.label} : ${cta}`,
    "",
    ...i.items.flatMap((o) => [`• ${o.title}`, `  ${L.item(o.id)}`]),
    ...(i.news ? ["", `Nouveau sur LinkProB2B — ${i.news.title}`, i.news.text, `${i.news.cta} : ${link(i.base, i.token, i.news.page)}`] : []),
    "",
    reason,
    `Gérer mes préférences : ${L.prefs}`,
    `Ne plus recevoir ces e-mails : ${L.unsubscribe}`,
    "LinkProB2B — www.linkprob2b.com",
  ].join("\n");
  return { subject: c.subject, html, text };
}

