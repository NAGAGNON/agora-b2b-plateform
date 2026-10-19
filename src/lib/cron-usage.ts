import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { parisDayStart, parisToday } from "@/lib/daily-report";

/**
 * Temps de calcul des tâches automatiques. L'offre gratuite de Vercel n'inclut que 4 h de temps CPU
 * actif par mois (environ 8 minutes par jour, pages du site comprises) ; au-delà, le site est mis en
 * pause. Chaque passage est mesuré, et au-delà du plafond quotidien les tâches lourdes et facultatives
 * (recherche d'adresses, campagnes complémentaires) attendent le lendemain ; l'envoi des e-mails déjà
 * prêts, la collecte et le bilan continuent.
 */

/** Plafond quotidien des tâches automatiques (le reste du forfait est laissé aux pages du site). */
export const DAILY_CRON_CPU_BUDGET_MS = Number(process.env.CRON_CPU_BUDGET_MS) > 0 ? Number(process.env.CRON_CPU_BUDGET_MS) : 3 * 60_000;
/** Forfait mensuel de l'offre gratuite de Vercel (temps CPU actif). */
export const MONTHLY_CPU_ALLOWANCE_MS = 4 * 3_600_000;

/** Démarre la mesure d'un passage ; `stop()` l'enregistre (sans jamais faire échouer la tâche). */
export function startCronMeter(task: string) {
  const cpu0 = process.cpuUsage();
  const t0 = Date.now();
  return async () => {
    const d = process.cpuUsage(cpu0);
    const cpu_ms = Math.round((d.user + d.system) / 1000);
    try {
      await createAdminClient().from("cron_cpu_runs").insert({ task, started_at: new Date(t0).toISOString(), cpu_ms, wall_ms: Date.now() - t0 });
    } catch {
      // mesure facultative
    }
    return cpu_ms;
  };
}

/** Temps de calcul consommé aujourd'hui (heure de Paris) par les tâches automatiques. */
export async function cronCpuToday(now = new Date()): Promise<number> {
  const { data } = await createAdminClient().from("cron_cpu_runs").select("cpu_ms").gte("started_at", parisDayStart(parisToday(now)).toISOString()).limit(5000);
  return (data ?? []).reduce((t, r) => t + r.cpu_ms, 0);
}

/** Plafond du jour atteint : les tâches lourdes et facultatives attendent le lendemain. */
export async function cronCpuBudgetReached(now = new Date()): Promise<boolean> {
  return (await cronCpuToday(now).catch(() => 0)) >= DAILY_CRON_CPU_BUDGET_MS;
}

/** Récapitulatif pour le bilan : par tâche aujourd'hui, et total sur 30 jours glissants. */
export async function cronCpuSummary(now = new Date()) {
  const db = createAdminClient();
  const since30 = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const start = parisDayStart(parisToday(now)).toISOString();
  const { data } = await db.from("cron_cpu_runs").select("task, cpu_ms, wall_ms, started_at").gte("started_at", since30).limit(20000);
  const rows = data ?? [];
  const today = new Map<string, { passages: number; cpu_ms: number; wall_ms: number }>();
  for (const r of rows.filter((x) => x.started_at >= start)) {
    const cur = today.get(r.task) ?? { passages: 0, cpu_ms: 0, wall_ms: 0 };
    today.set(r.task, { passages: cur.passages + 1, cpu_ms: cur.cpu_ms + r.cpu_ms, wall_ms: cur.wall_ms + r.wall_ms });
  }
  const sec = (ms: number) => Math.round(ms / 1000);
  return {
    secondes_aujourdhui: sec([...today.values()].reduce((t, x) => t + x.cpu_ms, 0)),
    plafond_quotidien_secondes: sec(DAILY_CRON_CPU_BUDGET_MS),
    minutes_sur_30_jours: Math.round(rows.reduce((t, x) => t + x.cpu_ms, 0) / 60_000),
    forfait_mensuel_minutes: MONTHLY_CPU_ALLOWANCE_MS / 60_000,
    par_tache: [...today.entries()].sort((a, b) => b[1].cpu_ms - a[1].cpu_ms).map(([tache, x]) => ({ tache, passages: x.passages, secondes_de_calcul: sec(x.cpu_ms), duree_secondes: sec(x.wall_ms) })),
  };
}
