import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, MessageSquare, Users } from "lucide-react";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BOOST_STATUS_LABEL, totalPresentations, type Daily, type Duration } from "@/lib/visibility";
import { campaignReport, nothingReason } from "@/lib/visibility-report";
import { PresentedByDay } from "@/components/visibility/presented-by-day";
import { cn } from "@/lib/cn";

export const metadata = { title: "Suivi de ma campagne" };
export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const nowMs = () => Date.now();

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
        <PresentedByDay
          presented={report.presented}
          startsAt={b.starts_at}
          basePath={`/dashboard/visibilite/${b.id}`}
          day={typeof sp.jour === "string" ? sp.jour : undefined}
          now={now}
          emptyToday={waiting ?? "Les présentations du jour partent au fil de la journée (du lundi au vendredi pour les e-mails). Revenez un peu plus tard."}
        />
      </section>

      <p className="text-center text-sm text-slate-500">Tous les 2 jours ouvrés, vous recevez par e-mail le point sur votre campagne.</p>
    </div>
  );
}
