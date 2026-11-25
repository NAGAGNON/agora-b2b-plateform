import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Référencement : d'où viennent les inscrits" };
export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("fr-FR");
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1).replace(".", ",")} %` : "—");

/**
 * Référencement, en un tableau : pour chaque provenance (Google, IA, e-mails…) et chaque type de page
 * d'arrivée, les visites puis les inscriptions. Pour savoir quelles pages créer ou renforcer.
 */
export default async function SeoFunnelPage(props: PageProps<"/admin/referencement">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const days = [7, 30, 90].includes(Number(sp.jours)) ? Number(sp.jours) : 30;
  const db = await createClient();
  const { data, error } = await db.rpc("admin_seo_funnel", { p_days: days });
  const rows = (data ?? []).map((r) => ({ ...r, visits: Number(r.visits), signups: Number(r.signups) }));
  const byOrigin = new Map<string, { visits: number; signups: number; pages: typeof rows }>();
  for (const r of rows) {
    const o = byOrigin.get(r.origin) ?? { visits: 0, signups: 0, pages: [] };
    o.visits += r.visits;
    o.signups += r.signups;
    o.pages.push(r);
    byOrigin.set(r.origin, o);
  }
  const origins = [...byOrigin.entries()].sort((a, b) => b[1].signups - a[1].signups || b[1].visits - a[1].visits);
  const total = { visits: rows.reduce((n, r) => n + r.visits, 0), signups: rows.reduce((n, r) => n + r.signups, 0) };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Référencement : d&apos;où viennent les inscrits</h1>
          <p className="mt-1 text-sm text-slate-600">
            Visites (première page de chaque visite) et inscriptions, par provenance et par type de page d&apos;arrivée, sur les {days} derniers jours.
          </p>
        </div>
        <nav className="flex gap-2 text-sm" aria-label="Période">
          {[7, 30, 90].map((d) => (
            <a key={d} href={`/admin/referencement?jours=${d}`} className={`rounded-full px-3 py-1.5 font-semibold ring-1 ${d === days ? "bg-navy text-white ring-navy" : "bg-white text-navy ring-slate-200"}`}>
              {d} jours
            </a>
          ))}
        </nav>
      </div>
      {error && <p className="text-sm text-rose-700">Mesure indisponible : {error.message}</p>}
      <p className="text-sm text-slate-700">
        Total : <strong>{nf.format(total.visits)}</strong> visites, <strong>{nf.format(total.signups)}</strong> inscriptions ({pct(total.signups, total.visits)}).
      </p>
      {origins.map(([origin, o]) => (
        <section key={origin} className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          <h2 className="flex flex-wrap items-baseline justify-between gap-2 bg-slate-50 px-4 py-3 font-bold text-navy">
            {origin}
            <span className="text-sm font-normal text-slate-600">
              {nf.format(o.visits)} visites · {nf.format(o.signups)} inscriptions · {pct(o.signups, o.visits)}
            </span>
          </h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Page d&apos;arrivée</th>
                <th className="px-4 py-2 text-right font-semibold">Visites</th>
                <th className="px-4 py-2 text-right font-semibold">Inscriptions</th>
                <th className="px-4 py-2 text-right font-semibold">Taux</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {o.pages.map((p) => (
                <tr key={p.page_type}>
                  <td className="px-4 py-2">{p.page_type}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{nf.format(p.visits)}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{nf.format(p.signups)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{pct(p.signups, p.visits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
