import Link from "next/link";
import { Card, CardHeader, DashboardCard } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export type AudienceStats = {
  days: number;
  visits: number;
  page_views: number;
  avg_duration_s: number;
  pages_per_visit: number;
  bounce_rate: number | null;
  visits_today: number;
  signups: number;
  interests: number;
  proposals: number;
  published: number;
  alerts: number;
  outbound: number;
  daily: { day: string; visits: number }[];
  top_pages: { path: string; views: number; visits: number }[];
  referrers: { source: string; visits: number }[];
  devices: Partial<Record<"mobile" | "tablet" | "desktop", number>>;
};

export const PERIODS = [7, 30, 90] as const;

const nf = new Intl.NumberFormat("fr-FR");
const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

function duration(s: number) {
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min ${String(Math.round(s % 60)).padStart(2, "0")} s` : `${Math.round(s)} s`;
}
function pct(a: number, b: number) {
  if (b <= 0) return "—";
  const v = (a / b) * 100;
  return `${v < 10 ? v.toFixed(1).replace(".", ",") : Math.round(v)} %`;
}

/** Visites par jour : une seule série, barres fines, info-bulle au survol, tableau pour les lecteurs d'écran. */
function DailyChart({ data }: { data: AudienceStats["daily"] }) {
  const max = Math.max(1, ...data.map((d) => d.visits));
  return (
    <figure>
      <div className="flex h-40 items-end gap-0.5 border-b border-slate-200" aria-hidden>
        {data.map((d, i) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t-[4px] bg-teal-600 transition-colors group-hover:bg-navy"
              style={{ height: `${d.visits > 0 ? Math.max(2, (d.visits / max) * 100) : 0}%` }}
            />
            <span
              className={cn(
                "pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-md bg-navy px-2 py-1 text-xs whitespace-nowrap text-white shadow group-hover:block",
                // Info-bulle ancrée au bord pour les premiers et derniers jours (pas de débordement sur mobile)
                i < data.length / 6 ? "left-0" : i >= data.length - data.length / 6 ? "right-0" : "left-1/2 -translate-x-1/2",
              )}
            >
              {dayFmt.format(new Date(d.day))} · {nf.format(d.visits)} visite{d.visits > 1 ? "s" : ""}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-500" aria-hidden>
        <span>{data[0] && dayFmt.format(new Date(data[0].day))}</span>
        <span>max {nf.format(max)} / jour</span>
        <span>{data.at(-1) && dayFmt.format(new Date(data.at(-1)!.day))}</span>
      </div>
      <table className="sr-only">
        <caption>Visites par jour</caption>
        <thead>
          <tr>
            <th scope="col">Jour</th>
            <th scope="col">Visites</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{dayFmt.format(new Date(d.day))}</td>
              <td>{d.visits}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function AudiencePanel({ stats: a, period }: { stats: AudienceStats; period: number }) {
  const deviceTotal = (a.devices.mobile ?? 0) + (a.devices.tablet ?? 0) + (a.devices.desktop ?? 0);
  return (
    <section aria-labelledby="audience-titre" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="audience-titre" className="text-lg font-bold">
            Audience
          </h2>
          <p className="text-sm text-slate-600">Mesure interne sans cookie ni donnée personnelle ; robots et pages d&apos;administration exclus.</p>
        </div>
        <nav aria-label="Période" className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 text-sm">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/admin?periode=${p}`}
              aria-current={p === period ? "page" : undefined}
              className={cn("rounded-md px-3 py-1 font-semibold", p === period ? "bg-navy text-white" : "text-slate-600 hover:bg-sky")}
            >
              {p} j
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <DashboardCard label="Visites" value={nf.format(a.visits)} hint={`${nf.format(a.visits_today)} aujourd'hui`} />
        <DashboardCard label="Pages vues" value={nf.format(a.page_views)} />
        <DashboardCard label="Durée moyenne" value={duration(a.avg_duration_s)} hint="Temps passé, onglet visible" />
        <DashboardCard label="Pages / visite" value={String(a.pages_per_visit).replace(".", ",")} />
        <DashboardCard label="Taux de rebond" value={a.bounce_rate === null ? "—" : `${a.bounce_rate} %`} hint="Visites d'une seule page" />
        <DashboardCard label="Inscriptions" value={nf.format(a.signups)} hint={`${pct(a.signups, a.visits)} des visites`} />
      </div>

      <Card>
        <CardHeader title={`Visites par jour (${period} derniers jours)`} />
        <div className="p-5">
          {a.visits > 0 ? <DailyChart data={a.daily} /> : <p className="text-sm text-slate-600">Aucune visite enregistrée sur la période.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Conversion" description="Part des visites qui aboutissent à chaque action, sur la période." />
        <dl className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Visite → inscription", a.signups, a.visits],
            ["Visite → clic vers la source d'un marché", a.outbound, a.visits],
            ["Visite → alerte créée", a.alerts, a.visits],
            ["Visite → intérêt manifesté", a.interests, a.visits],
            ["Visite → réponse envoyée", a.proposals, a.visits],
            ["Visite → besoin publié", a.published, a.visits],
          ].map(([label, n, d]) => (
            <div key={label as string} className="bg-white p-4">
              <dt className="text-sm text-slate-600">{label}</dt>
              <dd className="mt-1 font-heading text-2xl font-bold text-navy tabular-nums">{pct(n as number, d as number)}</dd>
              <dd className="text-xs text-slate-500">{nf.format(n as number)} sur {nf.format(d as number)} visites</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Pages les plus vues" />
          <div className="overflow-x-auto p-5">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th scope="col" className="py-2 font-medium">Page</th>
                  <th scope="col" className="py-2 text-right font-medium">Vues</th>
                  <th scope="col" className="py-2 text-right font-medium">Visites</th>
                </tr>
              </thead>
              <tbody>
                {a.top_pages.map((p) => (
                  <tr key={p.path} className="border-t border-slate-100">
                    <td className="max-w-0 truncate py-2 pr-2 font-mono text-xs">
                      <Link href={p.path} className="text-navy hover:underline">
                        {p.path}
                      </Link>
                    </td>
                    <td className="py-2 text-right tabular-nums">{nf.format(p.views)}</td>
                    <td className="py-2 text-right tabular-nums">{nf.format(p.visits)}</td>
                  </tr>
                ))}
                {a.top_pages.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-2 text-slate-600">
                      Aucune donnée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-3">
          <Card>
            <CardHeader title="Provenance" />
            <ul className="space-y-1 p-5 text-sm">
              {a.referrers.map((r) => (
                <li key={r.source} className="flex justify-between gap-2">
                  <span className="truncate">{r.source}</span>
                  <span className="tabular-nums text-slate-600">{pct(r.visits, a.visits)}</span>
                </li>
              ))}
              {a.referrers.length === 0 && <li className="text-slate-600">Aucune donnée.</li>}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Appareils" />
            <ul className="space-y-1 p-5 text-sm">
              {(
                [
                  ["Mobile", a.devices.mobile ?? 0],
                  ["Tablette", a.devices.tablet ?? 0],
                  ["Ordinateur", a.devices.desktop ?? 0],
                ] as const
              ).map(([label, n]) => (
                <li key={label} className="flex justify-between gap-2">
                  <span>{label}</span>
                  <span className="tabular-nums text-slate-600">{pct(n, deviceTotal)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </section>
  );
}
