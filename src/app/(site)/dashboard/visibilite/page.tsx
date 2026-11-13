import Link from "next/link";
import { CalendarDays, Crown, Eye, Mail, Megaphone, Target, Users } from "lucide-react";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { Notice } from "@/components/ui/notice";
import { BoostForm, type TargetingOptions } from "@/components/dashboard/boost-form";
import { CancelBoostButton } from "@/components/dashboard/boost-actions";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { freeLaunch } from "@/lib/billing/entitlements";
import { PLAN_LABEL, type PlanCode } from "@/lib/billing/plans";
import { BOOST_STATUS_LABEL, totalPresentations, type Daily, type Duration } from "@/lib/visibility";
import { includedPresentationsLeft } from "@/lib/visibility-credit";
import { formatDate } from "@/lib/format";
import { getSectors } from "@/lib/queries/platform";
import { groupSectors } from "@/lib/sector-families";
import { REGIONS } from "@/lib/geo";
import { COMPANY_KIND_LABELS, COMPANY_SIZE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/cn";

export const metadata = { title: "Visibilité" };

const DAY = 86_400_000;
const nowMs = () => Date.now();
const nf = (n: number) => n.toLocaleString("fr-FR");
const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-teal text-navy",
  PENDING: "bg-sky text-navy ring-1 ring-sky-200",
  ENDED: "bg-slate-100 text-slate-600",
  REJECTED: "bg-red-50 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

/**
 * Offre « Visibilité » : demande (validée par l'équipe) et suivi réel jour après jour : présentations
 * réalisées (espace des entreprises inscrites et e-mails), vues de la fiche ou du besoin, mise en avant.
 */
export default async function VisibilityPage(props: PageProps<"/dashboard/visibilite">) {
  const sp = await props.searchParams;
  const session = await requireCompany("/dashboard/visibilite");
  const company = session.activeCompany.company;
  const supabase = await createClient();
  const admin = createAdminClient();
  const [{ data: needs }, { data: boosts }, free, sectors, audienceRaw, credit] = await Promise.all([
    supabase.from("opportunities").select("id, title").eq("company_id", company.id).eq("origin", "INTERNAL").eq("status", "PUBLISHED").order("created_at", { ascending: false }).limit(20),
    supabase.from("visibility_boosts").select("*").eq("company_id", company.id).order("created_at", { ascending: false }).limit(20),
    freeLaunch(),
    getSectors(),
    supabase.rpc("boost_audience", { p_company_id: company.id, p_targeting: {} }),
    includedPresentationsLeft(company.id),
  ]);
  const aud = (audienceRaw.data ?? {}) as { members?: number; prospects?: number };
  const titles = new Map((needs ?? []).map((n) => [n.id, n.title]));
  const sectorLabel = new Map(sectors.map((s) => [s.slug, s.label]));
  const options: TargetingOptions = {
    sectors: groupSectors(sectors).map(({ family, sectors: items }) => ({ family: family.label, items: items.map((i) => ({ slug: i.slug, label: i.label })) })),
    regions: REGIONS.map((r) => r.name),
    sizes: Object.entries(COMPANY_SIZE_LABELS).map(([value, label]) => ({ value, label: label.replace(/ \(.*\)$/, "") })),
    kinds: Object.entries(COMPANY_KIND_LABELS).map(([value, label]) => ({ value, label })),
  };

  // Suivi réel par offre : présentations par jour (14 derniers jours), vues depuis le démarrage
  const now = nowMs();
  const stats = new Map(
    await Promise.all(
      (boosts ?? [])
        .filter((b) => b.starts_at)
        .map(async (b) => {
          const path = b.opportunity_id ? `/opportunites/${b.opportunity_id}` : `/entreprises/${company.slug}`;
          const [{ data: pres }, { count: views }] = await Promise.all([
            admin.from("boost_presentations").select("created_at, prospect_id").eq("boost_id", b.id).limit(10_000),
            admin.from("page_views").select("id", { count: "exact", head: true }).eq("path", path).gte("created_at", b.starts_at!),
          ]);
          const days = Array.from({ length: 14 }, (_, i) => {
            const d = new Date(now - (13 - i) * DAY).toISOString().slice(0, 10);
            return { d, n: (pres ?? []).filter((p) => p.created_at.slice(0, 10) === d).length };
          });
          return [b.id, { members: (pres ?? []).filter((p) => !p.prospect_id).length, emails: (pres ?? []).filter((p) => p.prospect_id).length, views: views ?? 0, days }] as const;
        }),
    ),
  );
  const isAdmin = session.activeCompany.role === "COMPANY_ADMIN";
  const targets = [{ value: "COMPANY", label: `Mon entreprise : ${company.name}` }, ...(needs ?? []).map((n) => ({ value: n.id, label: `Mon besoin : ${n.title}` }))];
  const chips = (t: unknown) => {
    const g = (t ?? {}) as { sectors?: string[]; regions?: string[]; sizes?: string[]; kinds?: string[] };
    return [
      ...(g.regions ?? []),
      ...(g.sizes ?? []).map((s) => COMPANY_SIZE_LABELS[s as keyof typeof COMPANY_SIZE_LABELS]?.replace(/ \(.*\)$/, "") ?? s),
      ...(g.kinds ?? []).map((k) => COMPANY_KIND_LABELS[k as keyof typeof COMPANY_KIND_LABELS] ?? k),
      ...(g.sectors ?? []).map((s) => sectorLabel.get(s) ?? s),
    ];
  };

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        icon={<Megaphone />}
        image="/images/illustrations/reunion.webp"
        title="Visibilité"
        description="Faites connaître votre entreprise ou votre besoin : présentation chaque jour à des entreprises ciblées (inscrites et de notre base, par e-mail) et affichage « À la une ». Suivi jour après jour."
      />
      {free && (
        <Notice tone="success" title="Offert pendant la phase de lancement">
          Profitez-en : les offres de visibilité sont offertes pendant la phase de lancement de LinkProB2B.
        </Notice>
      )}

      {isAdmin ? (
        <BoostForm
          targets={targets}
          freeLaunch={free}
          initialAudience={{ members: Number(aud.members ?? 0), prospects: Number(aud.prospects ?? 0) }}
          includedLeft={free ? 0 : credit.left}
          includedPlan={PLAN_LABEL[credit.plan as PlanCode] ?? credit.plan}
          options={options}
          defaultTarget={typeof sp.cible === "string" ? sp.cible : undefined}
        />
      ) : (
        <Notice tone="info">Seul un administrateur de l&apos;entreprise peut demander une offre de visibilité.</Notice>
      )}

      <section aria-labelledby="mes-offres">
        <h2 id="mes-offres" className="font-heading text-2xl font-extrabold text-navy">
          Mes offres de visibilité
        </h2>
        {!boosts?.length ? (
          <p className="mt-3 rounded-3xl bg-white p-6 text-slate-600 shadow-sm ring-1 ring-slate-200">Aucune offre pour l&apos;instant : lancez la première ci-dessus.</p>
        ) : (
          <ul className="mt-4 space-y-5">
            {boosts.map((b, i) => {
              const s = stats.get(b.id);
              const planned = totalPresentations(b.daily_presentations as Daily, b.duration_days as Duration);
              const done = (s?.members ?? 0) + (s?.emails ?? 0);
              const pct = planned ? Math.min(100, Math.round((done / planned) * 100)) : 0;
              const elapsed = b.starts_at ? Math.min(b.duration_days, Math.max(0, Math.floor((now - new Date(b.starts_at).getTime()) / DAY))) : 0;
              const max = Math.max(1, ...(s?.days.map((d) => d.n) ?? [1]));
              const tags = chips(b.targeting);
              return (
                <li key={b.id} className="plan-in overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:shadow-lg" style={{ animationDelay: `${i * 80}ms` }}>
                  <div className="flex flex-wrap items-start justify-between gap-3 bg-gradient-to-r from-navy to-navy-900 p-5 text-white">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold tracking-wide text-teal uppercase">{b.opportunity_id ? "Besoin" : "Entreprise"}</p>
                      <p className="mt-0.5 truncate font-heading text-lg font-extrabold">{b.opportunity_id ? (titles.get(b.opportunity_id) ?? "Besoin") : company.name}</p>
                      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-300">
                        {b.daily_presentations > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Users className="size-4" aria-hidden /> {b.daily_presentations} / jour · {b.duration_days} jours
                          </span>
                        )}
                        {b.featured_days > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Crown className="size-4" aria-hidden /> {b.featured_days} jours « À la une »
                          </span>
                        )}
                        {b.starts_at && b.ends_at && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="size-4" aria-hidden /> du {formatDate(b.starts_at)} au {formatDate(b.ends_at)}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn("rounded-full px-3 py-1 text-xs font-bold", STATUS_STYLE[b.status] ?? "bg-slate-100 text-slate-600")}>{BOOST_STATUS_LABEL[b.status] ?? b.status}</span>
                      {b.status === "PENDING" && isAdmin && <CancelBoostButton id={b.id} />}
                    </div>
                  </div>

                  <div className="space-y-5 p-5">
                    {tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Target className="size-4 text-teal-700" aria-label="Ciblage" />
                        {tags.map((t) => (
                          <span key={t} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {b.status === "REJECTED" && b.note && <p className="text-sm text-slate-600">Motif : {b.note}</p>}
                    {b.status === "PENDING" && <p className="text-sm text-slate-600">En attente de validation par l&apos;équipe (sous 24 h ouvrées). Le suivi apparaîtra ici dès le démarrage.</p>}
                    {s && (
                      <>
                        <div className="grid gap-3 sm:grid-cols-4">
                          {[
                            { icon: Users, l: "Entreprises inscrites", v: s.members },
                            { icon: Mail, l: "Entreprises par e-mail", v: s.emails },
                            { icon: Eye, l: b.opportunity_id ? "Vues du besoin" : "Vues de votre fiche", v: s.views },
                            { icon: CalendarDays, l: "Jours écoulés", v: `${elapsed} / ${b.duration_days}` },
                          ].map(({ icon: Icon, l, v }) => (
                            <div key={l} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                                <Icon className="size-4 text-teal-700" aria-hidden /> {l}
                              </p>
                              <p className="mt-1 font-heading text-2xl font-extrabold text-navy">{typeof v === "number" ? nf(v) : v}</p>
                            </div>
                          ))}
                        </div>
                        {planned > 0 && (
                          <div>
                            <div className="flex justify-between text-sm">
                              <span className="font-semibold text-navy">Présentations réalisées</span>
                              <span className="text-slate-600">
                                {nf(done)} / {nf(planned)} · {pct} %
                              </span>
                            </div>
                            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-gradient-to-r from-teal to-electric transition-[width] duration-700" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-navy">Présentations par jour (14 derniers jours)</p>
                          <div className="mt-3 flex h-24 items-end gap-1.5" role="img" aria-label="Présentations par jour sur les 14 derniers jours">
                            {s.days.map((d) => (
                              <div key={d.d} className="group relative flex h-full flex-1 flex-col justify-end">
                                <div
                                  className="rounded-t-md bg-gradient-to-t from-teal-600 to-teal transition-all duration-500 group-hover:from-navy group-hover:to-electric"
                                  style={{ height: `${Math.max(d.n ? 8 : 2, (d.n / max) * 100)}%` }}
                                />
                                <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-navy px-1.5 py-0.5 text-[10px] whitespace-nowrap text-white opacity-0 transition group-hover:opacity-100">
                                  {new Date(d.d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} : {d.n}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {b.opportunity_id && b.status === "ACTIVE" && (
                          <p className="text-sm text-slate-600">
                            Détail des entreprises prévenues dans le{" "}
                            <Link href={`/dashboard/opportunites/${b.opportunity_id}`} className="font-semibold text-teal-700 hover:underline">
                              suivi du besoin
                            </Link>
                            .
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
