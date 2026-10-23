import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/format";
import { parisDayStart, parisToday } from "@/lib/daily-report";

export const metadata = { title: "Diagnostic" };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Check = { label: string; ms: number; ok: boolean; detail: string };

/** Mesure une lecture de la base : durée et erreur exacte (lecture seule). */
async function timed(label: string, run: () => PromiseLike<{ error: { message: string } | null; count?: number | null; data?: unknown }>): Promise<Check> {
  const t = Date.now();
  try {
    const r = await run();
    const n = r.count ?? (Array.isArray(r.data) ? r.data.length : r.data ? 1 : 0);
    return { label, ms: Date.now() - t, ok: !r.error, detail: r.error ? r.error.message : `${n} ligne(s)` };
  } catch (e) {
    return { label, ms: Date.now() - t, ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

export default async function DiagnosticPage() {
  await requireAdmin();
  const db = createAdminClient();
  const day = parisToday();
  const start = parisDayStart(day).toISOString();
  const checks = await Promise.all([
    timed("Base joignable (paramètres)", () => db.from("platform_settings").select("key").limit(1)),
    timed("Annonces (comptage)", () => db.from("opportunities").select("id", { count: "exact", head: true })),
    timed("Prospects (comptage)", () => db.from("outreach_prospects").select("id", { count: "exact", head: true })),
    timed("Instantané SEO (bilan)", () => db.rpc("seo_snapshot", { p_now: new Date().toISOString() })),
    timed("E-mails envoyés aujourd'hui", () => db.from("outreach_recipients").select("id", { count: "exact", head: true }).eq("status", "SENT").gte("sent_at", start)),
    timed("Adresses trouvées aujourd'hui", () => db.from("outreach_prospects").select("id", { count: "exact", head: true }).eq("enrichment_status", "FOUND").gte("enriched_at", start)),
  ]);
  const [{ data: runs }, { data: cron }, { data: ocron }, { data: camps }, { data: fails }] = await Promise.all([
    db.from("cron_cpu_runs").select("task, started_at, cpu_ms, wall_ms").gte("started_at", start).order("started_at", { ascending: false }).limit(40),
    db.from("platform_settings").select("value").eq("key", "private.cron").maybeSingle(),
    db.from("platform_settings").select("value").eq("key", "private.outreach_cron").maybeSingle(),
    db.from("outreach_campaigns").select("kind, status, created_at, stats, report").eq("campaign_date", day).order("created_at", { ascending: false }).limit(10),
    db.from("audit_logs").select("action, metadata, created_at").like("action", "outreach.%").order("created_at", { ascending: false }).limit(10),
  ]);
  const cpuToday = (runs ?? []).filter((r) => /^(outreach|envoi)/.test(r.task)).reduce((t, r) => t + r.cpu_ms, 0);
  const json = (v: unknown) => JSON.stringify(v ?? null, null, 1).slice(0, 1500);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Diagnostic</h1>
        <p className="mt-1 text-slate-600">État réel au {formatDateTime(new Date().toISOString())}. Lecture seule : faites une capture de cette page en cas de problème.</p>
      </div>
      <section>
        <h2 className="mb-2 font-semibold">Base de données</h2>
        <ul className="space-y-1 text-sm" data-testid="diag-checks">
          {checks.map((c) => (
            <li key={c.label} className={c.ok ? "text-slate-700" : "text-red-700"}>
              {c.ok ? "✓" : "✗"} {c.label} — {c.ms} ms — {c.detail}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Tâches automatiques aujourd&apos;hui</h2>
        <p className="text-sm text-slate-600">Calcul de la prospection aujourd&apos;hui : {Math.round(cpuToday / 1000)} s (plafond 600 s).</p>
        <ul className="mt-2 space-y-1 text-xs">
          {(runs ?? []).map((r, i) => (
            <li key={i}>
              {formatDateTime(r.started_at)} · {r.task} · calcul {Math.round(r.cpu_ms / 1000)} s · durée {Math.round(r.wall_ms / 1000)} s
            </li>
          ))}
          {!runs?.length && <li className="text-red-700">Aucune tâche automatique enregistrée aujourd&apos;hui.</li>}
        </ul>
        <pre className="mt-2 overflow-x-auto rounded bg-slate-100 p-2 text-xs whitespace-pre-wrap">Dernier passage quotidien : {json(cron?.value)}</pre>
        <pre className="mt-2 overflow-x-auto rounded bg-slate-100 p-2 text-xs whitespace-pre-wrap">Dernier passage prospection : {json(ocron?.value)}</pre>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Campagnes du jour</h2>
        {(camps ?? []).map((c, i) => (
          <div key={i} className="mb-2 rounded border border-slate-200 p-2 text-xs">
            <p className="font-medium">
              {c.kind} · {c.status} · {formatDateTime(c.created_at)}
            </p>
            <pre className="whitespace-pre-wrap">{(c.report ?? "").split("\n").slice(-6).join("\n")}</pre>
          </div>
        ))}
        {!camps?.length && <p className="text-sm text-red-700">Aucune campagne aujourd&apos;hui.</p>}
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Derniers lancements (journal)</h2>
        <ul className="space-y-1 text-xs">
          {(fails ?? []).map((f, i) => (
            <li key={i}>
              {formatDateTime(f.created_at)} · {f.action} · {json(f.metadata).slice(0, 300)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
