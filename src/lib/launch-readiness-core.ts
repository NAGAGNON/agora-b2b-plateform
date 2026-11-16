/**
 * Seuils du lancement payant, fixés par le fondateur (décision du comité du 16 novembre 2026) :
 * tous doivent être atteints, les seuils hebdomadaires deux semaines de suite.
 */
export const LAUNCH_THRESHOLDS = { inscritsParSemaine: 25, revenusParSemaine: 15, entreprisesActives: 40, semaines: 2 } as const;

export type WeekCounts = { inscrits: number; revenus: number };
export type Criterion = { libelle: string; actuel: string; seuil: string; atteint: boolean };

/** Évalue les seuils : `weeks[0]` est la semaine la plus récente (7 derniers jours). */
export function evaluateLaunch(weeks: WeekCounts[], entreprisesActives: number, t = LAUNCH_THRESHOLDS) {
  const last = weeks.slice(0, t.semaines);
  const allWeeks = (f: (w: WeekCounts) => boolean) => last.length === t.semaines && last.every(f);
  const criteres: Criterion[] = [
    {
      libelle: "Inscriptions par semaine",
      actuel: last.map((w) => w.inscrits).join(" puis "),
      seuil: `au moins ${t.inscritsParSemaine}, ${t.semaines} semaines de suite`,
      atteint: allWeeks((w) => w.inscrits >= t.inscritsParSemaine),
    },
    {
      libelle: "Membres qui reviennent consulter des offres, par semaine",
      actuel: last.map((w) => w.revenus).join(" puis "),
      seuil: `au moins ${t.revenusParSemaine}, ${t.semaines} semaines de suite`,
      atteint: allWeeks((w) => w.revenus >= t.revenusParSemaine),
    },
    { libelle: "Entreprises actives", actuel: String(entreprisesActives), seuil: `au moins ${t.entreprisesActives}`, atteint: entreprisesActives >= t.entreprisesActives },
  ];
  return { criteres, atteints: criteres.filter((c) => c.atteint).length, pret: criteres.every((c) => c.atteint) };
}
