import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/seo";
import { logServerError } from "@/lib/errors";
import type { Json } from "@/lib/database.types";
import { mergeNames } from "@/lib/article-figures";

/**
 * Analyses de marché rédigées automatiquement à partir des opportunités réellement
 * publiées sur la plateforme. Le modèle ne reçoit QUE le jeu de faits calculé ici et
 * n'a pas le droit d'en sortir ; chaque chiffre de l'article est ensuite comparé à ce
 * jeu de faits. Un article non conforme reste en brouillon pour relecture humaine.
 */

export const ARTICLE_MODEL = "claude-opus-5-5";
const MIN_OPPORTUNITIES = 5;

export type ArticleBody = z.infer<typeof ArticleSchema>;

export const ArticleSchema = z.object({
  title: z.string().describe("Titre SEO, 50 à 70 caractères, avec le thème et la zone"),
  description: z.string().describe("Méta-description, 120 à 160 caractères"),
  intro: z.string().describe("Chapeau de 2 à 3 phrases"),
  sections: z
    .array(z.object({ heading: z.string(), paragraphs: z.array(z.string()) }))
    .describe("3 à 5 sections, chacune de 1 à 3 paragraphes"),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })).describe("2 à 4 questions fréquentes"),
});

type Opp = {
  id: string;
  title: string;
  type: string;
  origin: string;
  external_buyer_name: string | null;
  city: string | null;
  department_code: string | null;
  sector_slug: string | null;
  response_deadline: string | null;
  published_at: string | null;
};

type TopicKind = "secteur" | "departement" | "secteur-departement" | "acheteur" | "bretagne";
type Topic = {
  key: string;
  kind: TopicKind;
  /** Thème lisible, ex. « Secteur : Informatique » */
  theme: string;
  /** Page de la plateforme correspondante (chemin) */
  page: string;
  opps: Opp[];
};

const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Europe/Paris" });
const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function countBy<T>(items: T[], key: (t: T) => string | null | undefined, label: (k: string) => string = (k) => k, limit = 8) {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k, count]) => ({ name: label(k), count }));
}

async function loadContext() {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const [opps, sectors, departments, types, existing] = await Promise.all([
    db
      .from("opportunities")
      .select("id, title, type, origin, external_buyer_name, city, department_code, sector_slug, response_deadline, published_at")
      .eq("status", "PUBLISHED")
      .eq("visibility", "PUBLIC")
      .eq("is_demo", false)
      .or(`response_deadline.is.null,response_deadline.gt.${now}`)
      .limit(5000),
    db.from("sectors").select("slug, label"),
    db.from("departments").select("code, name, slug"),
    db.from("opportunity_types").select("code, label"),
    db.from("articles").select("topic_key"),
  ]);
  if (opps.error) throw opps.error;
  return {
    opps: (opps.data ?? []) as Opp[],
    sectors: new Map((sectors.data ?? []).map((s) => [s.slug, s.label])),
    departments: new Map((departments.data ?? []).map((d) => [d.code, d])),
    types: new Map((types.data ?? []).map((t) => [t.code as string, t.label])),
    used: new Set((existing.data ?? []).map((a) => a.topic_key)),
  };
}

const buyerKey = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function groupBy(opps: Opp[], key: (o: Opp) => string | null | undefined) {
  const m = new Map<string, Opp[]>();
  for (const o of opps) {
    const k = key(o);
    if (k) m.set(k, [...(m.get(k) ?? []), o]);
  }
  return m;
}

/**
 * Thèmes disponibles, des plus fournis aux moins fournis, en alternant les familles
 * (secteur, département, secteur × département, acheteur) : chacun au plus une fois
 * par mois, avec au moins 5 opportunités ouvertes. En dernier recours, la synthèse
 * bretonne du jour (un thème par date) garantit au moins un article quotidien.
 */
export function candidateTopics(ctx: Awaited<ReturnType<typeof loadContext>>, now = new Date()): Topic[] {
  const month = now.toISOString().slice(0, 7);
  const day = now.toISOString().slice(0, 10);
  const families: Topic[][] = [[], [], [], []];
  for (const [slug, opps] of groupBy(ctx.opps, (o) => o.sector_slug)) {
    const label = ctx.sectors.get(slug);
    if (label && opps.length >= MIN_OPPORTUNITIES) families[0].push({ key: `secteur:${slug}:${month}`, kind: "secteur", theme: `Secteur : ${label}`, page: `/opportunites/${slug}`, opps });
  }
  for (const [code, opps] of groupBy(ctx.opps, (o) => o.department_code)) {
    const d = ctx.departments.get(code);
    if (d && opps.length >= MIN_OPPORTUNITIES) families[1].push({ key: `departement:${code}:${month}`, kind: "departement", theme: `Département : ${d.name}`, page: `/opportunites/${d.slug}`, opps });
  }
  for (const [k, opps] of groupBy(ctx.opps, (o) => (o.sector_slug && o.department_code ? `${o.sector_slug}|${o.department_code}` : null))) {
    const [slug, code] = k.split("|");
    const label = ctx.sectors.get(slug);
    const d = ctx.departments.get(code);
    if (label && d && opps.length >= MIN_OPPORTUNITIES)
      families[2].push({ key: `secteur-departement:${slug}:${code}:${month}`, kind: "secteur-departement", theme: `Secteur : ${label} — Département : ${d.name}`, page: `/opportunites?secteur=${slug}&departement=${code}`, opps });
  }
  for (const [k, opps] of groupBy(ctx.opps, (o) => (o.external_buyer_name ? buyerKey(o.external_buyer_name) : null))) {
    if (opps.length < MIN_OPPORTUNITIES) continue;
    const name = opps.map((o) => o.external_buyer_name!).find((n) => n !== n.toUpperCase()) ?? opps[0].external_buyer_name!;
    families[3].push({ key: `acheteur:${k.replace(/ /g, "-").slice(0, 60)}:${month}`, kind: "acheteur", theme: `Acheteur public : ${name}`, page: `/opportunites?q=${encodeURIComponent(name)}`, opps });
  }
  const queues = families.map((f) => f.filter((t) => !ctx.used.has(t.key)).sort((a, b) => b.opps.length - a.opps.length));
  // Alternance des familles : secteur, département, croisement, acheteur, secteur…
  const ordered: Topic[] = [];
  while (queues.some((q) => q.length)) for (const q of queues) if (q.length) ordered.push(q.shift()!);
  const daily: Topic = { key: `bretagne:${day}`, kind: "bretagne", theme: "Bretagne : marchés publics ouverts", page: "/opportunites", opps: ctx.opps };
  if (!ctx.used.has(daily.key) && ctx.opps.length >= MIN_OPPORTUNITIES) ordered.push(daily);
  return ordered;
}

function buildFacts(t: Topic, ctx: Awaited<ReturnType<typeof loadContext>>) {
  const base = siteUrl();
  const in30 = Date.now() + 30 * 86400_000;
  const week = Date.now() - 7 * 86400_000;
  const upcoming = [...t.opps]
    .filter((o) => o.response_deadline)
    .sort((a, b) => a.response_deadline!.localeCompare(b.response_deadline!))
    .slice(0, 10);
  const bySector = t.kind !== "secteur" && t.kind !== "secteur-departement";
  const byDept = t.kind !== "departement" && t.kind !== "secteur-departement";
  return {
    theme: t.theme,
    zone: "Bretagne (pilote LinkProB2B)",
    periode: t.kind === "bretagne" ? dateFmt.format(new Date()) : monthFmt.format(new Date()),
    date_des_donnees: dateFmt.format(new Date()),
    opportunites_ouvertes: t.opps.length,
    dont_marches_publics_externes: t.opps.filter((o) => o.origin === "EXTERNAL").length,
    // Omis lorsqu'il vaut 0 (évite les tournures du type « aucun besoin (0) »)
    dont_besoins_publies_par_des_entreprises: t.opps.filter((o) => o.origin === "INTERNAL").length || undefined,
    publiees_ces_7_derniers_jours: t.opps.filter((o) => o.published_at && Date.parse(o.published_at) > week).length || undefined,
    date_limite_dans_les_30_jours: t.opps.filter((o) => o.response_deadline && Date.parse(o.response_deadline) < in30).length,
    par_type: countBy(t.opps, (o) => o.type, (k) => ctx.types.get(k) ?? k),
    par_secteur: bySector ? countBy(t.opps, (o) => o.sector_slug, (k) => ctx.sectors.get(k) ?? k) : undefined,
    par_departement: byDept && !bySector ? countBy(t.opps, (o) => o.department_code, (k) => ctx.departments.get(k)?.name ?? k) : undefined,
    principaux_acheteurs: t.kind === "acheteur" ? undefined : mergeNames(countBy(t.opps, (o) => o.external_buyer_name, undefined, 20), 6),
    prochaines_dates_limites: upcoming.map((o) => ({
      intitule: o.title,
      acheteur: o.external_buyer_name,
      ville: o.city,
      date_limite: dateFmt.format(new Date(o.response_deadline!)),
      lien: `${base}/opportunites/${o.id}`,
    })),
    page_de_la_plateforme: `${base}${t.page}`,
    sources: "BOAMP (Licence Ouverte 2.0) et TED (Office des publications de l'UE), collectés et dédupliqués par LinkProB2B ; besoins publiés par des entreprises inscrites.",
  };
}

/** Chiffres de l'article absents du jeu de faits (hors années courantes). */
export function unknownNumbers(article: ArticleBody, facts: unknown): string[] {
  const allowed = new Set((JSON.stringify(facts).match(/\d+/g) ?? []).map((n) => String(Number(n))));
  const text = [article.title, article.description, article.intro, ...article.sections.flatMap((s) => [s.heading, ...s.paragraphs]), ...article.faq.flatMap((f) => [f.question, f.answer])].join(" ");
  const found = (text.replace(/(\d)[\s  ](?=\d{3}\b)/g, "$1").match(/\d+/g) ?? []).map((n) => String(Number(n)));
  return [...new Set(found.filter((n) => !allowed.has(n)))];
}

const SYSTEM = `Tu es rédacteur pour LinkProB2B, plateforme B2B qui met en relation acheteurs et fournisseurs en Bretagne et recense les marchés publics (BOAMP, TED).
Tu écris en français, pour des dirigeants de PME et des responsables commerciaux, des analyses courtes, utiles et sobres.
Règles absolues :
- Utilise UNIQUEMENT les faits fournis. N'invente aucun chiffre, montant, pourcentage, date, nom d'acheteur, tendance ou comparaison avec une autre période.
- Chaque nombre écrit dans l'article doit figurer tel quel dans les faits. Écris les nombres en chiffres.
- Si une information n'est pas dans les faits, ne l'évoque pas.
- Pas de conseil juridique personnalisé ; des conseils pratiques généraux pour répondre à un marché sont permis, sans chiffres.
- Ton neutre et factuel, pas de superlatifs ni de promesses.
- Mentionne que les données proviennent de BOAMP et TED et qu'elles sont à jour à la date indiquée.
- N'écris aucune adresse web : les liens sont ajoutés automatiquement sous l'article.
- Des graphiques (répartition, principaux acheteurs) et une couverture sont générés automatiquement à partir des mêmes faits : commente-les en mots, sans tableau.`;

async function writeArticle(facts: ReturnType<typeof buildFacts>, correction?: string) {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: ARTICLE_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(ArticleSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Rédige une analyse de marché de 500 à 800 mots à partir de ces faits (JSON) :\n\n${JSON.stringify(facts, null, 2)}\n\nLa liste détaillée des opportunités sera affichée automatiquement sous l'article : cite au plus 3 d'entre elles dans le texte.` +
          (correction ? `\n\nIMPORTANT : ${correction}` : ""),
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error(`Rédaction impossible (${response.stop_reason})`);
  return { article: response.parsed_output, model: response.model };
}

type Outcome = { topic: string; status: "PUBLISHED" | "DRAFT" | "ERROR"; slug?: string; note?: string };

/** Rédige un article sur un thème ; une seconde rédaction corrige les chiffres non retrouvés. */
async function writeTopic(t: Topic, ctx: Awaited<ReturnType<typeof loadContext>>, autoPublish: boolean): Promise<Outcome> {
  const db = createAdminClient();
  const facts = buildFacts(t, ctx);
  let { article, model } = await writeArticle(facts);
  let unknown = unknownNumbers(article, facts);
  if (unknown.length) {
    ({ article, model } = await writeArticle(
      facts,
      `une première version contenait des nombres absents des faits (${unknown.join(", ")}). Supprime-les ou remplace-les par des nombres présents dans les faits.`,
    ));
    unknown = unknownNumbers(article, facts);
  }
  const lengthOk = article.title.length >= 10 && article.title.length <= 160 && article.description.length >= 30 && article.description.length <= 300;
  const note = unknown.length ? `Chiffres absents des données : ${unknown.join(", ")}` : lengthOk ? null : "Titre ou description hors limites";
  const publish = autoPublish && !note;
  const year = new Date().toISOString().slice(0, 4);
  const base = slugify(article.title);
  let slug = base.includes(year) ? base : `${base}-${t.key.split(":").at(-1)}`;
  const insert = (s: string) =>
    db.from("articles").insert({
      slug: s,
      topic_key: t.key,
      title: article.title.slice(0, 160),
      description: article.description.slice(0, 300).padEnd(30, "."),
      body: article as unknown as NonNullable<Json>,
      facts: facts as unknown as NonNullable<Json>,
      status: publish ? "PUBLISHED" : "DRAFT",
      published_at: publish ? new Date().toISOString() : null,
      validation_note: note,
      model,
    });
  let { error } = await insert(slug);
  if (error?.code === "23505" && error.message.includes("slug")) {
    slug = `${base}-${t.key.split(":").at(-1)}-${Date.now().toString(36).slice(-4)}`;
    ({ error } = await insert(slug));
  }
  if (error) throw error;
  return { topic: t.key, status: publish ? "PUBLISHED" : "DRAFT", slug, note: note ?? undefined };
}

/**
 * Génère des articles jusqu'à en avoir `count` publiés (ou `count` brouillons si la
 * publication automatique est désactivée). Un thème en échec ou bloqué par le contrôle
 * des chiffres est remplacé par le suivant, dans la limite de `count + 3` tentatives.
 */
export async function generateArticles(count: number, opts: { autoPublish: boolean }) {
  if (!process.env.ANTHROPIC_API_KEY) return { skipped: "ANTHROPIC_API_KEY absente" };
  if (count <= 0) return { generated: [] as Outcome[] };
  const ctx = await loadContext();
  const topics = candidateTopics(ctx);
  const results: Outcome[] = [];
  const done = () => results.filter((r) => r.status === (opts.autoPublish ? "PUBLISHED" : "DRAFT")).length;
  for (const t of topics) {
    if (done() >= count || results.length >= count + 3) break;
    try {
      results.push(await writeTopic(t, ctx, opts.autoPublish));
    } catch (e) {
      logServerError(`article ${t.key}`, e);
      results.push({ topic: t.key, status: "ERROR", note: e instanceof Error ? e.message : String(e) });
    }
  }
  return { generated: results };
}

/** Étape de la tâche quotidienne : au moins un article publié par jour (réglable dans Administration → Articles). */
export async function runDailyArticles() {
  const db = createAdminClient();
  const { data } = await db.from("platform_settings").select("value").eq("key", "seo").maybeSingle();
  const s = (data?.value ?? {}) as { articles_enabled?: boolean; articles_auto_publish?: boolean; articles_per_day?: number };
  if (s.articles_enabled === false) return { skipped: "désactivé" };
  const autoPublish = s.articles_auto_publish !== false;
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  // Avec publication automatique, seuls les articles publiés aujourd'hui comptent : un brouillon ne remplit pas le quota.
  let q = db.from("articles").select("id", { count: "exact", head: true });
  q = autoPublish ? q.gte("published_at", since.toISOString()) : q.gte("created_at", since.toISOString());
  const { count } = await q;
  const perDay = Math.min(3, Math.max(1, s.articles_per_day ?? 1));
  return generateArticles(perDay - (count ?? 0), { autoPublish });
}
