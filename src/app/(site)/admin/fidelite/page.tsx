import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardCard } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { getSectorLabels } from "@/lib/queries/platform";
import { regionBySlug } from "@/lib/geo";

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

/** Minuit (heure de Paris) du jour en cours, en millisecondes. */
function parisMidnight(now: number) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
  const paris = new Date(now).toLocaleString("sv-SE", { timeZone: "Europe/Paris" }).replace(" ", "T") + "Z";
  const offset = Math.round((Date.parse(paris) - now) / 60_000) * 60_000;
  return Date.parse(`${day}T00:00:00Z`) - offset;
}

const timeFr = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });

type SearchProps = { has_query?: boolean | null; sector?: string | null; region?: string | null; department?: string | null };

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
    db.from("users").select("id, full_name, email, created_at, last_seen_at").eq("platform_role", "USER").eq("status", "ACTIVE").limit(10000),
    db.from("analytics_events").select("user_id, created_at").in("event_name", ACTIONS).not("user_id", "is", null).order("created_at").limit(50000),
  ]);
  const list = users ?? [];

  // Revenus aujourd'hui (depuis minuit, heure de Paris) et leurs recherches du jour
  const midnight = parisMidnight(now);
  const today = list.filter((u) => seen(u) >= midnight).sort((a, b) => seen(b) - seen(a));
  const todayIds = today.map((u) => u.id);
  const [{ data: todayEvents }, { data: memberships }, sectorLabels] = await Promise.all([
    todayIds.length
      ? db.from("analytics_events").select("user_id, event_name, properties, created_at").in("user_id", todayIds).in("event_name", ["search_opportunities", "search_companies", "view_opportunity", "view_company"]).gte("created_at", new Date(midnight).toISOString()).order("created_at").limit(5000)
      : Promise.resolve({ data: [] as { user_id: string | null; event_name: string; properties: unknown; created_at: string }[] }),
    todayIds.length ? db.from("company_members").select("user_id, companies(name)").in("user_id", todayIds) : Promise.resolve({ data: [] as { user_id: string; companies: { name: string } | null }[] }),
    getSectorLabels().catch(() => ({}) as Record<string, string>),
  ]);
  const companyOf = new Map<string, string>();
  for (const m of memberships ?? []) if (m.companies?.name && !companyOf.has(m.user_id)) companyOf.set(m.user_id, m.companies.name);
  const activity = new Map<string, { searches: { at: string; where: string; label: string }[]; views: number }>();
  for (const e of todayEvents ?? []) {
    if (!e.user_id) continue;
    const a = activity.get(e.user_id) ?? { searches: [], views: 0 };
    if (e.event_name.startsWith("view_")) a.views++;
    else {
      const p = (e.properties ?? {}) as SearchProps;
      const parts = [
        p.has_query ? "avec mots-clés" : null,
        p.sector ? (sectorLabels[p.sector] ?? p.sector) : null,
        p.region ? (regionBySlug(p.region)?.name ?? p.region) : null,
        p.department ? `dép. ${p.department}` : null,
      ].filter(Boolean);
      a.searches.push({ at: e.created_at, where: e.event_name === "search_companies" ? "Annuaire" : "Opportunités", label: parts.length ? parts.join(" · ") : "Filtres sans mot-clé" });
    }
    activity.set(e.user_id, a);
  }
  const todaySearches = [...activity.values()].reduce((t, a) => t + a.searches.length, 0);
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
      <section className="rounded-2xl border border-slate-200 bg-white" aria-labelledby="revenus-aujourdhui">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 id="revenus-aujourdhui" className="font-semibold text-navy">Revenus aujourd&apos;hui (depuis minuit)</h2>
            <p className="text-sm text-slate-600">Inscrits venus sur le site aujourd&apos;hui et leurs recherches du jour.</p>
          </div>
          <div className="flex gap-2 text-sm">
            <span className="rounded-full bg-teal-50 px-3 py-1 font-semibold text-teal-800">{today.length} inscrit{today.length > 1 ? "s" : ""} revenu{today.length > 1 ? "s" : ""}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">{todaySearches} recherche{todaySearches > 1 ? "s" : ""}</span>
          </div>
        </div>
        {today.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-600">Aucun inscrit revenu depuis minuit pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {today.map((u) => {
              const a = activity.get(u.id);
              const newToday = created(u) >= midnight;
              return (
                <li key={u.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-navy">
                      {u.full_name || u.email}
                      {companyOf.get(u.id) && <span className="font-normal text-slate-500"> · {companyOf.get(u.id)}</span>}
                      {newToday && <span className="ml-2 rounded-full bg-violet/10 px-2 py-0.5 text-xs font-semibold text-violet">Inscrit aujourd&apos;hui</span>}
                    </p>
                    <p className="text-xs text-slate-500">
                      Vu à {timeFr(u.last_seen_at!)} · {a?.searches.length ?? 0} recherche{(a?.searches.length ?? 0) > 1 ? "s" : ""} · {a?.views ?? 0} page{(a?.views ?? 0) > 1 ? "s" : ""} consultée{(a?.views ?? 0) > 1 ? "s" : ""}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">{u.email}</p>
                  {a?.searches.length ? (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {a.searches.map((x, i) => (
                        <li key={i} className="rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200">
                          <span className="text-slate-400">{timeFr(x.at)} · {x.where} :</span> {x.label}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400">Aucune recherche aujourd&apos;hui.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
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
