import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Eye, Mail, MessageSquare, MousePointerClick, Users } from "lucide-react";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BOOST_STATUS_LABEL, totalPresentations, type Daily, type Duration } from "@/lib/visibility";
import { campaignReport, nothingReason, type Presented } from "@/lib/visibility-report";
import { cn } from "@/lib/cn";

export const metadata = { title: "Suivi de ma campagne" };
export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const nowMs = () => Date.now();
const parisDay = (d: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(d));
const dayLabel = (iso: string, today: string, yesterday: string) =>
  iso === today ? "Aujourd'hui" : iso === yesterday ? "Hier" : new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const STATE: Record<Presented["state"], { label: string; style: string }> = {
  presented: { label: "Vue dans son espace", style: "bg-slate-100 text-slate-700" },
  sent: { label: "E-mail envoyé", style: "bg-sky text-navy" },
  read: { label: "A lu", style: "bg-teal-50 text-teal-800 ring-1 ring-teal-200" },
  clicked: { label: "A ouvert votre fiche", style: "bg-teal text-navy" },
};

/** Suivi d'une campagne pour l'entreprise : à qui elle a été présentée, jour par jour, et les retours. */
export default async function MyCampaignPage(props: PageProps<"/dashboard/visibilite/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const session = await requireCompany(`/dashboard/visibilite/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  // Lecture avec les droits de l'entreprise : une autre entreprise ne voit jamais cette campagne
  const { data: b } = await (await createClient()).from("visibility_boosts").select("*").eq("id", id).eq("company_id", session.activeCompany.company.id).maybeSingle();
  if (!b) notFound();
  const report = await campaignReport(createAdminClient(), b);

  const now = nowMs();
  const today = parisDay(new Date(now));
  const yesterday = parisDay(new Date(now - DAY));
  const start = b.starts_at ? parisDay(b.starts_at) : today;
  // Les 7 derniers jours de la campagne (pas avant son démarrage)
  const days = Array.from({ length: 7 }, (_, i) => parisDay(new Date(now - i * DAY))).filter((d) => d >= start);
  const day = typeof sp.jour === "string" && days.includes(sp.jour) ? sp.jour : today;
  const ofDay = report.presented.filter((p) => parisDay(p.at) === day);
  const planned = b.daily_presentations > 0 ? totalPresentations(b.daily_presentations as Daily, b.duration_days as Duration) : 0;
  const done = report.presented.length;
  const pct = planned ? Math.min(100, Math.round((done / planned) * 100)) : 0;
  const dayN = b.starts_at ? Math.min(b.duration_days, Math.floor((now - new Date(b.starts_at).getTime()) / DAY) + 1) : 0;
  const waiting = b.ad_title && b.ad_status !== "APPROVED" ? nothingReason(b) : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6" data-testid="my-campaign">
      <Link href="/dashboard/visibilite" className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Mes campagnes
      </Link>

      <header className="plan-in rounded-3xl bg-gradient-to-br from-navy to-navy-900 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold tracking-wide text-teal-400 uppercase">Campagne de visibilité</p>
          <span className={cn("rounded-full px-3 py-1 text-xs font-bold", b.status === "ACTIVE" ? "bg-teal text-navy" : "bg-white/15 text-white")}>{BOOST_STATUS_LABEL[b.status] ?? b.status}</span>
        </div>
        <h1 className="mt-2 font-heading text-2xl font-extrabold text-white">{session.activeCompany.company.name}</h1>
        {b.starts_at && b.status === "ACTIVE" && (
          <p className="mt-1 text-sm text-slate-300">
            Jour {dayN} sur {b.duration_days}
            {b.daily_presentations > 0 ? ` · ${b.daily_presentations} entreprises par jour` : ""}
          </p>
        )}
        {planned > 0 && (
          <div className="mt-4">
            <div className="h-2.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-gradient-to-r from-teal to-electric transition-[width] duration-700" style={{ width: `${Math.max(pct, done ? 3 : 0)}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-slate-300">
              {done} présentation{done > 1 ? "s" : ""} sur {planned} prévues
            </p>
          </div>
        )}
        {waiting && <p className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-sm">{waiting}</p>}
      </header>

      <section className="grid grid-cols-3 gap-3" aria-label="Vos retours">
        {[
          { icon: Users, label: "Entreprises présentées", value: done },
          { icon: Eye, label: "Ont lu votre présentation", value: report.read },
          { icon: MessageSquare, label: "Vous ont écrit", value: report.messages },
        ].map(({ icon: Icon, label, value }, i) => (
          <div key={label} className="plan-in rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-slate-200" style={{ animationDelay: `${80 + i * 60}ms` }}>
            <Icon className="mx-auto size-5 text-teal-700" aria-hidden />
            <p className="mt-1 font-heading text-3xl font-extrabold text-navy tabular-nums">{value}</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">{label}</p>
          </div>
        ))}
      </section>
      {report.messages > 0 && (
        <Link href="/dashboard/messages" className="-mt-2 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-teal-700 hover:underline">
          <MessageSquare className="size-4" aria-hidden /> Lire mes messages
        </Link>
      )}

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200" aria-labelledby="jour">
        <h2 id="jour" className="font-heading text-lg font-extrabold text-navy">
          À qui nous vous avons présenté
        </h2>
        {days.length > 1 && (
          <nav className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1" aria-label="Choisir le jour">
            {days.map((d) => {
              const n = report.presented.filter((p) => parisDay(p.at) === d).length;
              return (
                <Link
                  key={d}
                  href={d === today ? `/dashboard/visibilite/${b.id}` : `/dashboard/visibilite/${b.id}?jour=${d}`}
                  scroll={false}
                  aria-current={d === day ? "page" : undefined}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition",
                    d === day ? "bg-navy text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                  )}
                >
                  {dayLabel(d, today, yesterday)} <span className={cn("tabular-nums", d === day ? "text-teal-300" : "text-slate-500")}>· {n}</span>
                </Link>
              );
            })}
          </nav>
        )}
        {ofDay.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600" data-testid="day-empty">
            {day === today
              ? waiting ?? "Les présentations du jour partent au fil de la journée (du lundi au vendredi pour les e-mails). Revenez un peu plus tard."
              : "Aucune présentation ce jour-là."}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100" data-testid="day-list">
            {ofDay.map((p, i) => (
              <li key={`${p.name}-${i}`} className="flex items-center gap-3 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky text-navy" aria-hidden>
                  {p.channel === "PROSPECT" ? <Mail className="size-5" /> : <Building2 className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold break-words text-navy">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    {[p.city, p.channel === "PROSPECT" ? "par e-mail" : "dans son espace LinkProB2B"].filter(Boolean).join(" · ")}
                  </p>
                  <span className={cn("mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold sm:hidden", STATE[p.state].style)}>
                    {p.state === "clicked" && <MousePointerClick className="size-3.5" aria-hidden />}
                    {STATE[p.state].label}
                  </span>
                </div>
                <span className={cn("hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold sm:inline-flex", STATE[p.state].style)}>
                  {p.state === "clicked" && <MousePointerClick className="size-3.5" aria-hidden />}
                  {STATE[p.state].label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center text-sm text-slate-500">Tous les 2 jours ouvrés, vous recevez par e-mail le point sur votre campagne.</p>
    </div>
  );
}
