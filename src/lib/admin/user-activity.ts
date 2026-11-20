import type { createAdminClient } from "@/lib/supabase/admin";
import { regionBySlug } from "@/lib/geo";

/**
 * Journal d'activité d'un ou plusieurs inscrits pour l'administration : tout ce que la personne a fait
 * sur le site (consultations, recherches, candidatures, questions, messages, publications…), dans l'ordre.
 * Uniquement des faits enregistrés ; le contenu des messages privés n'est pas affiché.
 */
type Db = ReturnType<typeof createAdminClient>;

export type ActivityKind = "view" | "search" | "application" | "question" | "message" | "publish" | "account" | "save" | "click" | "campaign";
export type ActivityItem = { at: string; kind: ActivityKind; label: string; detail?: string | null; href?: string | null };

type Props = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

const STAGE_LABEL: Record<string, string> = {
  QUALIFIED: "à l'étude",
  INTERESTED: "gardée pour plus tard",
  RESPONSE_PREPARING: "en préparation",
  RESPONSE_SENT: "réponse déposée",
  DISCUSSION: "en discussion",
  NEGOTIATION: "en négociation",
  WON: "gagnée",
  LOST: "non retenue",
};
const JOURNAL_LABEL: Record<string, string> = { NOTE: "A ajouté une note", START: "A commencé à préparer sa réponse", STEP: "A franchi une étape", SENT: "A déposé sa réponse", WON: "A gagné le marché", LOST: "N'a pas été retenu" };
const ANSWER_LABEL: Record<string, string> = { INTERESTED: "« Oui, à suivre »", PREPARING: "« Oui, me guider »", SENT: "« J'ai déjà répondu »", NO: "« Non »" };

const EVENT_LABEL: Record<string, [ActivityKind, string]> = {
  view_opportunity: ["view", "A consulté une offre"],
  view_application: ["application", "A ouvert sa fiche de candidature"],
  view_company: ["view", "A consulté une fiche entreprise"],
  search_opportunities: ["search", "A cherché des offres"],
  search_companies: ["search", "A cherché dans l'annuaire"],
  source_outbound_clicked: ["click", "A ouvert l'avis officiel (site de l'acheteur)"],
  save_favorite: ["save", "A mis en favori"],
  create_account: ["account", "A créé son compte"],
  create_company: ["account", "A créé sa fiche entreprise"],
  profile_completed: ["account", "A complété sa fiche entreprise"],
  create_alert: ["save", "A créé une alerte e-mail"],
  publish_opportunity: ["publish", "A publié un besoin"],
  need_message_click: ["message", "A cliqué pour écrire à l'auteur d'un besoin"],
  need_share_click: ["click", "A partagé un besoin"],
  cta_click: ["click", "A cliqué sur un bouton"],
  contact_company: ["message", "A contacté une entreprise"],
};

export async function getUserActivity(db: Db, userIds: string[], since: string, sectorLabels: Record<string, string> = {}) {
  const out = new Map<string, ActivityItem[]>(userIds.map((id) => [id, []]));
  if (!userIds.length) return out;
  const { data: members } = await db.from("company_members").select("user_id, company_id").in("user_id", userIds);
  const userCompanies = [...new Set((members ?? []).map((m) => m.company_id))];
  const [events, journal, questions, prompts, messages, published, boosts] = await Promise.all([
    db.from("analytics_events").select("user_id, event_name, properties, created_at").in("user_id", userIds).gte("created_at", since).order("created_at").limit(10000),
    db.from("application_journal").select("user_id, kind, body, opportunity_id, created_at").in("user_id", userIds).gte("created_at", since).limit(2000),
    db.from("application_questions").select("user_id, question, opportunity_id, created_at").in("user_id", userIds).gte("created_at", since).limit(2000),
    db.from("application_prompts").select("user_id, answer, opportunity_id, created_at").in("user_id", userIds).gte("created_at", since).limit(2000),
    db.from("messages").select("sender_user_id, conversation_id, created_at").in("sender_user_id", userIds).gte("created_at", since).limit(2000),
    db.from("opportunities").select("id, created_by, title, created_at").in("created_by", userIds).eq("origin", "INTERNAL").gte("created_at", since).limit(500),
    userCompanies.length
      ? db.from("visibility_boosts").select("id, company_id, ad_title, created_at").in("company_id", userCompanies).gte("created_at", since).limit(500)
      : Promise.resolve({ data: [] as { id: string; company_id: string; ad_title: string | null; created_at: string }[] }),
  ]);

  // Titres des offres et noms des entreprises cités, en une requête chacun
  const oppIds = new Set<string>();
  const companyIds = new Set<string>();
  for (const e of events.data ?? []) {
    const p = (e.properties ?? {}) as Props;
    if (str(p.opportunity_id)) oppIds.add(p.opportunity_id as string);
    if (str(p.company_id)) companyIds.add(p.company_id as string);
  }
  for (const r of [...(journal.data ?? []), ...(questions.data ?? []), ...(prompts.data ?? [])]) if (r.opportunity_id) oppIds.add(r.opportunity_id);
  const convIds = [...new Set((messages.data ?? []).map((m) => m.conversation_id))];
  const [opps, convs] = await Promise.all([
    oppIds.size ? db.from("opportunities").select("id, title").in("id", [...oppIds].slice(0, 1000)) : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    convIds.length ? db.from("conversations").select("id, buyer_company_id, supplier_company_id, opportunity_id").in("id", convIds) : Promise.resolve({ data: [] as { id: string; buyer_company_id: string; supplier_company_id: string; opportunity_id: string | null }[] }),
  ]);
  for (const c of convs.data ?? []) {
    companyIds.add(c.buyer_company_id);
    companyIds.add(c.supplier_company_id);
  }
  const { data: companies } = companyIds.size
    ? await db.from("companies").select("id, name, slug").in("id", [...companyIds].slice(0, 1000))
    : { data: [] as { id: string; name: string; slug: string | null }[] };
  const title = new Map((opps.data ?? []).map((o) => [o.id, o.title]));
  const company = new Map((companies ?? []).map((c) => [c.id, c.name]));
  const slug = new Map((companies ?? []).map((c) => [c.id, c.slug]));
  const conv = new Map((convs.data ?? []).map((c) => [c.id, c]));
  const myCompanies = new Map<string, Set<string>>();
  for (const m of members ?? []) myCompanies.set(m.user_id, (myCompanies.get(m.user_id) ?? new Set()).add(m.company_id));
  const offer = (id: string | null | undefined) => (id ? { detail: title.get(id) ?? null, href: `/opportunites/${id}` } : {});
  const push = (uid: string | null, item: ActivityItem) => uid && out.get(uid)?.push(item);

  for (const e of events.data ?? []) {
    const p = (e.properties ?? {}) as Props;
    const [kind, base] = EVENT_LABEL[e.event_name] ?? ["click", e.event_name.replace(/_/g, " ")];
    let label = base;
    let extra: Partial<ActivityItem> = offer(str(p.opportunity_id));
    if (e.event_name.startsWith("search_")) {
      const parts = [
        p.has_query ? "avec mots-clés" : null,
        str(p.sector) ? (sectorLabels[p.sector as string] ?? (p.sector as string)) : null,
        str(p.region) ? (regionBySlug(p.region as string)?.name ?? (p.region as string)) : null,
        str(p.department) ? `dép. ${p.department}` : null,
        str(p.city) ? `ville ${p.city}` : null,
        p.origin === "INTERNAL" ? "besoins d'entreprises seulement" : p.origin === "EXTERNAL" ? "marchés publics seulement" : null,
        str(p.types) ? `${String(p.types).split(",").length} type(s) d'offre cochés` : null,
        str(p.size) ? `taille ${p.size}` : null,
        typeof p.skills === "number" ? `${p.skills} compétence(s)` : null,
      ].filter(Boolean);
      const results = typeof p.results === "number" ? ` → ${p.results} résultat${p.results > 1 ? "s" : ""}` : "";
      // Recherche vide : ce que le site a proposé à la place (mesuré depuis le 19/11)
      const proposed = p.results === 0 && "nearby" in p ? (str(p.nearby) ? ` · offres proches proposées : ${p.nearby}` : " · aucune offre proche trouvée") : "";
      extra = { detail: `${parts.length ? parts.join(" · ") : "sans filtre"}${results}${proposed}` };
    } else if (e.event_name === "view_company" && str(p.company_id)) {
      extra = { detail: company.get(p.company_id as string) ?? null, href: slug.get(p.company_id as string) ? `/entreprises/${slug.get(p.company_id as string)}` : null };
    } else if (e.event_name === "save_favorite") {
      label = p.target === "company" ? "A mis une entreprise en favori" : "A mis une offre en favori";
    } else if (e.event_name === "view_application" && str(p.stage)) {
      extra = { ...extra, detail: `${title.get(p.opportunity_id as string) ?? "Offre"} · ${STAGE_LABEL[p.stage as string] ?? p.stage}` };
    } else if (e.event_name === "cta_click" && str(p.cta)) {
      extra = { detail: `${p.cta}${str(p.path) ? ` (page ${p.path})` : ""}` };
    }
    push(e.user_id, { at: e.created_at, kind, label, ...extra });
  }
  for (const j of journal.data ?? []) push(j.user_id, { at: j.created_at, kind: "application", label: JOURNAL_LABEL[j.kind] ?? "A mis à jour sa candidature", ...offer(j.opportunity_id) });
  for (const q of questions.data ?? []) push(q.user_id, { at: q.created_at, kind: "question", label: `A demandé à l'assistant : « ${q.question.slice(0, 160)} »`, ...offer(q.opportunity_id) });
  for (const a of prompts.data ?? []) push(a.user_id, { at: a.created_at, kind: "application", label: `A répondu ${ANSWER_LABEL[a.answer] ?? a.answer} à « Allez-vous répondre ? »`, ...offer(a.opportunity_id) });
  for (const m of messages.data ?? []) {
    const c = conv.get(m.conversation_id);
    const mine = (m.sender_user_id && myCompanies.get(m.sender_user_id)) || new Set<string>();
    const other = c ? (mine.has(c.buyer_company_id) ? c.supplier_company_id : c.buyer_company_id) : null;
    push(m.sender_user_id, { at: m.created_at, kind: "message", label: "A envoyé un message", detail: other ? `à ${company.get(other) ?? "une entreprise"}` : null });
  }
  for (const o of published.data ?? []) {
    // L'événement « publish_opportunity » existe déjà pour les publications récentes : pas de doublon
    const dup = (events.data ?? []).some((e) => e.event_name === "publish_opportunity" && (e.properties as Props)?.opportunity_id === o.id);
    if (!dup) push(o.created_by, { at: o.created_at, kind: "publish", label: "A publié un besoin", detail: o.title, href: `/opportunites/${o.id}` });
  }
  // Campagne : rattachée aux membres de l'entreprise qui l'a lancée
  for (const b of boosts.data ?? [])
    for (const m of members ?? []) if (m.company_id === b.company_id) push(m.user_id, { at: b.created_at, kind: "campaign", label: "Campagne de visibilité créée pour son entreprise", detail: b.ad_title });

  for (const list of out.values()) list.sort((a, b) => b.at.localeCompare(a.at));
  return out;
}

/** Résumé court d'une liste d'actions (« 5 offres vues · 2 recherches · 1 question »). */
export function activitySummary(items: ActivityItem[]): string {
  const count = (k: ActivityKind) => items.filter((i) => i.kind === k).length;
  const parts: [number, string, string][] = [
    [count("view"), "consultation", "consultations"],
    [count("search"), "recherche", "recherches"],
    [count("application"), "action candidature", "actions candidature"],
    [count("question"), "question", "questions"],
    [count("message"), "message", "messages"],
    [count("publish"), "besoin publié", "besoins publiés"],
    [count("save"), "favori ou alerte", "favoris ou alertes"],
    [count("click"), "clic", "clics"],
  ];
  const s = parts.filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n > 1 ? many : one}`);
  return s.length ? s.join(" · ") : "Navigation sans action enregistrée";
}

/**
 * Fidélité d'un inscrit, à partir des jours de visite enregistrés (un jour = au moins une page vue connecté) :
 * nombre de jours différents où il est venu, et nombre de jours de suite jusqu'à sa dernière visite.
 */
export type Loyalty = { days: number; streak: number; lastDay: string | null };

export async function getLoyalty(db: Db, userIds: string[]): Promise<Map<string, Loyalty>> {
  const out = new Map<string, Loyalty>(userIds.map((id) => [id, { days: 0, streak: 0, lastDay: null }]));
  if (!userIds.length) return out;
  const { data } = await db.from("user_visits").select("user_id, day").in("user_id", userIds).order("day", { ascending: false }).limit(20000);
  const byUser = new Map<string, string[]>();
  for (const r of data ?? []) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.day]);
  for (const [id, days] of byUser) out.set(id, loyaltyFromDays(days));
  return out;
}

/** Jours de visite (« AAAA-MM-JJ », dans n'importe quel ordre) → nombre de jours et jours de suite jusqu'au dernier. */
export function loyaltyFromDays(input: string[]): Loyalty {
  const days = [...new Set(input)].sort().reverse();
  if (!days.length) return { days: 0, streak: 0, lastDay: null };
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    if (Date.parse(`${days[i - 1]}T00:00:00Z`) - Date.parse(`${days[i]}T00:00:00Z`) === 86_400_000) streak++;
    else break;
  }
  return { days: days.length, streak, lastDay: days[0] };
}

/** « 4e jour de visite · 3 jours de suite » (rien pour un premier jour). */
export function loyaltyLabel(l: Loyalty | undefined): string | null {
  if (!l || l.days < 2) return l?.days === 1 ? "1er jour de visite" : null;
  return `${l.days}e jour de visite${l.streak >= 2 ? ` · ${l.streak} jours de suite` : ""}`;
}
