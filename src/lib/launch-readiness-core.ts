/**
 * Seuils du lancement payant, fixés par le fondateur (décision du comité du 16 novembre 2026) :
 * tous doivent être atteints deux semaines de suite. Date de réexamen si ce n'est pas le cas.
 */
export const LAUNCH_THRESHOLDS = { inscritsParSemaine: 25, revenusParSemaine: 15, dossiersParSemaine: 10, semaines: 2, reexamen: "2027-01-15" } as const;

export type WeekCounts = { inscrits: number; revenus: number; dossiers: number };
export type Criterion = { libelle: string; actuel: string; seuil: string; atteint: boolean };

/** Évalue les seuils : `weeks[0]` est la semaine la plus récente (7 derniers jours). */
export function evaluateLaunch(weeks: WeekCounts[], today: string, t = LAUNCH_THRESHOLDS) {
  const last = weeks.slice(0, t.semaines);
  const criterion = (libelle: string, key: keyof WeekCounts, min: number): Criterion => ({
    libelle,
    actuel: last.map((w) => w[key]).join(" puis "),
    seuil: `au moins ${min}, ${t.semaines} semaines de suite`,
    atteint: last.length === t.semaines && last.every((w) => w[key] >= min),
  });
  const criteres = [
    criterion("Inscriptions par semaine", "inscrits", t.inscritsParSemaine),
    criterion("Membres qui reviennent consulter des offres, par semaine", "revenus", t.revenusParSemaine),
    criterion("Dossiers de candidature ouverts, par semaine", "dossiers", t.dossiersParSemaine),
  ];
  const pret = criteres.every((c) => c.atteint);
  return { criteres, atteints: criteres.filter((c) => c.atteint).length, pret, reexamen: t.reexamen, reexamenDu: !pret && today >= t.reexamen };
}
