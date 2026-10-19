/** Temps de calcul des tâches automatiques : mesure, total du jour, plafond quotidien, récapitulatif du bilan. */
import { afterAll, describe, expect, it } from "vitest";
import { admin, RUN } from "./helpers";
import { cronCpuBudgetReached, cronCpuSummary, cronCpuToday, DAILY_CRON_CPU_BUDGET_MS, startCronMeter } from "@/lib/cron-usage";
import { renderDailyReportEmail } from "@/lib/daily-report-email";

const TASK = `test-${RUN}`;

afterAll(async () => {
  await admin.from("cron_cpu_runs").delete().like("task", `${TASK}%`);
});

describe("temps de calcul des tâches", () => {
  it("chaque passage est mesuré et enregistré", async () => {
    const before = await cronCpuToday();
    const stop = startCronMeter(TASK);
    let x = 0;
    for (let i = 0; i < 2_000_000; i++) x += Math.sqrt(i);
    expect(x).toBeGreaterThan(0);
    const ms = await stop();
    const { data } = await admin.from("cron_cpu_runs").select("cpu_ms, wall_ms").eq("task", TASK).single();
    expect(data?.cpu_ms).toBe(ms);
    expect(data!.wall_ms).toBeGreaterThanOrEqual(0);
    expect(await cronCpuToday()).toBeGreaterThanOrEqual(before + ms);
  });

  it("plafond quotidien : au-delà, les tâches lourdes attendent le lendemain", async () => {
    const used = await cronCpuToday();
    if (used < DAILY_CRON_CPU_BUDGET_MS) {
      expect(await cronCpuBudgetReached()).toBe(false);
      await admin.from("cron_cpu_runs").insert({ task: `${TASK}-lourde`, cpu_ms: DAILY_CRON_CPU_BUDGET_MS - used, wall_ms: 1000 });
    }
    expect(await cronCpuBudgetReached()).toBe(true);
    await admin.from("cron_cpu_runs").delete().eq("task", `${TASK}-lourde`);
  });

  it("récapitulatif du bilan : par tâche, sur 30 jours, et section dans l'e-mail", async () => {
    const s = await cronCpuSummary();
    expect(s.forfait_mensuel_minutes).toBe(240);
    expect(s.par_tache.some((t) => t.tache === TASK && t.passages === 1)).toBe(true);
    const { data: row } = await admin.from("daily_reports").select("day, generated_at, facts, summary, note, error").order("day", { ascending: false }).limit(1).maybeSingle();
    if (!row) return;
    const m = renderDailyReportEmail(row, { cpu: s });
    expect(m.html).toContain("Consommation Vercel (temps de calcul)");
    expect(m.text).toContain("Consommation Vercel :");
  });
});
