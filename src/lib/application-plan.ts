/**
 * Planning conseillé d'une candidature : une date cible par étape du guide, de aujourd'hui jusqu'à la
 * veille de la date limite (proportionnel quand le délai est court). Calcul simple et transparent,
 * présenté comme un conseil, jamais comme une obligation de l'acheteur.
 */
export type PlanItem = { step: number; title: string; date: Date; status: "done" | "late" | "today" | "upcoming" };

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Part du délai écoulée à la fin de chaque étape (0 = aujourd'hui, 1 = veille de la date limite). */
const SHARE = [0, 0.1, 0.3, 0.55, 0.85, 1];
const TITLES = ["Vérifier les conditions", "Télécharger le dossier", "Questions et visite", "Pièces prêtes", "Réponse rédigée", "Dépôt de l'offre"];

export function applicationPlan(deadline: string | null, done: number[], now = new Date(), startedAt?: string | null): PlanItem[] {
  if (!deadline) return [];
  const end = startOfDay(new Date(new Date(deadline).getTime() - DAY));
  const start = startOfDay(startedAt ? new Date(Math.min(new Date(startedAt).getTime(), now.getTime())) : now);
  const span = Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY));
  const today = startOfDay(now).getTime();
  return SHARE.map((share, step) => {
    const date = new Date(start.getTime() + Math.round(span * share) * DAY);
    const t = date.getTime();
    const status = done.includes(step) ? "done" : t < today ? "late" : t === today ? "today" : "upcoming";
    return { step, title: TITLES[step], date, status };
  });
}

/** Ce qui est à faire aujourd'hui (étapes du jour et en retard), dans l'ordre. */
export function dueToday(plan: PlanItem[]) {
  return plan.filter((p) => p.status === "today" || p.status === "late");
}

/** Noms courts des 6 étapes (barre de progression). */
export const STEP_SHORT = ["Conditions", "Dossier", "Questions et visite", "Pièces", "Rédaction", "Dépôt"];

/**
 * Étapes à venir dans les `horizon` prochains jours, avec leur écart en jours (0 = aujourd'hui ; une
 * étape en retard est ramenée à aujourd'hui et signalée).
 */
export function upcomingSteps(plan: PlanItem[], now = new Date(), horizon = 7) {
  const today = startOfDay(now).getTime();
  return plan
    .filter((p) => p.status !== "done")
    .map((p) => ({ ...p, offset: Math.max(0, Math.round((startOfDay(p.date).getTime() - today) / DAY)) }))
    .filter((p) => p.offset <= horizon);
}

/** « Aujourd'hui », « Demain », « Dans 3 jours ». */
export const dayLabel = (offset: number) => (offset <= 0 ? "Aujourd'hui" : offset === 1 ? "Demain" : `Dans ${offset} jours`);
