/**
 * Chiffres et séries des analyses de marché, tirés du jeu de faits enregistré avec
 * l'article (données réelles au jour de la rédaction). Partagé par la page, la
 * couverture et la rédaction.
 */
export type NamedCount = { name: string; count: number };

export type ArticleFacts = {
  theme?: string;
  zone?: string;
  periode?: string;
  date_des_donnees?: string;
  opportunites_ouvertes?: number;
  dont_marches_publics_externes?: number;
  dont_besoins_publies_par_des_entreprises?: number;
  date_limite_dans_les_30_jours?: number;
  publiees_ces_7_derniers_jours?: number;
  par_type?: NamedCount[];
  par_departement?: NamedCount[];
  par_secteur?: NamedCount[];
  principaux_acheteurs?: NamedCount[];
  page_de_la_plateforme?: string;
  sources?: string;
  prochaines_dates_limites?: { intitule: string; acheteur: string | null; ville: string | null; date_limite: string; lien: string }[];
};

const key = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Fusionne les libellés identiques à la casse et aux accents près (« REGION BRETAGNE » = « Région Bretagne »). */
export function mergeNames(items: NamedCount[] | undefined, limit = 8): NamedCount[] {
  const m = new Map<string, NamedCount>();
  for (const it of items ?? []) {
    const k = key(it.name);
    const prev = m.get(k);
    // Conserve la graphie la plus lisible (pas entièrement en majuscules)
    const name = prev && prev.name !== prev.name.toUpperCase() ? prev.name : it.name !== it.name.toUpperCase() || !prev ? it.name : prev.name;
    m.set(k, { name, count: (prev?.count ?? 0) + it.count });
  }
  return [...m.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export function articleFigures(f: ArticleFacts) {
  const theme = f.theme ?? "";
  const label = theme.startsWith("Bretagne")
    ? "Bretagne"
    : theme.replace(/^(Secteur|Département|Acheteur public) : /, "").replace(" — Département : ", " · ");
  return {
    label,
    kind: f.theme?.startsWith("Département") ? ("departement" as const) : ("secteur" as const),
    total: f.opportunites_ouvertes ?? 0,
    publicTenders: f.dont_marches_publics_externes ?? 0,
    internal: f.dont_besoins_publies_par_des_entreprises ?? 0,
    within30: f.date_limite_dans_les_30_jours ?? 0,
    breakdown: (f.par_secteur ?? f.par_departement ?? []).slice(0, 8),
    breakdownTitle: f.par_secteur ? "Opportunités par secteur" : "Opportunités par département",
    buyers: mergeNames(f.principaux_acheteurs, 6),
    period: f.periode,
    date: f.date_des_donnees,
  };
}
