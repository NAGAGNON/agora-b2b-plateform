import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardCard } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Inscrits revenus sous 48 h" };
export const dynamic = "force-dynamic";

const HOUR = 3_600_000;
/** Nouvelle visite : au moins 30 minutes sans activité depuis l'action précédente */
const SESSION_GAP = 30 * 60_000;
const PERIODS = [7, 14, 30] as const;

const LABELS: Record<string, string> = {
  view_opportunity: "fiches d'offres consultées",
  search_opportunities: "recherches",
  source_outbound_clicked: "liens officiels ouverts",
  view_company: "fiches entreprises vues",
  save_favorite: "favoris ajoutés",
  create_alert: "alertes créées",
  create_company: "entreprise créée",
  publish_opportunity: "besoins publiés",
  express_interest: "intérêts envoyés",
  submit_proposal: "propositions envoyées",
  need_message_click: "messages à un besoin",
  profile_completed: "profil complété",
  cta_click: "clics sur un bouton",
};
const SHORT: Record<string, string> = {
  view_opportunity: "Consulte une offre",
  search_opportunities: "Recherche",
  source_outbound_clicked: "Ouvre le lien officiel",
  view_company: "Consulte une entreprise",
  save_favorite: "Ajoute un favori",
  create_alert: "Crée une alerte",
  create_company: "Crée son entreprise",
  publish_opportunity: "Publie un besoin",
  express_interest: "Envoie un intérêt",
  submit_proposal: "Envoie une proposition",
  create_account: "Crée son compte",
};

const now = () => Date.now();

function describe(name: string, p: Record<string, unknown> | null) {
  const q = typeof p?.q === "string" && p.q ? ` « ${p.q} »` : typeof p?.query === "string" && p.query ? ` « ${p.query}` + " »" : "";
  const title = typeof p?.title === "string" ? ` : ${p.title.slice(0, 70)}` : "";
  return `${SHORT[name] ?? name}${q || title}`;
}

/**
 * Inscrits revenus le jour même (après une pause d'au moins 30 minutes) ou dans les 48 h suivant
 * l'inscription, et ce qu'ils ont fait sur le site (événements enregistrés). Équipe exclue.
 */
export default async function ReturnersPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await props.searchParams;
  const days = PERIODS.find((d) => String(d) === sp.periode) ?? 14;
  const db = createAdminClient();
  const t = now();
  const since = new Date(t - days * 24 * HOUR).toISOString();
  const { data: users } = await db
    .from("users")
    .select("id, full_name, email, created_at, last_seen_at")
    .eq("platform_role", "USER")
    .eq("status", "ACTIVE")
    .eq("is_internal", false)
    .eq("is_demo", false)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1000);
  const list = users ?? [];
  const ids = list.map((u) => u.id);
  const [{ data: events }, { data: visits }, { data: members }] = await Promise.all([
    ids.length
      ? db.from("analytics_events").select("user_id, event_name, properties, created_at").in("user_id", ids).gte("created_at", since).order("created_at").limit(20000)
      : Promise.resolve({ data: [] as { user_id: string | null; event_name: string; properties: unknown; created_at: string }[] }),
    ids.length ? db.from("user_visits").select("user_id, day").in("user_id", ids) : Promise.resolve({ data: [] as { user_id: string; day: string }[] }),
    ids.length ? db.from("company_members").select("user_id, companies(name)").in("user_id", ids) : Promise.resolve({ data: [] as { user_id: string; companies: unknown }[] }),
  ]);
  const byUser = new Map<string, { name: string; at: number; props: Record<string, unknown> | null }[]>();
  for (const e of events ?? []) {
    if (!e.user_id) continue;
    const arr = byUser.get(e.user_id) ?? [];
    arr.push({ name: e.event_name, at: new Date(e.created_at).getTime(), props: (e.properties as Record<string, unknown>) ?? null });
    byUser.set(e.user_id, arr);
  }
  const visitDays = new Map<string, number>();
  for (const v of visits ?? []) visitDays.set(v.user_id, (visitDays.get(v.user_id) ?? 0) + 1);
  const company = new Map<string, string>();
  for (const m of members ?? []) {
    const c = m.companies as { name?: string } | null;
    if (c?.name && !company.has(m.user_id)) company.set(m.user_id, c.name);
  }

  const rows = list.map((u) => {
    const created = new Date(u.created_at).getTime();
    const evs = byUser.get(u.id) ?? [];
    // Visites : suites d'actions séparées par 30 minutes d'inactivité ; la première est celle de l'inscription
    let lastAt = created;
    const returns: number[] = [];
    for (const e of evs) {
      if (e.at - lastAt > SESSION_GAP && e.at > created) returns.push(e.at);
      lastAt = Math.max(lastAt, e.at);
    }
    const seen = u.last_seen_at ? new Date(u.last_seen_at).getTime() : 0;
    if (seen - created > SESSION_GAP && !returns.some((r) => Math.abs(r - seen) < SESSION_GAP)) returns.push(seen);
    returns.sort((a, b) => a - b);
    const first = returns[0] ?? null;
    const sameDay = first !== null && new Date(first).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) === new Date(created).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
    const within48 = first !== null && first - created <= 48 * HOUR;
    const counts = new Map<string, number>();
    for (const e of evs) if (LABELS[e.name]) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
    return { u, created, first, sameDay, within48, returns: returns.length, counts, recent: evs.slice(-10).reverse(), days: visitDays.get(u.id) ?? 0 };
  });
  const back = rows.filter((r) => r.within48);
  const pct = (n: number) => (rows.length ? `${Math.round((n / rows.length) * 100)} %` : "—");
  const old = rows.filter((r) => t - r.created > 48 * HOUR);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Inscrits revenus sous 48 h</h1>
          <p className="mt-1 text-sm text-slate-600">Revenus le jour même (après au moins 30 minutes) ou dans les 48 h qui suivent l&apos;inscription, et ce qu&apos;ils ont fait. Équipe exclue.</p>
        </div>
        <nav className="flex gap-1 text-sm" aria-label="Période">
          {PERIODS.map((d) => (
            <Link key={d} href={`/admin/retours?periode=${d}`} aria-current={d === days ? "page" : undefined} className={`rounded-lg px-3 py-1.5 font-semibold ${d === days ? "bg-navy text-white" : "text-slate-600 ring-1 ring-slate-200"}`}>
              {d} jours
            </Link>
          ))}
        </nav>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <DashboardCard label={`Inscrits (${days} jours)`} value={rows.length} />
        <DashboardCard label="Revenus le jour même" value={rows.filter((r) => r.sameDay).length} />
        <DashboardCard label="Revenus sous 48 h" value={back.length} />
        <DashboardCard label="Taux de retour sous 48 h" value={old.length ? `${Math.round((old.filter((r) => r.within48).length / old.length) * 100)} %` : pct(back.length)} />
      </div>
      {back.length === 0 && <p className="rounded-xl bg-white p-6 text-sm text-slate-600 ring-1 ring-slate-200">Aucun inscrit revenu sous 48 h sur la période.</p>}
      <ul className="space-y-4">
        {back.map((r) => (
          <li key={r.u.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-navy">
                  {r.u.full_name || "Sans nom"} <span className="font-normal text-slate-500">· {r.u.email}</span>
                </p>
                <p className="text-sm text-slate-600">{company.get(r.u.id) ?? "Pas encore d'entreprise"}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.sameDay ? "bg-teal-100 text-teal-900" : "bg-sky text-navy"}`}>
                {r.sameDay ? "Revenu le jour même" : `Revenu après ${Math.max(1, Math.round((r.first! - r.created) / HOUR))} h`}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Inscrit le {formatDateTime(new Date(r.created).toISOString())} · {r.returns} retour(s) · {r.days} jour(s) de visite
              {r.u.last_seen_at ? ` · dernière visite ${formatDateTime(r.u.last_seen_at)}` : ""}
            </p>
            {r.counts.size > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {[...r.counts.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, n]) => (
                    <li key={k} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
                      <strong className="text-navy">{n}</strong> {LABELS[k]}
                    </li>
                  ))}
              </ul>
            )}
            {r.recent.length > 0 && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-semibold text-teal-700">Dernières actions</summary>
                <ol className="mt-2 space-y-1 text-slate-700">
                  {r.recent.map((e, i) => (
                    <li key={i}>
                      <span className="text-xs text-slate-500">{formatDateTime(new Date(e.at).toISOString())}</span> — {describe(e.name, e.props)}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
