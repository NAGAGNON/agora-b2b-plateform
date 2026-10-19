/**
 * Moteur de stratégie : à partir des chiffres réels des 14 derniers jours, décide de ce que le site
 * met en avant le lendemain pour attirer plus de visiteurs et d'inscriptions. Règles simples et
 * explicables (pas de texte généré) : chaque décision est accompagnée de sa raison chiffrée.
 *
 *  - Articles : thèmes (secteurs, régions, départements) les plus recherchés en premier, familles
 *    de thèmes qui obtiennent le plus de lectures en premier, et rythme de publication relevé
 *    quand les articles amènent des visiteurs depuis les moteurs de recherche.
 *  - Accueil : régions mises en avant selon les pages réellement consultées.
 *  - Prospection : secteurs dont les e-mails obtiennent le plus de clics et d'inscriptions
 *    envoyés et recherchés en premier (priorité, jamais exclusion).
 *  - Points à surveiller : pages d'entrée qui font fuir les visiteurs.
 */

export type EntryGroup = { grp: string; visits: number; bounces: number; intent: number; signups: number; from_search: number };
export type GrowthMetrics = {
  from: string;
  to: string;
  visits: number;
  from_search: number;
  signups: number;
  entry_groups: EntryGroup[];
  search_landings: { path: string; visits: number }[];
  zones: { slug: string; views: number }[];
  articles: { slug: string; topic_key: string; published_at: string; views: number; search_visits: number }[];
  outreach_sectors: { sector: string; sent: number; clicks: number; signups: number }[];
};

export const ARTICLE_FAMILIES = ["secteur", "departement", "secteur-departement", "acheteur", "region"] as const;
export type ArticleFamily = (typeof ARTICLE_FAMILIES)[number];

export type GrowthStrategy = {
  version: 1;
  day: string;
  articles: {
    /** Poids (0 à 3) des pages /opportunites/<slug> les plus demandées : leurs thèmes passent en premier */
    boosts: Record<string, number>;
    family_order: ArticleFamily[];
    per_day: number;
  };
  home: { regions: string[] };
  outreach: { sector_priority: Record<string, number> };
  watch: string[];
};

export type Change = { domaine: string; decision: string; raison: string };

export const DEFAULT_HOME_REGIONS = ["bretagne", "ile-de-france", "auvergne-rhone-alpes", "nouvelle-aquitaine", "occitanie", "hauts-de-france", "provence-alpes-cote-d-azur"];

export const DEFAULT_STRATEGY = (day: string): GrowthStrategy => ({
  version: 1,
  day,
  articles: { boosts: {}, family_order: [...ARTICLE_FAMILIES], per_day: 1 },
  home: { regions: [...DEFAULT_HOME_REGIONS] },
  outreach: { sector_priority: {} },
  watch: [],
});

const round1 = (x: number) => Math.round(x * 10) / 10;
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

/** Pages /opportunites/<slug> d'un thème d'article (clé « secteur:slug:mois », « departement:29:mois »…). */
export function topicSlugs(topicKey: string, deptSlug: (code: string) => string | undefined): string[] {
  const [kind, a, b] = topicKey.split(":");
  if (kind === "secteur" || kind === "region") return [a];
  if (kind === "departement") return [deptSlug(a)].filter((s): s is string => Boolean(s));
  if (kind === "secteur-departement") return [a, deptSlug(b)].filter((s): s is string => Boolean(s));
  return [];
}

export function decideStrategy(
  m: GrowthMetrics,
  previous: GrowthStrategy | null,
  ctx: { day: string; regionSlugs: Set<string>; regionName: (slug: string) => string; sectorLabel: (slug: string) => string; deptSlug: (code: string) => string | undefined },
): { strategy: GrowthStrategy; changes: Change[] } {
  const prev = previous ?? DEFAULT_STRATEGY(ctx.day);
  const s = DEFAULT_STRATEGY(ctx.day);
  const changes: Change[] = [];

  // ---- 1. Demande par page région / département / secteur : visites venues des moteurs (×3),
  //         pages consultées, lectures des articles du même thème (×2)
  const demand = new Map<string, number>();
  const add = (slug: string | undefined, n: number) => slug && n > 0 && demand.set(slug, (demand.get(slug) ?? 0) + n);
  for (const l of m.search_landings) {
    const z = /^\/opportunites\/([a-z0-9-]+)/.exec(l.path);
    if (z && z[1] !== "selection") add(z[1], 3 * l.visits);
  }
  for (const z of m.zones) add(z.slug, z.views);
  for (const a of m.articles) for (const slug of topicSlugs(a.topic_key, ctx.deptSlug)) add(slug, 2 * a.views);
  const ranked = [...demand.entries()].filter(([, v]) => v >= 2).sort((a, b) => b[1] - a[1]);
  const max = ranked[0]?.[1] ?? 0;
  for (const [slug, v] of ranked.slice(0, 20)) s.articles.boosts[slug] = round1(1 + (2 * v) / max);
  const topNow = ranked.slice(0, 3).map(([slug]) => slug);
  const topBefore = Object.entries(prev.articles.boosts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([slug]) => slug);
  if (topNow.length && topNow.join() !== topBefore.join()) {
    const label = (slug: string) => (ctx.regionSlugs.has(slug) ? ctx.regionName(slug) : ctx.sectorLabel(slug));
    changes.push({
      domaine: "Articles",
      decision: `Prochains articles orientés en priorité vers : ${topNow.map(label).join(", ")}`,
      raison: `Ce sont les thèmes les plus consultés et les plus recherchés sur Google ces 14 derniers jours (${ranked.slice(0, 3).map(([, v]) => v).join(", ")} points d'intérêt).`,
    });
  }

  // ---- 2. Familles d'articles : lectures moyennes par article (lissées), meilleures d'abord
  const byFamily = new Map<string, { n: number; views: number }>();
  for (const a of m.articles) {
    const fam = a.topic_key.split(":")[0];
    const cur = byFamily.get(fam) ?? { n: 0, views: 0 };
    byFamily.set(fam, { n: cur.n + 1, views: cur.views + a.views });
  }
  const totalArticles = m.articles.length;
  const avgAll = totalArticles ? m.articles.reduce((t, a) => t + a.views, 0) / totalArticles : 0;
  const scoreFam = (f: string) => {
    const x = byFamily.get(f);
    return x ? (x.views + 2 * avgAll) / (x.n + 2) : avgAll;
  };
  // Tri stable : à égalité, l'ordre habituel est conservé
  s.articles.family_order = [...ARTICLE_FAMILIES].sort((a, b) => scoreFam(b) - scoreFam(a) || ARTICLE_FAMILIES.indexOf(a) - ARTICLE_FAMILIES.indexOf(b));
  if (s.articles.family_order[0] !== prev.articles.family_order[0] && byFamily.has(s.articles.family_order[0])) {
    const f = byFamily.get(s.articles.family_order[0])!;
    changes.push({
      domaine: "Articles",
      decision: `Type d'article privilégié : ${FAMILY_LABEL[s.articles.family_order[0]]}`,
      raison: `${f.n} article(s) de ce type, ${f.views} lecture(s) au total : le meilleur résultat par article.`,
    });
  }

  // ---- 3. Rythme : plus d'articles quand ils amènent des visiteurs depuis les moteurs de recherche
  const searchFromArticles = m.articles.reduce((t, a) => t + a.search_visits, 0);
  s.articles.per_day = prev.articles.per_day;
  if (searchFromArticles >= 5 && prev.articles.per_day < 3) {
    s.articles.per_day = prev.articles.per_day + 1;
    changes.push({ domaine: "Articles", decision: `Rythme relevé à ${s.articles.per_day} article(s) par jour`, raison: `Les articles ont amené ${searchFromArticles} visiteur(s) depuis les moteurs de recherche en 14 jours.` });
  } else if (totalArticles >= 10 && m.articles.every((a) => a.views === 0) && prev.articles.per_day > 1) {
    s.articles.per_day = prev.articles.per_day - 1;
    changes.push({ domaine: "Articles", decision: `Rythme ramené à ${s.articles.per_day} article(s) par jour`, raison: `Aucune lecture sur les ${totalArticles} derniers articles : mieux vaut moins d'articles, mieux ciblés.` });
  }

  // ---- 4. Accueil : régions les plus consultées en premier, complétées par la liste habituelle
  const regionDemand = ranked.filter(([slug]) => ctx.regionSlugs.has(slug)).map(([slug]) => slug);
  s.home.regions = [...new Set([...regionDemand, ...DEFAULT_HOME_REGIONS])].slice(0, 7);
  if (s.home.regions.join() !== prev.home.regions.join() && regionDemand.length) {
    changes.push({ domaine: "Accueil", decision: `Régions mises en avant : ${s.home.regions.slice(0, 3).map(ctx.regionName).join(", ")} en tête`, raison: "Ce sont les régions dont les pages sont les plus consultées ces 14 derniers jours." });
  }

  // ---- 5. Prospection : secteurs qui répondent le mieux (clics + inscriptions ×5), lissés vers la moyenne
  const sentAll = m.outreach_sectors.reduce((t, x) => t + x.sent, 0);
  const respAll = m.outreach_sectors.reduce((t, x) => t + x.clicks + 5 * x.signups, 0);
  const base = sentAll ? respAll / sentAll : 0;
  if (sentAll >= 50 && base > 0) {
    for (const x of m.outreach_sectors) {
      if (x.sent < 15) continue;
      const rate = (x.clicks + 5 * x.signups + 20 * base) / (x.sent + 20);
      const p = Math.max(-1, Math.min(1, round1(Math.log2(rate / base))));
      if (p) s.outreach.sector_priority[x.sector] = p;
    }
    const best = Object.entries(s.outreach.sector_priority).sort((a, b) => b[1] - a[1])[0];
    const prevBest = Object.entries(prev.outreach.sector_priority).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] > 0 && best[0] !== prevBest?.[0]) {
      const x = m.outreach_sectors.find((o) => o.sector === best[0])!;
      changes.push({
        domaine: "Prospection",
        decision: `Entreprises du secteur « ${ctx.sectorLabel(best[0])} » contactées et recherchées en priorité`,
        raison: `${x.clicks} clic(s) et ${x.signups} inscription(s) pour ${x.sent} e-mail(s) envoyés : le secteur qui répond le mieux (moyenne : ${pct(respAll, sentAll)} points pour 100 e-mails).`,
      });
    }
  }

  // ---- 6. Points à surveiller (pages d'entrée qui font fuir, inscriptions commencées mais pas finies)
  for (const g of m.entry_groups) {
    if (g.visits >= 10 && pct(g.bounces, g.visits) >= 80) s.watch.push(`${g.grp} : ${pct(g.bounces, g.visits)} % des ${g.visits} visiteurs arrivés par ces pages repartent sans rien voir d'autre.`);
  }
  const intent = m.entry_groups.reduce((t, g) => t + g.intent, 0);
  if (intent >= 5 && m.signups / intent < 0.3) s.watch.push(`Inscription : ${intent} visiteurs ont ouvert la page d'inscription, ${m.signups} sont allés au bout.`);

  return { strategy: s, changes };
}

export const FAMILY_LABEL: Record<ArticleFamily, string> = {
  secteur: "analyses par secteur",
  departement: "analyses par département",
  "secteur-departement": "analyses secteur × département",
  acheteur: "analyses par acheteur public",
  region: "analyses par région",
};
