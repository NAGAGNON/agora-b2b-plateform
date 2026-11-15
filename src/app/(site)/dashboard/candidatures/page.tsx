import Link from "next/link";
import { AlertTriangle, ArrowRight, Bookmark, CalendarClock, CheckCircle2, ClipboardList, MapPinned, Search, Sparkles, Trophy } from "lucide-react";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BriefSchema } from "@/lib/tender-brief";
import { APPLICATION_GUIDE } from "@/lib/application-guide";
import { applicationPlan, dueToday } from "@/lib/application-plan";
import { cn } from "@/lib/cn";

export const metadata = { title: "Mes candidatures" };

const STAGES = ["QUALIFIED", "INTERESTED", "RESPONSE_PREPARING", "RESPONSE_SENT", "DISCUSSION", "NEGOTIATION", "WON", "LOST"] as const;
const SENT = ["RESPONSE_SENT", "DISCUSSION", "NEGOTIATION"];
const DAY = 86_400_000;
const nowDate = () => new Date();

/**
 * Mes candidatures : ce qu'il y a à faire aujourd'hui sur tous les appels d'offres suivis, les
 * prochaines échéances, puis chaque candidature (progression, prochaine étape, compte à rebours).
 */
export default async function ApplicationsPage() {
  const session = await requireCompany("/dashboard/candidatures");
  const supabase = await createClient();
  const { data } = await supabase
    .from("pipeline_items")
    .select("stage, guide_done, docs_done, submitted_at, created_at, updated_at, opportunity:opportunities(id, title, origin, external_buyer_name, response_deadline, city, department_code)")
    .eq("company_id", session.activeCompany.company.id)
    .in("stage", [...STAGES])
    .order("updated_at", { ascending: false });
  const rows = (data ?? []).map((d) => ({ ...d, opportunity: Array.isArray(d.opportunity) ? d.opportunity[0] : d.opportunity })).filter((d) => d.opportunity);
  const ids = rows.map((r) => r.opportunity!.id);
  const { data: briefs } = ids.length ? await createAdminClient().from("tender_briefs").select("opportunity_id, content").in("opportunity_id", ids) : { data: [] };
  const briefOf = new Map((briefs ?? []).map((b) => [b.opportunity_id, BriefSchema.safeParse(b.content)]));
  const now = nowDate();

  const cards = rows.map((r) => {
    const o = r.opportunity!;
    const parsed = briefOf.get(o.id);
    const brief = parsed?.success ? parsed.data : null;
    const done = (r.guide_done ?? []).map(Number);
    const sent = SENT.includes(r.stage) || r.stage === "WON" || r.stage === "LOST";
    const study = r.stage === "QUALIFIED" || r.stage === "INTERESTED";
    const plan = sent || study ? [] : applicationPlan(o.response_deadline, done, now, r.created_at);
    const days = o.response_deadline ? Math.ceil((new Date(o.response_deadline).getTime() - now.getTime()) / DAY) : null;
    const next = APPLICATION_GUIDE.findIndex((_, i) => !done.includes(i));
    return {
      id: o.id,
      title: o.title,
      buyer: o.external_buyer_name ?? "Besoin publié sur LinkProB2B",
      place: [o.city, o.department_code ? `(${o.department_code})` : null].filter(Boolean).join(" "),
      stage: r.stage,
      sent,
      days,
      progress: sent ? 100 : Math.round((done.length / APPLICATION_GUIDE.length) * 100),
      study,
      next: r.stage === "INTERESTED" ? "Commencer quand vous êtes prêt" : study ? "Décider si l'offre vous intéresse" : next >= 0 ? APPLICATION_GUIDE[next].title : null,
      due: dueToday(plan),
      visit: brief?.site_visit && /obligatoire/i.test(brief.site_visit) ? brief.site_visit : null,
      docs: brief ? { done: (r.docs_done ?? []).length, total: brief.documents.length } : null,
    };
  });
  const studying = cards.filter((c) => c.stage === "QUALIFIED");
  const kept = cards.filter((c) => c.stage === "INTERESTED");
  const preparing = cards.filter((c) => !c.sent && !c.study);
  const waiting = cards.filter((c) => SENT.includes(c.stage));
  const finished = cards.filter((c) => c.stage === "WON" || c.stage === "LOST");
  const won = cards.filter((c) => c.stage === "WON").length;
  const today = preparing.flatMap((c) => c.due.map((d) => ({ card: c, task: d })));
  const soon = [...preparing, ...kept].filter((c) => c.days !== null && c.days >= 0 && c.days <= 14).sort((a, b) => (a.days ?? 0) - (b.days ?? 0));

  return (
    <div className="space-y-8 pb-16">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-sky via-white to-teal-50 p-6 shadow-sm ring-1 ring-slate-200 sm:p-10">
        <div aria-hidden className="bg-tech-grid-light pointer-events-none absolute inset-0 -z-10 opacity-70" />
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 -z-10 size-80 animate-aurora rounded-full bg-teal/25 blur-3xl" />
        <p className="inline-flex animate-rise items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-bold tracking-wide text-teal-700 uppercase shadow-sm ring-1 ring-teal/20">
          <ClipboardList className="size-3.5" aria-hidden /> Mes candidatures
        </p>
        <h1 className="mt-4 animate-rise font-heading text-3xl font-extrabold text-navy [animation-delay:80ms] sm:text-4xl">Vos appels d&apos;offres, étape par étape</h1>
        <p className="mt-2 max-w-2xl animate-rise text-slate-600 [animation-delay:140ms]">
          Pour chaque appel d&apos;offres qui vous intéresse : les conditions, les pièces, la notation, une trame de mémoire technique, un planning jusqu&apos;au dépôt et un assistant qui répond à vos questions sur l&apos;avis.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { n: preparing.length, l: "en préparation" },
            { n: kept.length, l: "gardée" + (kept.length > 1 ? "s" : "") + " pour plus tard" },
            { n: waiting.length, l: "en attente du résultat" },
            { n: won, l: `marché${won > 1 ? "s" : ""} gagné${won > 1 ? "s" : ""}` },
            { n: finished.length ? `${Math.round((won / finished.length) * 100)} %` : "—", l: "taux de réussite" },
          ].map((x, i) => (
            <div key={x.l} className="plan-in rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-200" style={{ animationDelay: `${180 + i * 70}ms` }}>
              <p className="font-heading text-3xl font-extrabold text-navy tabular-nums">{x.n}</p>
              <p className="text-sm text-slate-600">{x.l}</p>
            </div>
          ))}
        </div>
      </section>

      {cards.length === 0 ? (
        <section className="plan-in rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
          <Sparkles className="mx-auto size-10 text-teal-700" aria-hidden />
          <h2 className="mt-3 font-heading text-xl font-bold text-navy">Aucune candidature pour l&apos;instant</h2>
          <p className="mx-auto mt-1 max-w-md text-slate-600">Sur un appel d&apos;offres qui vous plaît, cliquez sur « Ça m&apos;intéresse » : il arrive ici avec tout ce qu&apos;il faut pour y répondre.</p>
          <Link href="/opportunites" className="btn-shine mt-6 inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-3 font-semibold text-white transition hover:-translate-y-0.5">
            <Search className="size-4" aria-hidden /> Trouver un appel d&apos;offres
          </Link>
        </section>
      ) : (
        <>
          {(today.length > 0 || soon.length > 0) && (
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="plan-in rounded-3xl bg-navy p-6 text-white shadow-xl sm:p-8">
                <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-teal-200 uppercase">
                  <CheckCircle2 className="size-4" aria-hidden /> À faire aujourd&apos;hui
                </p>
                {today.length ? (
                  <ul className="mt-4 space-y-2">
                    {today.slice(0, 6).map(({ card, task }) => (
                      <li key={`${card.id}-${task.step}`}>
                        <Link href={`/dashboard/candidatures/${card.id}#etape-${task.step + 1}`} className="group flex items-start gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-white/10">
                          <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold", task.status === "late" ? "bg-rose-500 text-white" : "bg-teal text-navy")}>{task.step + 1}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold text-white">{task.title}</span>
                            <span className="block truncate text-sm text-white/60">
                              {task.status === "late" ? "En retard · " : ""}
                              {card.title}
                            </span>
                          </span>
                          <ArrowRight className="mt-1 size-4 shrink-0 text-teal transition group-hover:translate-x-0.5" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-white/70">Rien d&apos;urgent aujourd&apos;hui : vous êtes dans les temps.</p>
                )}
              </section>
              <section className="plan-in rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 [animation-delay:100ms] sm:p-8">
                <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-slate-500 uppercase">
                  <CalendarClock className="size-4 text-teal-700" aria-hidden /> Prochaines dates limites
                </p>
                {soon.length ? (
                  <ul className="mt-4 space-y-2">
                    {soon.slice(0, 6).map((c) => (
                      <li key={c.id}>
                        <Link href={`/dashboard/candidatures/${c.id}`} className="flex items-center gap-4 rounded-2xl p-3 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-teal">
                          <span className={cn("flex size-12 shrink-0 flex-col items-center justify-center rounded-xl font-heading leading-none", (c.days ?? 99) <= 5 ? "bg-rose-50 text-rose-700" : "bg-sky text-navy")}>
                            <span className="text-lg font-extrabold">{c.days}</span>
                            <span className="text-[10px] font-semibold">jour{(c.days ?? 0) > 1 ? "s" : ""}</span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-navy">{c.title}</span>
                            <span className="block truncate text-sm text-slate-500">{c.buyer}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-slate-600">Aucune date limite dans les 14 prochains jours.</p>
                )}
              </section>
            </div>
          )}

          {[
            { title: "En préparation", list: preparing },
            { title: "Gardées pour plus tard", list: kept },
            { title: "À l'étude", list: studying },
            { title: "En attente du résultat", list: waiting },
            { title: "Terminées", list: finished },
          ]
            .filter((s) => s.list.length)
            .map((s) => (
              <section key={s.title}>
                <h2 className="mb-4 font-heading text-xl font-bold text-navy">
                  {s.title} <span className="text-slate-400">({s.list.length})</span>
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {s.list.map((c, i) => (
                    <Link
                      key={c.id}
                      href={`/dashboard/candidatures/${c.id}`}
                      className="plan-in group flex flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg hover:ring-teal"
                      style={{ animationDelay: `${i * 70}ms` }}
                      data-testid="application-card"
                    >
                      <div className="flex items-start gap-4">
                        <MiniRing value={c.progress} won={c.stage === "WON"} />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 font-heading text-lg leading-snug font-bold text-navy group-hover:underline">{c.title}</p>
                          <p className="mt-1 truncate text-sm text-slate-500">
                            {c.buyer}
                            {c.place ? ` · ${c.place}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {c.stage === "WON" ? (
                          <Chip tone="teal" icon={Trophy}>
                            Gagné
                          </Chip>
                        ) : c.stage === "LOST" ? (
                          <Chip tone="slate">Pas retenu</Chip>
                        ) : c.sent ? (
                          <Chip tone="navy">Réponse envoyée</Chip>
                        ) : c.stage === "INTERESTED" ? (
                          <Chip tone="teal" icon={Bookmark}>
                            Pour plus tard
                          </Chip>
                        ) : c.study ? (
                          <Chip tone="slate">À l&apos;étude</Chip>
                        ) : null}
                        {!c.sent && c.days !== null ? (
                          <Chip tone={c.days <= 5 ? "rose" : "slate"} icon={CalendarClock}>
                            {c.days < 0 ? "Date limite dépassée" : c.days === 0 ? "Dernier jour" : `${c.days} jour${c.days > 1 ? "s" : ""} restant${c.days > 1 ? "s" : ""}`}
                          </Chip>
                        ) : null}
                        {!c.sent && c.visit && (
                          <Chip tone="rose" icon={MapPinned}>
                            Visite obligatoire
                          </Chip>
                        )}
                        {!c.sent && c.docs && c.docs.total > 0 && (
                          <Chip tone="slate">
                            {c.docs.done}/{c.docs.total} pièces
                          </Chip>
                        )}
                        {c.due.some((d) => d.status === "late") && (
                          <Chip tone="rose" icon={AlertTriangle}>
                            En retard sur le planning
                          </Chip>
                        )}
                      </div>
                      {!c.sent && c.next && (
                        <p className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm ring-1 ring-slate-200">
                          <span>
                            <span className="text-slate-500">Prochaine étape : </span>
                            <span className="font-semibold text-navy">{c.next}</span>
                          </span>
                          <ArrowRight className="size-4 shrink-0 text-teal-700 transition group-hover:translate-x-1" aria-hidden />
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
        </>
      )}
    </div>
  );
}

function MiniRing({ value, won }: { value: number; won: boolean }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-14 shrink-0">
      <svg viewBox="0 0 56 56" className="size-14 -rotate-90" aria-hidden>
        <circle cx="28" cy="28" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={won ? "#14c2ad" : "url(#mini-grad)"} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
        <defs>
          <linearGradient id="mini-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#14c2ad" />
            <stop offset="100%" stopColor="#7c6cff" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-navy tabular-nums">{value}%</span>
    </div>
  );
}

function Chip({ tone, icon: Icon, children }: { tone: "teal" | "rose" | "slate" | "navy"; icon?: typeof Trophy; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        tone === "teal" && "bg-teal text-navy",
        tone === "rose" && "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
        tone === "slate" && "bg-slate-100 text-slate-700",
        tone === "navy" && "bg-navy text-white",
      )}
    >
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </span>
  );
}
