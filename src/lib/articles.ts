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
};

type Topic = { key: string; kind: "secteur" | "departement"; label: string; slug: string; opps: Opp[] };

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
      .select("id, title, type, origin, external_buyer_name, city, department_code, sector_slug, response_deadline")
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

/** Thèmes possibles ce mois-ci (secteur ou département ayant assez d'opportunités réelles), du plus fourni au moins fourni. */
function candidateTopics(ctx: Awaited<ReturnType<typeof loadContext>>): Topic[] {
  const month = new Date().toISOString().slice(0, 7);
  const topics: Topic[] = [];
  const bySector = new Map<string, Opp[]>();
  const byDept = new Map<string, Opp[]>();
  for (const o of ctx.opps) {
    if (o.sector_slug) bySector.set(o.sector_slug, [...(bySector.get(o.sector_slug) ?? []), o]);
    if (o.department_code) byDept.set(o.department_code, [...(byDept.get(o.department_code) ?? []), o]);
  }
  for (const [slug, opps] of bySector) {
    const label = ctx.sectors.get(slug);
    if (label && opps.length >= MIN_OPPORTUNITIES) topics.push({ key: `secteur:${slug}:${month}`, kind: "secteur", label, slug, opps });
  }
  for (const [code, opps] of byDept) {
    const d = ctx.departments.get(code);
    if (d && opps.length >= MIN_OPPORTUNITIES) topics.push({ key: `departement:${code}:${month}`, kind: "departement", label: d.name, slug: d.slug, opps });
  }
  return topics.filter((t) => !ctx.used.has(t.key)).sort((a, b) => b.opps.length - a.opps.length);
}

function buildFacts(t: Topic, ctx: Awaited<ReturnType<typeof loadContext>>) {
  const base = siteUrl();
  const in30 = Date.now() + 30 * 86400_000;
  const upcoming = [...t.opps]
    .filter((o) => o.response_deadline)
    .sort((a, b) => a.response_deadline!.localeCompare(b.response_deadline!))
    .slice(0, 10);
  return {
    theme: t.kind === "secteur" ? `Secteur : ${t.label}` : `Département : ${t.label}`,
    zone: "Bretagne (pilote LinkProB2B)",
    periode: monthFmt.format(new Date()),
    date_des_donnees: dateFmt.format(new Date()),
    opportunites_ouvertes: t.opps.length,
    dont_marches_publics_externes: t.opps.filter((o) => o.origin === "EXTERNAL").length,
    // Omis lorsqu'il vaut 0 (évite les tournures du type « aucun besoin (0) »)
    dont_besoins_publies_par_des_entreprises: t.opps.filter((o) => o.origin === "INTERNAL").length || undefined,
    date_limite_dans_les_30_jours: t.opps.filter((o) => o.response_deadline && Date.parse(o.response_deadline) < in30).length,
    par_type: countBy(t.opps, (o) => o.type, (k) => ctx.types.get(k) ?? k),
    par_departement: t.kind === "secteur" ? countBy(t.opps, (o) => o.department_code, (k) => ctx.departments.get(k)?.name ?? k) : undefined,
    par_secteur: t.kind === "departement" ? countBy(t.opps, (o) => o.sector_slug, (k) => ctx.sectors.get(k) ?? k) : undefined,
    principaux_acheteurs: mergeNames(countBy(t.opps, (o) => o.external_buyer_name, undefined, 20), 6),
    prochaines_dates_limites: upcoming.map((o) => ({
      intitule: o.title,
      acheteur: o.external_buyer_name,
      ville: o.city,
      date_limite: dateFmt.format(new Date(o.response_deadline!)),
      lien: `${base}/opportunites/${o.id}`,
    })),
    page_de_la_plateforme: `${base}/opportunites/${t.slug}`,
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

async function writeArticle(facts: ReturnType<typeof buildFacts>) {
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
        content: `Rédige une analyse de marché de 500 à 800 mots à partir de ces faits (JSON) :\n\n${JSON.stringify(facts, null, 2)}\n\nLa liste détaillée des opportunités sera affichée automatiquement sous l'article : cite au plus 3 d'entre elles dans le texte.`,
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error(`Rédaction impossible (${response.stop_reason})`);
  return { article: response.parsed_output, model: response.model };
}

/** Génère jusqu'à `count` articles. Retourne le détail pour le journal de la tâche planifiée. */
export async function generateArticles(count: number, opts: { autoPublish: boolean }) {
  if (!process.env.ANTHROPIC_API_KEY) return { skipped: "ANTHROPIC_API_KEY absente" };
  const ctx = await loadContext();
  const topics = candidateTopics(ctx).slice(0, Math.max(0, count));
  const db = createAdminClient();
  const results: { topic: string; status: string; slug?: string; note?: string }[] = [];
  for (const t of topics) {
    try {
      const facts = buildFacts(t, ctx);
      const { article, model } = await writeArticle(facts);
      const unknown = unknownNumbers(article, facts);
      const lengthOk = article.title.length >= 10 && article.title.length <= 160 && article.description.length >= 30 && article.description.length <= 300;
      const note = unknown.length ? `Chiffres absents des données : ${unknown.join(", ")}` : lengthOk ? null : "Titre ou description hors limites";
      const publish = opts.autoPublish && !note;
      const month = t.key.split(":").at(-1)!;
      const base = slugify(article.title);
      const slug = base.includes(month.slice(0, 4)) ? base : `${base}-${month}`;
      const { error } = await db.from("articles").insert({
        slug,
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
      if (error) throw error;
      results.push({ topic: t.key, status: publish ? "PUBLISHED" : "DRAFT", slug, note: note ?? undefined });
    } catch (e) {
      logServerError(`article ${t.key}`, e);
      results.push({ topic: t.key, status: "ERROR", note: e instanceof Error ? e.message : String(e) });
    }
  }
  return { generated: results, remainingTopics: Math.max(0, candidateTopics(ctx).length - topics.length) };
}

/** Étape de la tâche quotidienne : respecte les réglages Administration → Articles. */
export async function runDailyArticles() {
  const db = createAdminClient();
  const { data } = await db.from("platform_settings").select("value").eq("key", "seo").maybeSingle();
  const s = (data?.value ?? {}) as { articles_enabled?: boolean; articles_auto_publish?: boolean; articles_per_day?: number };
  if (s.articles_enabled === false) return { skipped: "désactivé" };
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count } = await db.from("articles").select("id", { count: "exact", head: true }).gte("created_at", since.toISOString());
  const perDay = Math.min(3, Math.max(1, s.articles_per_day ?? 1));
  return generateArticles(perDay - (count ?? 0), { autoPublish: s.articles_auto_publish !== false });
}
