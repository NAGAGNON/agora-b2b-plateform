import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";

export type AudienceDetail = {
  visits: number;
  daily: { day: string; visits: number; page_views: number; seo: number; outreach: number }[];
  hourly: { hour: number; visits: number }[];
  channels: { channel: string; visits: number; pages_per_visit: number; bounce_rate: number }[];
  search_engines: { engine: string; visits: number }[];
  sections: { section: string; views: number; visits: number; avg_duration_s: number }[];
  pages: { path: string; views: number; visits: number; avg_duration_s: number }[];
  landing: { path: string; visits: number; bounce_rate: number }[];
};

const nf = new Intl.NumberFormat("fr-FR");
const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : "—");
const secs = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, "0")} s` : `${Math.round(s)} s`);

function Table({ caption, head, rows, empty = "Aucune donnée sur la période." }: { caption: string; head: string[]; rows: (string | number | React.ReactNode)[][]; empty?: string }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-xs text-slate-500">
          <tr>
            {head.map((h, i) => (
              <th key={h} scope="col" className={`py-2 font-medium ${i > 0 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, n) => (
            <tr key={n} className="border-t border-slate-100">
              {r.map((c, i) => (
                <td key={i} className={i > 0 ? "py-2 pl-3 text-right whitespace-nowrap tabular-nums" : "min-w-[9rem] py-2 pr-2 [overflow-wrap:anywhere]"}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={head.length} className="py-2 text-slate-600">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Visites par heure de la journée (heure de Paris), sur la période. */
function HourlyChart({ data }: { data: AudienceDetail["hourly"] }) {
  const max = Math.max(1, ...data.map((d) => d.visits));
  return (
    <figure>
      <div className="flex h-28 items-end gap-0.5 border-b border-slate-200" aria-hidden>
        {data.map((d) => (
          <div key={d.hour} className="group relative flex h-full flex-1 items-end">
            <div className="w-full rounded-t-[4px] bg-teal-600 group-hover:bg-navy" style={{ height: `${d.visits > 0 ? Math.max(2, (d.visits / max) * 100) : 0}%` }} />
            <span
              className={`pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-md bg-navy px-2 py-1 text-xs whitespace-nowrap text-white shadow group-hover:block ${
                // Info-bulle ancrée au bord pour les premières et dernières heures (pas de débordement sur mobile)
                d.hour < 4 ? "left-0" : d.hour > 19 ? "right-0" : "left-1/2 -translate-x-1/2"
              }`}
            >
              {d.hour} h · {nf.format(d.visits)} visite{d.visits > 1 ? "s" : ""}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-500" aria-hidden>
        <span>0 h</span>
        <span>6 h</span>
        <span>12 h</span>
        <span>18 h</span>
        <span>23 h</span>
      </div>
      <table className="sr-only">
        <caption>Visites par heure</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.hour}>
              <td>{d.hour} h</td>
              <td>{d.visits}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function AudienceDetailPanel({ d, period }: { d: AudienceDetail; period: number }) {
  const days = [...d.daily].reverse();
  return (
    <section aria-labelledby="detail-titre" className="space-y-3">
      <div>
        <h2 id="detail-titre" className="text-lg font-bold">
          Audience détaillée ({period} derniers jours)
        </h2>
        <p className="text-sm text-slate-600">Jours et heures de Paris. Canal « Outreach » : visites arrivées par une sélection envoyée par e-mail.</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="D'où viennent les visiteurs" description="Canaux d'acquisition" />
          <div className="p-5">
            <Table
              caption="Canaux d'acquisition"
              head={["Canal", "Visites", "Part", "Pages / visite", "Rebond"]}
              rows={d.channels.map((c) => [c.channel, nf.format(c.visits), pct(c.visits, d.visits), String(c.pages_per_visit).replace(".", ","), `${c.bounce_rate} %`])}
            />
            {d.search_engines.length > 0 && (
              <p className="mt-3 text-xs text-slate-600">
                Moteurs de recherche : {d.search_engines.map((e) => `${e.engine} (${nf.format(e.visits)})`).join(" · ")}
              </p>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Visites par heure" description="Quand les visiteurs viennent (cumul de la période)" />
          <div className="p-5">{d.visits > 0 ? <HourlyChart data={d.hourly} /> : <p className="text-sm text-slate-600">Aucune visite sur la période.</p>}</div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Jour par jour" description="Visites, pages vues, visites venues des moteurs de recherche et d'Outreach" />
        <div className="max-h-96 overflow-y-auto p-5" tabIndex={0} role="region" aria-label="Audience jour par jour (zone défilante)">
          <Table
            caption="Audience jour par jour"
            head={["Jour", "Visites", "Pages vues", "Moteurs de recherche", "Outreach"]}
            rows={days.map((x) => [<span key={x.day} className="whitespace-nowrap">{dayFmt.format(new Date(x.day))}</span>, nf.format(x.visits), nf.format(x.page_views), nf.format(x.seo), nf.format(x.outreach)])}
          />
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Rubriques du site" description="Quelles parties du site sont lues" />
          <div className="p-5">
            <Table caption="Rubriques" head={["Rubrique", "Pages vues", "Visites", "Temps moyen"]} rows={d.sections.map((s) => [s.section, nf.format(s.views), nf.format(s.visits), secs(s.avg_duration_s)])} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Pages d'entrée" description="Première page vue à l'arrivée sur le site" />
          <div className="p-5">
            <Table
              caption="Pages d'entrée"
              head={["Page", "Visites", "Rebond"]}
              rows={d.landing.map((p) => [
                <Link key={p.path} href={p.path} className="font-mono text-xs text-navy hover:underline">
                  {p.path}
                </Link>,
                nf.format(p.visits),
                `${p.bounce_rate} %`,
              ])}
            />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Toutes les pages (30 plus vues)" description="Vues, visites et temps moyen passé sur chaque page" />
        <div className="p-5">
          <Table
            caption="Pages les plus vues"
            head={["Page", "Vues", "Visites", "Temps moyen"]}
            rows={d.pages.map((p) => [
              <Link key={p.path} href={p.path} className="font-mono text-xs text-navy hover:underline">
                {p.path}
              </Link>,
              nf.format(p.views),
              nf.format(p.visits),
              secs(p.avg_duration_s),
            ])}
          />
        </div>
      </Card>
    </section>
  );
}
