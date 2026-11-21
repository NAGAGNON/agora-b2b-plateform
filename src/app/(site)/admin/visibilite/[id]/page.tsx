import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { BOOST_STATUS_LABEL } from "@/lib/visibility";
import { campaignNextStep, campaignTimeline, type TimelineStep } from "@/lib/campaign-timeline";
import { formatDateTime } from "@/lib/format";
import { formatEuros } from "@/lib/billing/plans";
import { cn } from "@/lib/cn";
import { campaignReport } from "@/lib/visibility-report";
import { PresentedByDay } from "@/components/visibility/presented-by-day";
import { LiveRefresh } from "@/components/visibility/live-refresh";

export const metadata = { title: "Visibilité — suivi d'une campagne" };
export const dynamic = "force-dynamic";

const AD_STATUS: Record<string, string> = { PENDING_REVIEW: "En relecture", APPROVED: "Validée", REJECTED: "À corriger" };
const nowMs = () => Date.now();
const DOT: Record<TimelineStep["kind"], string> = { neutral: "bg-slate-300", good: "bg-teal", warn: "bg-violet-500", bad: "bg-rose-500" };

/** Une campagne de visibilité, étape par étape : annonce, relecture, notification, corrections, résultats. */
export default async function CampaignFollowPage(props: PageProps<"/admin/visibilite/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = createAdminClient();
  const { data: b } = await db.from("visibility_boosts").select("*").eq("id", id).maybeSingle();
  if (!b) notFound();

  const [{ data: company }, { data: need }, { data: logsBoost }, { data: logsCompany }, { data: members }, { data: pres }, { data: camp }] = await Promise.all([
    db.from("companies").select("id, name, slug, city").eq("id", b.company_id).maybeSingle(),
    b.opportunity_id ? db.from("opportunities").select("title").eq("id", b.opportunity_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("audit_logs").select("action, created_at, metadata").eq("entity_type", "visibility_boost").eq("entity_id", id).order("created_at"),
    db.from("audit_logs").select("action, created_at, metadata").like("action", "visibility.%").eq("metadata->>boost_id", id).order("created_at"),
    db.from("company_members").select("user_id").eq("company_id", b.company_id),
    db.from("boost_presentations").select("created_at, prospect_id").eq("boost_id", id).order("created_at").limit(10_000),
    db.from("outreach_campaigns").select("id").eq("kind", "BOOST").eq("boost_id", id).maybeSingle(),
  ]);
  const memberIds = (members ?? []).map((m) => m.user_id).filter(Boolean);
  const path = b.opportunity_id ? `/opportunites/${b.opportunity_id}` : company ? `/entreprises/${company.slug}` : null;
  const [{ data: notes }, { data: ev }, { count: views }] = await Promise.all([
    memberIds.length
      ? db.from("notifications").select("created_at, read_at, type").in("user_id", memberIds).in("type", ["visibility_ad_approved", "visibility_ad_rejected"]).gte("created_at", b.created_at).order("created_at")
      : Promise.resolve({ data: [] as { created_at: string; read_at: string | null; type: string }[] }),
    camp ? db.from("outreach_events").select("recipient_id, type").eq("campaign_id", camp.id).in("type", ["OPEN", "CLICK"]).limit(20_000) : Promise.resolve({ data: [] as { recipient_id: string; type: string }[] }),
    path && b.starts_at ? db.from("page_views_human").select("id", { count: "exact", head: true }).eq("path", path).gte("created_at", b.starts_at) : Promise.resolve({ count: 0 }),
  ]);

  const list = pres ?? [];
  const report = await campaignReport(db, b);
  const steps = campaignTimeline({ boost: b, logs: [...(logsBoost ?? []), ...(logsCompany ?? [])], notifications: notes ?? [], firstPresentation: list[0]?.created_at ?? null });
  const stats = [
    { label: "Présentations dans l'espace des membres", value: list.filter((p) => !p.prospect_id).length },
    { label: "Présentations par e-mail", value: list.filter((p) => p.prospect_id).length },
    { label: "E-mails lus", value: new Set((ev ?? []).map((e) => e.recipient_id)).size },
    { label: "Clics vers la fiche", value: new Set((ev ?? []).filter((e) => e.type === "CLICK").map((e) => e.recipient_id)).size },
    { label: "Visites de la fiche depuis le début", value: views ?? 0 },
    { label: "Entreprises qui leur ont écrit", value: report.messages },
  ];

  return (
    <div className="space-y-6" data-testid="campaign-follow">
      <Link href="/admin/visibilite" className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Toutes les campagnes
      </Link>

      <header className="rounded-2xl bg-gradient-to-br from-navy to-navy-900 p-5 text-white shadow-lg">
        <p className="flex flex-wrap items-center gap-3 text-xs font-bold tracking-wide text-teal-400 uppercase">
          Campagne de visibilité · {BOOST_STATUS_LABEL[b.status] ?? b.status} {b.status === "ACTIVE" && <LiveRefresh />}
        </p>
        <h1 className="mt-1 font-heading text-2xl font-extrabold text-white">{company?.name ?? "Entreprise"}</h1>
        <p className="mt-1 text-sm text-slate-300">
          {need?.title ? `Besoin : ${need.title} · ` : ""}
          {b.daily_presentations > 0 ? `${b.daily_presentations} présentations / jour × ${b.duration_days} j` : "Sans présentations"}
          {b.featured_days > 0 ? ` · à la une ${b.featured_days} j` : ""} · {b.free_launch ? "gratuite (lancement)" : `${formatEuros(Number(b.price_ht))} HT`}
        </p>
        <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold" data-testid="campaign-next">
          Où en est-on : {campaignNextStep(b)}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Résultats">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <p className="font-heading text-2xl font-extrabold text-navy tabular-nums">{s.value}</p>
            <p className="mt-1 text-xs text-slate-600">{s.label}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200" aria-labelledby="presentees" data-testid="admin-presented">
        <h2 id="presentees" className="text-lg font-bold text-navy">
          Ce que le site a fait pour eux : à qui nous les avons présentés
        </h2>
        <p className="mt-1 text-sm text-slate-600">La même liste que celle que voit l&apos;entreprise dans son espace.</p>
        <PresentedByDay
          presented={report.presented}
          startsAt={b.starts_at}
          basePath={`/admin/visibilite/${b.id}`}
          day={typeof sp.jour === "string" ? sp.jour : undefined}
          now={nowMs()}
          emptyToday="Aucune présentation aujourd'hui pour l'instant."
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200" aria-labelledby="etapes">
          <h2 id="etapes" className="text-lg font-bold text-navy">
            Étape par étape
          </h2>
          <ol className="mt-4 space-y-4" data-testid="campaign-timeline">
            {steps.map((s, i) => (
              <li key={i} className="relative flex gap-3">
                <span className={cn("mt-1.5 size-3 shrink-0 rounded-full", DOT[s.kind])} aria-hidden />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{formatDateTime(s.at)}</p>
                  <p className="font-semibold text-navy">{s.title}</p>
                  {s.detail && <p className="mt-0.5 text-sm whitespace-pre-line text-slate-600">{s.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200" aria-labelledby="annonce">
          <h2 id="annonce" className="text-lg font-bold text-navy">
            Annonce actuelle {b.ad_status && <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-sm font-semibold text-slate-700">{AD_STATUS[b.ad_status] ?? b.ad_status}</span>}
          </h2>
          {!b.ad_title ? (
            <p className="mt-3 text-sm text-slate-500">Pas d&apos;annonce pour cette campagne.</p>
          ) : (
            <div className="mt-3">
              <p className="font-bold text-navy">{b.ad_title}</p>
              {b.ad_points?.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                  {b.ad_points.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              )}
              {b.ad_text && <p className="mt-2 text-sm whitespace-pre-line text-slate-700">{b.ad_text}</p>}
              <p className="mt-2 text-xs text-slate-500">{(b.ad_text ?? "").length} caractères de présentation</p>
              {b.ad_status === "REJECTED" && b.ad_review_note && (
                <p className="mt-3 rounded-xl bg-violet-50 p-3 text-sm text-violet-900 ring-1 ring-violet-200">
                  <strong>Message envoyé à l&apos;entreprise :</strong> {b.ad_review_note}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
