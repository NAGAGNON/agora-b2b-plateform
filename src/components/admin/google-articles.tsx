import Link from "next/link";
import { Search, Newspaper, UserPlus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import type { SeoSnapshot } from "@/lib/seo-snapshot";

const nf = new Intl.NumberFormat("fr-FR");
const time = (iso: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-2xl font-bold text-navy">{nf.format(value)}</p>
      <p className="text-sm text-slate-600">{label}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Title({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <h3 className="mb-2 flex items-center gap-2 font-bold text-navy">{icon} {children}</h3>;
}

/** Visiteurs venus de Google, vues des articles publiés hier et aujourd'hui, inscriptions du jour. */
export function GoogleArticlesCard({ s }: { s: SeoSnapshot }) {
  return (
    <Card>
      <CardHeader title="Google, articles et inscriptions" description="Jours de Paris, chiffres en temps réel. Une visite « depuis Google » commence par un clic sur un résultat Google." />
      <div className="space-y-6 p-5">
        <div>
          <Title icon={<Search className="size-4 text-teal-700" aria-hidden />}>Visiteurs venus de Google</Title>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Aujourd'hui" value={s.google.today} />
            <Stat label="Hier" value={s.google.yesterday} />
            <Stat label="7 derniers jours" value={s.google.last_7_days} />
          </div>
          {s.google.landing_today.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              {s.google.landing_today.map((p) => (
                <li key={p.path} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{p.path}</span>
                  <span className="shrink-0 text-slate-500">{nf.format(p.visits)} visite{p.visits > 1 ? "s" : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <Title icon={<Newspaper className="size-4 text-teal-700" aria-hidden />}>Articles publiés hier et aujourd&apos;hui</Title>
          {s.articles.length === 0 ? (
            <p className="text-sm text-slate-600">Aucun article publié hier ni aujourd&apos;hui.</p>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Vues des articles publiés hier et aujourd&apos;hui</caption>
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th scope="col" className="py-2 font-medium">Article</th>
                    <th scope="col" className="py-2 text-right font-medium">Vues aujourd&apos;hui</th>
                    <th scope="col" className="py-2 text-right font-medium">Vues hier</th>
                    <th scope="col" className="py-2 text-right font-medium">Visiteurs depuis Google</th>
                  </tr>
                </thead>
                <tbody>
                  {s.articles.map((a) => (
                    <tr key={a.slug} className="border-t border-slate-100">
                      <td className="py-2 pr-3">
                        <Link href={`/analyses/${a.slug}`} className="font-medium text-navy underline">
                          {a.title}
                        </Link>
                        <span className="block text-xs text-slate-500">Publié {a.published === "today" ? "aujourd'hui" : "hier"} à {time(a.published_at)}</span>
                      </td>
                      <td className="py-2 text-right">{nf.format(a.views_today)}</td>
                      <td className="py-2 text-right">{a.published === "today" ? "—" : nf.format(a.views_yesterday)}</td>
                      <td className="py-2 text-right">{nf.format(a.visitors_from_google)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <Title icon={<UserPlus className="size-4 text-teal-700" aria-hidden />}>Inscriptions du jour</Title>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Inscriptions aujourd'hui" value={s.signups.today} />
            <Stat label="Venues d'un e-mail de prospection" value={s.signups.from_outreach} />
          </div>
          {s.signups.list.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              {s.signups.list.map((u, i) => (
                <li key={`${u.at}-${i}`}>
                  {time(u.at)} — {u.name ?? "Nom non renseigné"}
                  {u.company ? ` (${u.company})` : ""}
                  {u.from_outreach ? " · via la prospection" : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
