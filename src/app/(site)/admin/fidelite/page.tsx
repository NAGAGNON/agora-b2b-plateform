import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardCard } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Fidélité des utilisateurs" };
export const dynamic = "force-dynamic";

const DAY = 86_400_000;
/** Actions utiles (mêmes événements que la page Conversion). */
const ACTIONS = ["create_company", "create_alert", "save_favorite", "express_interest", "publish_opportunity", "submit_proposal"];

/** Début de semaine (lundi) d'une date, au format AAAA-MM-JJ. */
function weekStart(iso: string) {
  const d = new Date(iso);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

const currentTime = () => Date.now();

function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function duration(ms: number | null) {
  if (ms === null) return "—";
  if (ms < 3_600_000) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  if (ms < 2 * DAY) return `${Math.round(ms / 3_600_000)} h`;
  return `${Math.round(ms / DAY)} j`;
}

/**
 * Fidélité : retours des inscrits, délai avant la première action utile et cohortes par semaine
 * d'inscription. Comptes utilisateurs uniquement (équipe LinkProB2B exclue), données internes.
 */
export default async function RetentionPage() {
  await requireAdmin();
  const db = createAdminClient();
  const now = currentTime();
  const [{ data: users }, { data: events }] = await Promise.all([
    db.from("users").select("id, created_at, last_seen_at").eq("platform_role", "USER").eq("status", "ACTIVE").limit(10000),
    db.from("analytics_events").select("user_id, created_at").in("event_name", ACTIONS).not("user_id", "is", null).order("created_at").limit(50000),
  ]);
  const list = users ?? [];
  const firstAction = new Map<string, number>();
  for (const e of events ?? []) if (e.user_id && !firstAction.has(e.user_id)) firstAction.set(e.user_id, new Date(e.created_at).getTime());

  const seen = (u: (typeof list)[number]) => (u.last_seen_at ? new Date(u.last_seen_at).getTime() : 0);
  const created = (u: (typeof list)[number]) => new Date(u.created_at).getTime();
  const active7 = list.filter((u) => now - seen(u) < 7 * DAY).length;
  const active30 = list.filter((u) => now - seen(u) < 30 * DAY).length;
  const older = list.filter((u) => now - created(u) > 7 * DAY);
  const returned = older.filter((u) => now - seen(u) < 7 * DAY).length;
  const cameBack = (u: (typeof list)[number]) => seen(u) - created(u) > DAY;
  const delays = list.map((u) => (firstAction.has(u.id) ? firstAction.get(u.id)! - created(u) : null)).filter((d): d is number => d !== null && d >= 0);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");

  const cohorts = new Map<string, (typeof list)[number][]>();
  for (const u of list.filter((u) => now - created(u) < 8 * 7 * DAY)) {
    const k = weekStart(u.created_at);
    cohorts.set(k, [...(cohorts.get(k) ?? []), u]);
  }
  const weeks = [...cohorts.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const cell = "px-3 py-2 text-right tabular-nums";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fidélité des utilisateurs</h1>
        <p className="mt-1 text-slate-600">
          Comptes utilisateurs actifs, équipe LinkProB2B exclue (au {formatDateTime(new Date(now).toISOString())}). « Vu » = dernière visite connectée ;
          « action utile » = entreprise créée, alerte, favori, intérêt, besoin publié ou réponse.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <DashboardCard label="Inscrits" value={list.length} />
        <DashboardCard label="Vus sur 7 jours" value={active7} />
        <DashboardCard label="Vus sur 30 jours" value={active30} />
        <DashboardCard label="Taux de retour" value={pct(returned, older.length)} hint="Inscrits depuis plus de 7 jours, revenus dans les 7 derniers jours" />
        <DashboardCard label="Avec une action utile" value={pct(list.filter((u) => firstAction.has(u.id)).length, list.length)} />
        <DashboardCard label="Délai médian avant la 1re action" value={duration(median(delays))} />
      </div>
      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <caption className="px-3 pt-3 text-left font-semibold text-navy">Cohortes par semaine d&apos;inscription (8 dernières semaines)</caption>
          <thead className="bg-canvas text-left text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2">Semaine du</th>
              <th scope="col" className="px-3 py-2 text-right">Inscrits</th>
              <th scope="col" className="px-3 py-2 text-right">Revenus après le 1er jour</th>
              <th scope="col" className="px-3 py-2 text-right">Vus sur 7 jours</th>
              <th scope="col" className="px-3 py-2 text-right">Avec une action utile</th>
            </tr>
          </thead>
          <tbody>
            {weeks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-slate-600">Aucune inscription sur les 8 dernières semaines.</td>
              </tr>
            ) : (
              weeks.map(([week, us]) => (
                <tr key={week} className="border-t border-slate-100">
                  <th scope="row" className="px-3 py-2 text-left font-medium text-navy">{new Date(week).toLocaleDateString("fr-FR")}</th>
                  <td className={cell}>{us.length}</td>
                  <td className={cell}>{pct(us.filter(cameBack).length, us.length)}</td>
                  <td className={cell}>{pct(us.filter((u) => now - seen(u) < 7 * DAY).length, us.length)}</td>
                  <td className={cell}>{pct(us.filter((u) => firstAction.has(u.id)).length, us.length)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
