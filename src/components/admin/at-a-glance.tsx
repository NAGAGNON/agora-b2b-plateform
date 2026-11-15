import Link from "next/link";
import { ClipboardList, Eye, FileStack, FolderOpen, Mail, MessageCircleQuestion, UserPlus, Users } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

const DAY = 86_400_000;
export const GLANCE_PERIODS = [
  { key: "24h", label: "24 h", long: "les dernières 24 heures", days: 1 },
  { key: "48h", label: "48 h", long: "les dernières 48 heures", days: 2 },
  { key: "7j", label: "7 jours", long: "les 7 derniers jours", days: 7 },
  { key: "30j", label: "30 jours", long: "les 30 derniers jours", days: 30 },
] as const;

const pl = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/**
 * « En bref » de l'administration : la période choisie en une phrase, huit grands chiffres et la liste
 * des inscrits venus sur la période. Comptes de l'équipe et de démonstration exclus.
 */
export async function AtAGlance({ periodKey, now }: { periodKey: string | undefined; now: number }) {
  const period = GLANCE_PERIODS.find((p) => p.key === periodKey) ?? GLANCE_PERIODS[0];
  const since = new Date(now - period.days * DAY).toISOString();
  const db = createAdminClient();
  const { data: team } = await db.from("users").select("id").or("is_internal.eq.true,is_demo.eq.true");
  const excluded = new Set((team ?? []).map((u) => u.id));
  const notTeam = <T extends { user_id?: string | null; id?: string }>(list: T[] | null) => (list ?? []).filter((r) => !excluded.has((r.user_id ?? r.id) as string));

  const [signups, visitors, offerViews, appViews, items, questions, needs, emails] = await Promise.all([
    db.from("users").select("id").gte("created_at", since).limit(2000),
    db.from("users").select("id, full_name, email, created_at, last_seen_at").gte("last_seen_at", since).order("last_seen_at", { ascending: false }).limit(300),
    db.from("analytics_events").select("user_id").eq("event_name", "view_opportunity").gte("created_at", since).limit(20000),
    db.from("analytics_events").select("user_id").eq("event_name", "view_application").gte("created_at", since).limit(20000),
    db.from("pipeline_items").select("stage, created_at, work_started_at, updated_by, companies!inner(is_demo)").eq("companies.is_demo", false).or(`created_at.gte.${since},work_started_at.gte.${since}`).limit(2000),
    db.from("application_questions").select("user_id").gte("created_at", since).limit(2000),
    db.from("opportunities").select("id", { count: "exact", head: true }).eq("origin", "INTERNAL").eq("is_demo", false).gte("created_at", since),
    db.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "SENT").gte("sent_at", since),
  ]);
  const newUsers = notTeam(signups.data).length;
  const people = notTeam(visitors.data);
  const returning = people.filter((u) => u.created_at < since);
  const OPENED = ["RESPONSE_PREPARING", "RESPONSE_SENT", "DISCUSSION", "NEGOTIATION", "WON", "LOST"];
  const realItems = notTeam((items.data ?? []).map((i) => ({ ...i, user_id: i.updated_by })));
  const opened = realItems.filter((i) => i.created_at >= since && OPENED.includes(i.stage)).length;
  const working = realItems.filter((i) => i.work_started_at && i.work_started_at >= since).length;
  const tiles = [
    { label: ["nouvel inscrit", "nouveaux inscrits"], value: newUsers, icon: UserPlus, href: "/admin/inscriptions" },
    { label: ["inscrit revenu", "inscrits revenus"], value: returning.length, icon: Users, href: "/admin/fidelite" },
    { label: ["offre vue", "offres vues"], value: (offerViews.data ?? []).length, icon: Eye, href: null },
    { label: ["fiche de candidature ouverte", "fiches de candidature ouvertes"], value: notTeam(appViews.data).length, icon: ClipboardList, href: "/admin/candidatures" },
    { label: ["dossier ouvert", "dossiers ouverts"], value: opened, icon: FolderOpen, href: "/admin/candidatures", sub: `${working} avec travail commencé` },
    { label: ["question à l'assistant", "questions à l'assistant"], value: notTeam(questions.data).length, icon: MessageCircleQuestion, href: "/admin/candidatures" },
    { label: ["besoin publié", "besoins publiés"], value: needs.count ?? 0, icon: FileStack, href: "/admin/besoins" },
    { label: ["e-mail envoyé", "e-mails envoyés"], value: emails.count ?? 0, icon: Mail, href: "/admin/emails" },
  ];
  const summary = `${pl(newUsers, "nouvel inscrit", "nouveaux inscrits")}, ${pl(returning.length, "inscrit revenu", "inscrits revenus")} sur le site, ${pl(notTeam(appViews.data).length, "fiche de candidature ouverte", "fiches de candidature ouvertes")} et ${pl(opened, "dossier ouvert", "dossiers ouverts")}.`;

  return (
    <section className="space-y-4" data-testid="at-a-glance">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-navy-900 p-6 text-white shadow-xl sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-72 animate-aurora rounded-full bg-teal/25 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-wide text-teal-200 uppercase">En bref</p>
            <h2 className="mt-1 font-heading text-2xl font-extrabold text-white">Sur {period.long}</h2>
          </div>
          <nav aria-label="Période" className="inline-flex rounded-2xl bg-white/10 p-1 ring-1 ring-white/15">
            {GLANCE_PERIODS.map((p) => (
              <Link
                key={p.key}
                href={`/admin?bref=${p.key}`}
                aria-current={p.key === period.key ? "page" : undefined}
                className={cn("rounded-xl px-3.5 py-2 text-sm font-semibold transition", p.key === period.key ? "bg-white text-navy shadow" : "text-white/75 hover:bg-white/10 hover:text-white")}
              >
                {p.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="relative mt-4 max-w-3xl text-lg leading-relaxed text-white/85">{summary}</p>
        <ul className="relative mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {tiles.map((t) => {
            const body = (
              <>
                <t.icon className="size-5 text-teal-200" aria-hidden />
                <p className="mt-3 font-heading text-4xl font-extrabold tabular-nums">{t.value}</p>
                <p className="mt-1 text-sm leading-snug text-white/80">{t.value > 1 ? t.label[1] : t.label[0]}</p>
                {t.sub && <p className="mt-1 text-xs font-semibold text-teal-200">{t.sub}</p>}
              </>
            );
            return (
              <li key={t.label[1]}>
                {t.href ? (
                  <Link href={t.href} className="block h-full rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-white/[0.12]">
                    {body}
                  </Link>
                ) : (
                  <div className="h-full rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="relative mt-4 text-sm text-white/60">Comptes de l&apos;équipe et de démonstration exclus. Un clic sur un chiffre ouvre le détail.</p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-xl font-bold text-navy">Qui est venu · {period.label}</h2>
          <Link href={`/admin/candidatures?periode=${period.key}`} className="text-sm font-semibold text-teal-700 hover:underline">
            Voir ce que chacun a fait sur les candidatures →
          </Link>
        </div>
        {people.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-slate-600">Aucun inscrit venu sur cette période.</p>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {people.slice(0, 24).map((u) => {
              const isNew = u.created_at >= since;
              const name = u.full_name || u.email;
              return (
                <li key={u.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal to-electric text-xs font-bold text-navy" aria-hidden>
                    {name
                      .split(/[\s@.]+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((w) => w[0]!.toUpperCase())
                      .join("")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-navy">{name}</span>
                    <span className="block text-xs text-slate-500">Vu le {u.last_seen_at ? formatDateTime(u.last_seen_at) : "—"}</span>
                  </span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", isNew ? "bg-teal-50 text-teal-800 ring-1 ring-teal/20" : "bg-slate-200 text-slate-700")}>{isNew ? "Nouveau" : "Revenu"}</span>
                </li>
              );
            })}
          </ul>
        )}
        {people.length > 24 && <p className="mt-3 text-sm text-slate-500">… et {people.length - 24} autre(s).</p>}
      </div>
    </section>
  );
}
