import Link from "next/link";
import { notFound } from "next/navigation";
import { Bookmark, Building2, ClipboardList, Eye, Megaphone, MessageCircle, MessageCircleQuestion, MousePointerClick, Search, UserRound, FileStack } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/format";
import { getSectorLabels } from "@/lib/queries/platform";
import { activitySummary, getLoyalty, getUserActivity, loyaltyLabel, type ActivityKind } from "@/lib/admin/user-activity";
import { GLANCE_PERIODS, parisMidnight } from "@/components/admin/at-a-glance";
import { cn } from "@/lib/cn";

export const metadata = { title: "Activité d'un inscrit" };
export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const nowMs = () => Date.now();

const ICON: Record<ActivityKind, typeof Eye> = {
  view: Eye,
  search: Search,
  application: ClipboardList,
  question: MessageCircleQuestion,
  message: MessageCircle,
  publish: FileStack,
  account: UserRound,
  save: Bookmark,
  click: MousePointerClick,
  campaign: Megaphone,
};

/** Tout ce qu'un inscrit a fait sur le site pendant la période, du plus récent au plus ancien. */
export default async function UserActivityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ periode?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { periode } = await searchParams;
  // Période par défaut : 30 jours (le détail d'une personne se lit sur plusieurs visites)
  const period = GLANCE_PERIODS.find((p) => p.key === periode) ?? GLANCE_PERIODS.find((p) => p.key === "30j")!;
  const now = nowMs();
  const since = (period.days === 0 ? parisMidnight(now) : new Date(now - period.days * DAY)).toISOString();
  const db = createAdminClient();
  const [{ data: user }, { data: memberships }, labels] = await Promise.all([
    db.from("users").select("id, full_name, email, created_at, last_seen_at").eq("id", id).maybeSingle(),
    db.from("company_members").select("companies(name, slug)").eq("user_id", id),
    getSectorLabels().catch(() => ({}) as Record<string, string>),
  ]);
  if (!user) notFound();
  const [activityMap, loyaltyMap] = await Promise.all([getUserActivity(db, [id], since, labels), getLoyalty(db, [id])]);
  const items = activityMap.get(id) ?? [];
  const loyalty = loyaltyLabel(loyaltyMap.get(id));
  const companies = (memberships ?? []).map((m) => m.companies as unknown as { name: string; slug: string | null } | null).filter(Boolean);

  // Regroupement par jour (heure de Paris)
  const dayFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long" });
  const timeFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
  // Actions identiques à la suite (même fiche ouverte 20 fois) : une seule ligne « × 20 »
  type Row = (typeof items)[number] & { times: number; from: string };
  const days: { day: string; list: Row[] }[] = [];
  for (const it of items) {
    const d = dayFmt.format(new Date(it.at));
    const last = days.at(-1);
    const prev = last?.day === d ? last.list.at(-1) : undefined;
    if (prev && prev.label === it.label && prev.detail === it.detail) {
      prev.times++;
      prev.from = it.at;
    } else if (last?.day === d) last.list.push({ ...it, times: 1, from: it.at });
    else days.push({ day: d, list: [{ ...it, times: 1, from: it.at }] });
  }

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm font-semibold text-teal-700 hover:underline">
        ← Retour à l&apos;administration
      </Link>
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h1 className="font-heading text-2xl font-extrabold text-navy">{user.full_name || user.email}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {user.email} · inscrit le {formatDateTime(user.created_at)} · vu le {formatDateTime(user.last_seen_at)}
        </p>
        {loyalty && (
          <p className="mt-2 inline-flex rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-800 ring-1 ring-teal/20" data-testid="activity-loyalty">
            {loyalty}
          </p>
        )}
        {companies.length > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-700">
            <Building2 className="size-4 text-teal-600" aria-hidden />
            {companies.map((c) =>
              c!.slug ? (
                <Link key={c!.slug} href={`/entreprises/${c!.slug}`} className="font-semibold hover:underline">
                  {c!.name}
                </Link>
              ) : (
                <span key={c!.name}>{c!.name}</span>
              ),
            )}
          </p>
        )}
        <nav aria-label="Période" className="mt-4 inline-flex flex-wrap rounded-2xl bg-slate-100 p-1">
          {GLANCE_PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/admin/activite/${id}?periode=${p.key}`}
              aria-current={p.key === period.key ? "page" : undefined}
              className={cn("rounded-xl px-3 py-1.5 text-sm font-semibold", p.key === period.key ? "bg-white text-navy shadow" : "text-slate-600 hover:text-navy")}
            >
              {p.label}
            </Link>
          ))}
        </nav>
        <p className="mt-4 font-semibold text-navy" data-testid="activity-summary">
          {items.length} action{items.length > 1 ? "s" : ""} sur {period.long} : {activitySummary(items)}
        </p>
      </header>

      {days.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 p-4 text-slate-600">Aucune action enregistrée sur cette période (la personne a pu seulement parcourir des pages).</p>
      ) : (
        days.map((d) => (
          <section key={d.day} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-heading text-lg font-bold text-navy first-letter:uppercase">{d.day}</h2>
            <ol className="mt-3 divide-y divide-slate-100" data-testid="activity-list">
              {d.list.map((it, i) => {
                const Icon = ICON[it.kind];
                return (
                  <li key={i} className="flex gap-3 py-2.5">
                    <span className="w-12 shrink-0 pt-0.5 text-sm text-slate-500 tabular-nums">{timeFmt.format(new Date(it.at))}</span>
                    <Icon className="mt-0.5 size-4 shrink-0 text-teal-600" aria-hidden />
                    <span className="min-w-0 text-sm text-slate-800">
                      {it.label}
                      {it.detail && (
                        <>
                          {" : "}
                          {it.href ? (
                            <Link href={it.href} className="font-semibold text-navy hover:underline">
                              {it.detail}
                            </Link>
                          ) : (
                            <span className="font-semibold text-navy">{it.detail}</span>
                          )}
                        </>
                      )}
                      {it.times > 1 && (
                        <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                          × {it.times} (depuis {timeFmt.format(new Date(it.from))})
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}
