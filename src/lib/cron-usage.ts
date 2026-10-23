import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { parisDayStart, parisToday } from "@/lib/daily-report";

/**
 * Temps de calcul des tâches automatiques. Vercel facture le temps CPU actif (pages du site comprises) :
 * l'offre gratuite n'en inclut que 4 h par mois et met le site en pause au-delà ; l'offre payante
 * facture les dépassements. Seuil de référence conservé : 4 h par mois. Chaque passage est mesuré, et au-delà du plafond quotidien de la PROSPECTION
 * (passages « outreach » et « envoi », comptés à part) la recherche d'adresses et les campagnes
 * complémentaires attendent le lendemain ; l'envoi des e-mails déjà prêts, la collecte et le bilan continuent.
 * La collecte, les articles et la veille ne consomment pas ce plafond : sinon la prospection serait
 * bloquée dès le matin par les autres tâches.
 */

/** Tâches comptées dans le plafond de la prospection (préfixes des noms de passage). */
export const PROSPECTION_TASKS = ["outreach", "envoi"] as const;

/** Plafond quotidien du temps de calcul de la prospection (le reste du forfait est laissé aux autres tâches et aux pages). */
export const DAILY_CRON_CPU_BUDGET_MS = Number(process.env.CRON_CPU_BUDGET_MS) > 0 ? Number(process.env.CRON_CPU_BUDGET_MS) : 10 * 60_000;
/**
 * Seuil mensuel de référence (temps CPU actif) : 4 h, le forfait de l'offre gratuite de Vercel, gardé
 * comme garde-fou après le passage à l'offre payante pour éviter les dépassements facturés.
 * Réglable avec CPU_MONTHLY_ALLOWANCE_MINUTES.
 */
export const MONTHLY_CPU_ALLOWANCE_MS = Number(process.env.CPU_MONTHLY_ALLOWANCE_MINUTES) > 0 ? Number(process.env.CPU_MONTHLY_ALLOWANCE_MINUTES) * 60_000 : 4 * 3_600_000;

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

export const isProspectionTask = (task: string) => PROSPECTION_TASKS.some((p) => task === p || task.startsWith(`${p}?`) || task.startsWith(`${p}-`));

/** Temps de calcul consommé aujourd'hui (heure de Paris) par les tâches automatiques (toutes, ou la prospection seule). */
export async function cronCpuToday(now = new Date(), { prospectionOnly = false }: { prospectionOnly?: boolean } = {}): Promise<number> {
  const { data } = await createAdminClient().from("cron_cpu_runs").select("task, cpu_ms").gte("started_at", parisDayStart(parisToday(now)).toISOString()).limit(5000);
  return (data ?? []).filter((r) => !prospectionOnly || isProspectionTask(r.task)).reduce((t, r) => t + r.cpu_ms, 0);
}

/** Plafond du jour de la prospection atteint : recherche d'adresses et campagnes complémentaires attendent le lendemain. */
export async function cronCpuBudgetReached(now = new Date()): Promise<boolean> {
  return (await cronCpuToday(now, { prospectionOnly: true }).catch(() => 0)) >= DAILY_CRON_CPU_BUDGET_MS;
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
    secondes_prospection_aujourdhui: sec([...today.entries()].filter(([task]) => isProspectionTask(task)).reduce((t, [, x]) => t + x.cpu_ms, 0)),
    plafond_quotidien_secondes: sec(DAILY_CRON_CPU_BUDGET_MS),
    minutes_sur_30_jours: Math.round(rows.reduce((t, x) => t + x.cpu_ms, 0) / 60_000),
    forfait_mensuel_minutes: MONTHLY_CPU_ALLOWANCE_MS / 60_000,
    par_tache: [...today.entries()].sort((a, b) => b[1].cpu_ms - a[1].cpu_ms).map(([tache, x]) => ({ tache, passages: x.passages, secondes_de_calcul: sec(x.cpu_ms), duree_secondes: sec(x.wall_ms) })),
  };
}

/**
 * Pause temporaire des tâches planifiées (récupération de la base Supabase après saturation du
 * budget disque, 23/10/2026) : jusqu'à cette date, les tâches ne lisent ni n'écrivent rien.
 */
export const CRON_PAUSED_UNTIL = "2026-10-23T00:00:00Z";
export function cronPausedResponse(): Response | null {
  return Date.now() < Date.parse(CRON_PAUSED_UNTIL) ? Response.json({ paused: true, until: CRON_PAUSED_UNTIL }) : null;
}
