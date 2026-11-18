import Link from "next/link";
import { CalendarDays, Crown, Eye, Mail, Megaphone, MessageSquare, Target, Users } from "lucide-react";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { Notice } from "@/components/ui/notice";
import { BoostForm, type TargetingOptions } from "@/components/dashboard/boost-form";
import { CancelBoostButton, EditAdForm } from "@/components/dashboard/boost-actions";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { freeLaunch } from "@/lib/billing/entitlements";
import { PLAN_LABEL, type PlanCode } from "@/lib/billing/plans";
import { BOOST_STATUS_LABEL, reachLabel, totalPresentations, type Daily, type Duration } from "@/lib/visibility";
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
 * Offre « Visibilité » : demande (démarrage immédiat) et suivi réel jour après jour : présentations
 * réalisées (espace des entreprises inscrites et e-mails), vues de la fiche ou du besoin, mise en avant.
 */
export default async function VisibilityPage(props: PageProps<"/dashboard/visibilite">) {
  const sp = await props.searchParams;
  const session = await requireCompany("/dashboard/visibilite");
  const company = session.activeCompany.company;
  const supabase = await createClient();
  const admin = createAdminClient();
  const [{ data: needs }, { data: boosts }, free, sectors, audienceRaw, credit, { data: reachRaw }] = await Promise.all([
    supabase.from("opportunities").select("id, title").eq("company_id", company.id).eq("origin", "INTERNAL").eq("status", "PUBLISHED").order("created_at", { ascending: false }).limit(20),
    supabase.from("visibility_boosts").select("*").eq("company_id", company.id).order("created_at", { ascending: false }).limit(20),
    freeLaunch(),
    getSectors(),
    supabase.rpc("boost_audience", { p_company_id: company.id, p_targeting: {} }),
    includedPresentationsLeft(company.id),
    supabase.rpc("public_prospect_reach"),
  ]);
  const reach = reachRaw as { total?: number; reachable?: number } | null;
  // Annonce pré-remplie depuis la fiche ; taux réels des derniers envois pour une estimation honnête
  const [{ data: prof }, { data: co }, rates] = await Promise.all([
    supabase.from("company_profiles").select("tagline, description, sectors").eq("company_id", company.id).maybeSingle(),
    supabase.from("companies").select("name, city, logo_path").eq("id", company.id).single(),
    recentEmailRates(admin),
  ]);
  const firstSector = prof?.sectors?.[0];
  const adDefaults = {
    company: co?.name ?? company.name,
    city: co?.city ?? null,
    title: (prof?.tagline || (firstSector ? `${sectors.find((x) => x.slug === firstSector)?.label ?? ""}${co?.city ? ` à ${co.city}` : ""}` : "")).slice(0, 90),
    text: (prof?.description ?? "").replace(/\s+/g, " ").trim().slice(0, 400),
    points: [] as string[],
  };
  // Fiche prête ? Les entreprises présentées cliquent vers elle : une fiche complète donne de meilleurs résultats
  const profileChecks = [
    { label: "Logo", ok: Boolean(co?.logo_path) },
    { label: "Présentation de l'activité (80 caractères au moins)", ok: (prof?.description ?? "").trim().length >= 80 },
    { label: "Métier", ok: (prof?.sectors ?? []).length > 0 },
    { label: "Ville", ok: Boolean(co?.city) },
  ];
  const aud = (audienceRaw.data ?? {}) as { members?: number; prospects?: number };
  const titles = new Map((needs ?? []).map((n) => [n.id, n.title]));
  const sectorLabel = new Map(sectors.map((s) => [s.slug, s.label]));
  const options: TargetingOptions = {
    sectors: groupSectors(sectors).map(({ family, sectors: items }) => ({ family: family.label, items: items.map((i) => ({ slug: i.slug, label: i.label })) })),
    regions: REGIONS.map((r) => r.name),
    sizes: Object.entries(COMPANY_SIZE_LABELS).map(([value, label]) => ({ value, label: label.replace(/ \(.*\)$/, "") })),
    kinds: Object.entries(COMPANY_KIND_LABELS).map(([value, label]) => ({ value, label })),
  };

  const { data: members } = await admin.from("company_members").select("user_id").eq("company_id", company.id);
  const memberIds = (members ?? []).map((m) => m.user_id).filter(Boolean);
  // Suivi réel par offre : présentations par jour (14 derniers jours), vues depuis le démarrage
  const now = nowMs();
  const stats = new Map(
    await Promise.all(
      (boosts ?? [])
        .filter((b) => b.starts_at)
        .map(async (b) => {
          const path = b.opportunity_id ? `/opportunites/${b.opportunity_id}` : `/entreprises/${company.slug}`;
          const [{ data: pres }, { count: views }, { data: camp }] = await Promise.all([
            admin.from("boost_presentations").select("created_at, prospect_id").eq("boost_id", b.id).limit(10_000),
            admin.from("page_views").select("id", { count: "exact", head: true }).eq("path", path).gte("created_at", b.starts_at!),
            admin.from("outreach_campaigns").select("id").eq("kind", "BOOST").eq("boost_id", b.id).maybeSingle(),
          ]);
          // E-mails lus (ouverture ou clic) et clics vers la fiche, par entreprise destinataire
          const { data: ev } = camp ? await admin.from("outreach_events").select("recipient_id, type").eq("campaign_id", camp.id).in("type", ["OPEN", "CLICK"]).limit(20_000) : { data: [] };
          const read = new Set((ev ?? []).map((e) => e.recipient_id)).size;
          // Messages reçus depuis le début : conversations ouvertes par d'autres entreprises
          const { count: messages } = await admin
            .from("conversations")
            .select("id", { count: "exact", head: true })
            .or(`buyer_company_id.eq.${company.id},supplier_company_id.eq.${company.id}`)
            .gte("created_at", b.starts_at!)
            .not("created_by", "in", `(${memberIds.join(",") || "00000000-0000-0000-0000-000000000000"})`);
          const clicks = new Set((ev ?? []).filter((e) => e.type === "CLICK").map((e) => e.recipient_id)).size;
          const days = Array.from({ length: 14 }, (_, i) => {
            const d = new Date(now - (13 - i) * DAY).toISOString().slice(0, 10);
            return { d, n: (pres ?? []).filter((p) => p.created_at.slice(0, 10) === d).length };
          });
          return [b.id, { members: (pres ?? []).filter((p) => !p.prospect_id).length, emails: (pres ?? []).filter((p) => p.prospect_id).length, views: views ?? 0, read, clicks, messages: messages ?? 0, days }] as const;
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
        title="Campagnes de visibilité"
        description="On fait votre prospection pour vous : choisissez votre cible et votre annonce, nous présentons votre entreprise chaque jour à des entreprises de votre métier et de votre zone (inscrites et de notre base, par e-mail). Suivi jour après jour."
      />
      {free && (
        <Notice tone="success" title="Gratuit pendant la phase de lancement">
          Profitez-en : les campagnes de visibilité sont gratuites pendant la phase de lancement de LinkProB2B.
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
          baseLabel={reachLabel(reach ? { total: Number(reach.total ?? 0), reachable: Number(reach.reachable ?? 0) } : null)}
          defaultTarget={typeof sp.cible === "string" ? sp.cible : undefined}
          adDefaults={adDefaults}
          rates={rates}
          profileChecks={profileChecks}
        />
      ) : (
        <Notice tone="info">Seul un administrateur de l&apos;entreprise peut lancer une campagne.</Notice>
      )}

      <section aria-labelledby="mes-offres">
        <h2 id="mes-offres" className="font-heading text-2xl font-extrabold text-navy">
          Mes campagnes
        </h2>
        {!boosts?.length ? (
          <p className="mt-3 rounded-3xl bg-white p-6 text-slate-600 shadow-sm ring-1 ring-slate-200">Aucune campagne pour l&apos;instant : lancez la première ci-dessus.</p>
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
                    {b.ad_title && (
                      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200" data-testid="campaign-ad">
                        <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                          Votre annonce ·{" "}
                          {b.ad_status === "APPROVED" ? (
                            <span className="text-teal-700">validée, les e-mails partent</span>
                          ) : b.ad_status === "REJECTED" ? (
                            <span className="text-rose-700">à corriger</span>
                          ) : (
                            <span className="text-navy">en relecture par notre équipe (en général sous 24 h ouvrées)</span>
                          )}
                        </p>
                        <p className="mt-1 font-semibold text-navy">{b.ad_title}</p>
                        {b.ad_status === "REJECTED" && b.ad_review_note && <p className="mt-1 text-sm text-rose-700">À corriger : {b.ad_review_note}</p>}
                        {b.ad_status === "REJECTED" && isAdmin && (b.status === "ACTIVE" || b.status === "PENDING") && (
                          <EditAdForm id={b.id} title={b.ad_title} points={b.ad_points ?? []} text={b.ad_text} />
                        )}
                      </div>
                    )}
                    {b.status === "PENDING" && <p className="text-sm text-slate-600">En attente de démarrage. Le suivi apparaîtra ici dès le démarrage.</p>}
                    {s && (
                      <>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {[
                            { icon: Users, l: "Entreprises inscrites", v: s.members },
                            { icon: Mail, l: "Entreprises par e-mail", v: s.emails },
                            { icon: Eye, l: "E-mails lus", v: s.read },
                            { icon: Eye, l: "Clics vers votre fiche", v: s.clicks },
                            { icon: Eye, l: b.opportunity_id ? "Vues du besoin" : "Vues de votre fiche", v: s.views },
                            { icon: MessageSquare, l: "Messages reçus", v: s.messages },
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

/**
 * Taux d'ouverture et de clic réels des e-mails envoyés par le site ces 30 derniers jours (veille) :
 * base de l'estimation affichée. Rien sans un volume suffisant (au moins 100 envois).
 */
async function recentEmailRates(db: ReturnType<typeof createAdminClient>): Promise<{ open: number; click: number } | null> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: sends } = await db.from("veille_sends").select("id").gte("created_at", since).limit(5000);
  const ids = (sends ?? []).map((x) => x.id);
  if (ids.length < 100) return null;
  const opened = new Set<string>();
  const clicked = new Set<string>();
  for (let i = 0; i < ids.length; i += 500) {
    const { data: ev } = await db.from("veille_events").select("send_id, type").in("send_id", ids.slice(i, i + 500)).in("type", ["OPEN", "CLICK"]);
    for (const e of ev ?? []) (e.type === "OPEN" ? opened : clicked).add(e.send_id);
  }
  return { open: opened.size / ids.length, click: clicked.size / ids.length };
}
