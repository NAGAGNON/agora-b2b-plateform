import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  FileText,
  History,
  Landmark,
  MapPin,
  Tag,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { pageMetadata, siteUrl } from "@/lib/seo";
import { daysUntil, deadlineLabel, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { SectorVisual } from "@/components/opportunities/sector-visual";
import { BuyerOfficial } from "@/components/buyers/buyer-official";
import { FollowBuyerButton } from "@/components/buyers/follow-button";
import { buyerAlertKeywords } from "@/lib/buyer-follow";
import { JsonLd, breadcrumbLd } from "@/components/json-ld";
import { buttonClasses } from "@/components/ui/button";
import { getLocationLabel, getSectorLabels } from "@/lib/queries/platform";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getSession } from "@/lib/auth";
import { UpgradeGate } from "@/components/billing/upsell";
import { GoogleButton } from "@/components/auth/google-button";
import { clip } from "@/lib/format";
import { AlertLeadForm } from "@/components/alert-lead-form";
import { MemberProofCompact } from "@/components/home/member-proof";
import { getDepartments, getMemberCompanies, getPlatformStats, liveStats } from "@/lib/queries/platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { BriefSchema } from "@/lib/tender-brief";
import { regionByName } from "@/lib/geo";
import { ClipboardCheck, Layers, Sparkles } from "lucide-react";

const nf = new Intl.NumberFormat("fr-FR");

const getBuyer = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("buyer_opportunities", {
    p_slug: slug,
    p_limit: 100,
  });
  if (!data?.length) return null;
  return {
    name: data[0].buyer_name,
    open: data.filter((o) => o.is_open),
    past: data.filter((o) => !o.is_open),
    all: data,
  };
});

/** Familles d'acheteurs (d'après le nom officiel) : pour proposer des acheteurs du même type. */
const BUYER_FAMILIES: { label: string; re: RegExp }[] = [
  { label: "Bailleurs sociaux", re: /habitat|logement|\bhlm\b|office public|\bopac?\b|\bsa d'hlm\b/i },
  { label: "Établissements de santé", re: /centre hospitalier|\bchu\b|\bchr\b|h[ôo]pita|\bghu?\b|\behpad\b|groupement hospitalier/i },
  { label: "Intercommunalités", re: /m[ée]tropole|communaut[ée] (d'agglom[ée]ration|de communes|urbaine)|agglo|syndicat intercommunal|\bsivo?m?\b/i },
  { label: "Départements", re: /d[ée]partement|conseil d[ée]partemental/i },
  { label: "Régions", re: /\br[ée]gion\b|conseil r[ée]gional|collectivit[ée] territoriale/i },
  { label: "Communes", re: /\bcommune\b|\bmairie\b|\bville de\b/i },
  { label: "Enseignement supérieur et recherche", re: /universit|\bcnrs\b|\binrae?\b|\binserm\b|[ée]cole (nationale|sup[ée]rieure)/i },
  { label: "Services d'incendie et de secours", re: /\bsdis\b|incendie et de secours/i },
  { label: "Énergie, transports et réseaux", re: /\bsncf\b|\bratp\b|\bedf\b|\brte\b|enedis|grdf|[ée]lectricit[ée]|\bgaz\b|transport/i },
];
const familyOf = (name: string) => BUYER_FAMILIES.find((f) => f.re.test(name)) ?? null;

/** Tous les acheteurs publics référencés (nom, région, marchés ouverts), en cache 30 minutes. */
const allBuyers = unstable_cache(
  async () => {
    const { data, error } = await createAdminClient().rpc("public_buyers", { p_limit: 10000, p_offset: 0 });
    if (error) throw error;
    return (data ?? []).map((x) => ({ name: x.name, slug: x.slug, region: x.region, open: Number(x.open_count), total: Number(x.total_count) }));
  },
  ["public-buyers-all-v1"],
  { revalidate: 1800 },
);

/** Les valeurs les plus fréquentes d'une liste (métiers, départements de l'acheteur). */
function top(values: (string | null)[], n: number) {
  const m = new Map<string, number>();
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

export async function generateMetadata(props: PageProps<"/acheteurs/[slug]">) {
  const { slug } = await props.params;
  const b = await getBuyer(slug);
  if (!b) return { title: "Acheteur introuvable", robots: { index: false } };
  // Compteurs réels (la liste chargée est limitée à 100 annonces)
  const real = (await allBuyers().catch(() => [])).find((x) => x.slug === slug);
  const n = Math.max(b.open.length, real?.open ?? 0);
  const year = new Date().getFullYear();
  const total = Math.max(b.all.length, real?.total ?? 0);
  return pageMetadata({
    // Formulation des recherches réelles (« [acheteur] appel d'offre »), année pour la fraîcheur
    title: n
      ? clip(`Appels d'offres ${b.name} ${year} : ${nf.format(n)} en cours`, 64)
      : clip(`Appels d'offres ${b.name} : historique ${year}`, 64),
    description: `${n ? `${nf.format(n)} appel${n > 1 ? "s" : ""} d'offres en cours` : "Aucun appel d'offres en cours"} et historique de ${nf.format(total)} annonce${total > 1 ? "s" : ""} de ${b.name} : objet, lieu, date limite, délai pour répondre, d'après les annonces officielles (BOAMP, TED). Alerte e-mail gratuite à chaque nouveau marché.`,
    path: `/acheteurs/${slug}`,
    // Indexée avec au moins un appel d'offres ouvert, ou un historique réel (2 annonces ou plus) :
    // une page bien classée ne disparaît plus de Google dès que les marchés de l'acheteur se terminent
    noindex: n === 0 && b.all.length < 2,
  });
}

/** Repères tirés des annonces enregistrées : prochaine date limite et temps moyen laissé pour répondre. */
function buyerInsights(
  all: { published_at: string | null; response_deadline: string | null }[],
  open: { response_deadline: string | null }[],
) {
  const now = Date.now();
  const nextDeadline =
    open
      .map((o) => o.response_deadline)
      .filter((d): d is string => Boolean(d) && new Date(d!).getTime() > now)
      .sort()[0] ?? null;
  const windows = all
    .filter((o) => o.published_at && o.response_deadline)
    .map(
      (o) =>
        (new Date(o.response_deadline!).getTime() -
          new Date(o.published_at!).getTime()) /
        86_400_000,
    )
    .filter((d) => d > 0 && d < 365);
  const avgWindow = windows.length
    ? Math.round(windows.reduce((x, d) => x + d, 0) / windows.length)
    : null;
  return { nextDeadline, avgWindow };
}

/** Page d'un acheteur public : ses appels d'offres ouverts puis ses annonces passées (données réelles). */
export default async function BuyerPage(props: PageProps<"/acheteurs/[slug]">) {
  const { slug } = await props.params;
  const b = await getBuyer(slug);
  if (!b) notFound();
  const [location, sectors, session] = await Promise.all([
    getLocationLabel(),
    getSectorLabels(),
    getSession(),
  ]);
  // Historique complet des annonces passées : réservé à Pro une fois la phase de lancement gratuite terminée
  const db = await createClient();
  const plan = session ? ((await db.rpc("user_plan")).data ?? "FREE") : "FREE";
  const historyLimit = (await db.rpc("plan_feature", { p_plan: plan, p_key: "buyer_history" })).data as number | null;
  const pastShown = historyLimit == null ? b.past.slice(0, 20) : b.past.slice(0, historyLimit);
  const pastLocked = historyLimit != null && b.past.length > historyLimit;
  const path = `/acheteurs/${slug}`;
  const admin = createAdminClient();
  // Aperçu des fiches synthèse déjà préparées (faits tirés de l'avis officiel), acheteurs proches,
  // compteurs en direct : de quoi donner envie d'aller plus loin
  const [briefRows, buyersRows, platform, memberCompanies, departments] = await Promise.all([
    b.open.length ? admin.from("tender_briefs").select("opportunity_id, content").in("opportunity_id", b.open.map((o) => o.id)) : Promise.resolve({ data: [] as { opportunity_id: string; content: unknown }[] }),
    allBuyers().catch(() => []),
    session ? Promise.resolve(null) : getPlatformStats().catch(() => null),
    session ? Promise.resolve([]) : getMemberCompanies(12).catch(() => []),
    getDepartments().catch(() => []),
  ]);
  const briefs = new Map<string, { visit: boolean; lots: number; documents: number; todo: number }>();
  for (const r of briefRows.data ?? []) {
    const p = BriefSchema.safeParse(r.content);
    if (p.success) briefs.set(r.opportunity_id, { visit: Boolean(p.data.site_visit && /obligatoire/i.test(p.data.site_visit)), lots: p.data.lots.length, documents: p.data.documents.length, todo: p.data.todo.length });
  }
  const mainRegion = top(b.all.map((o) => o.region), 1)[0] ?? null;
  const mainDept = top(b.all.map((o) => o.department_code), 1)[0] ?? null;
  const others = buyersRows.filter((x) => x.slug !== slug);
  const nearby = others.filter((x) => x.region === mainRegion && x.open > 0).slice(0, 6);
  // Acheteurs du même type (bailleurs, hôpitaux, communes…) : même région d'abord, puis ceux qui publient le plus
  const family = familyOf(b.name);
  const nearbySlugs = new Set(nearby.map((x) => x.slug));
  const similar = family
    ? others
        .filter((x) => !nearbySlugs.has(x.slug) && x.total >= 2 && family.re.test(x.name))
        .sort((x, y) => Number(y.region === mainRegion) - Number(x.region === mainRegion) || y.open - x.open || y.total - x.total)
        .slice(0, 8)
    : [];
  const live = liveStats(platform);
  const dep = departments.find((d) => d.code === mainDept) ?? null;
  const reg = regionByName(mainRegion);
  // Présentation tirée des annonces enregistrées (aucune donnée inventée) : métiers et lieux les plus fréquents
  const mainSectors = top(
    b.all.map((o) => o.sector_slug),
    3,
  ).filter((k) => sectors[k]);
  const mainPlaces = top(
    b.all.map((o) => location(o.city, o.department_code)),
    2,
  );
  const firstSeen =
    b.all
      .map((o) => o.published_at)
      .filter(Boolean)
      .sort()[0] ?? null;
  const signup = `/inscription?suite=${encodeURIComponent(path)}`;
  const initials =
    b.name
      .replace(/[^\p{L}\p{N} ]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 || /^[A-Z0-9]+$/.test(w))
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "A";

  const { nextDeadline, avgWindow } = buyerInsights(b.all, b.open);
  // Questions fréquentes : réponses calculées uniquement à partir des annonces enregistrées
  const realCounts = buyersRows.find((x) => x.slug === slug);
  const totalCount = Math.max(b.all.length, realCounts?.total ?? 0);
  const openCount = Math.max(b.open.length, realCounts?.open ?? 0);
  const sectorList = mainSectors.map((k) => sectors[k].toLowerCase()).join(", ");
  const faq: { q: string; a: string }[] = [
    {
      q: `Combien d'appels d'offres ${b.name} a-t-il publiés ?`,
      a: `${nf.format(totalCount)} annonce${totalCount > 1 ? "s" : ""} de ${b.name} ${totalCount > 1 ? "sont référencées" : "est référencée"} sur LinkProB2B${firstSeen ? ` depuis le ${formatDate(firstSeen)}` : ""}, dont ${nf.format(openCount)} ${openCount > 1 ? "encore ouvertes" : "encore ouverte"} aujourd'hui.`,
    },
    ...(sectorList
      ? [{ q: `Dans quels domaines ${b.name} achète-t-il ?`, a: `D'après ses annonces, ${b.name} publie surtout des marchés en ${sectorList}${mainPlaces.length ? `, principalement à ${mainPlaces.join(" et ")}` : ""}.` }]
      : []),
    ...(avgWindow
      ? [{ q: `Combien de temps faut-il pour répondre à ${b.name} ?`, a: `En moyenne, ${b.name} laisse ${avgWindow} jours entre la publication de l'annonce et la date limite de réponse.${nextDeadline ? ` La prochaine date limite est le ${formatDate(nextDeadline)}.` : ""}` }]
      : []),
    {
      q: `Comment être prévenu des prochains appels d'offres de ${b.name} ?`,
      a: `Créez un compte gratuit sur LinkProB2B et suivez ${b.name} : vous recevez un e-mail dès qu'une nouvelle annonce est publiée, avec l'objet, le lieu et la date limite.`,
    },
  ];
  const stats = [
    {
      label: "Appels d'offres ouverts",
      value: nf.format(b.open.length),
      icon: FileText,
    },
    {
      label: "Prochaine date limite",
      value: nextDeadline ? formatDate(nextDeadline) : "—",
      icon: CalendarClock,
    },
    {
      label: "Délai moyen pour répondre",
      value: avgWindow ? `${avgWindow} jours` : "—",
      icon: History,
    },
    {
      label: "Métier principal",
      value: mainSectors[0] ? sectors[mainSectors[0]] : "—",
      icon: Tag,
    },
  ];
  // Déjà suivi par le membre connecté (alerte sur le nom exact de l'acheteur)
  const following = session
    ? Boolean(
        (
          await (await createClient())
            .from("alerts")
            .select("id")
            .eq("user_id", session.userId)
            .eq("keywords", buyerAlertKeywords(b.name))
            .eq("is_active", true)
            .maybeSingle()
        ).data,
      )
    : false;

  const Item = ({ o, open }: { o: (typeof b.open)[number]; open: boolean }) => {
    const where = location(o.city, o.department_code);
    const days = daysUntil(o.response_deadline);
    const urgent = open && days !== null && days >= 0 && days <= 7;
    return (
      <li>
        <Link
          href={`/opportunites/${o.id}`}
          className={`group flex overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-px hover:border-teal hover:shadow-md ${open ? "border-slate-200" : "border-slate-200/70 opacity-80"}`}
        >
          <SectorVisual
            sector={o.sector_slug}
            className="hidden w-36 shrink-0 sm:block lg:w-44"
          />
          <div className="min-w-0 flex-1 p-5">
            <div className="flex flex-wrap items-center gap-2">
              {o.sector_slug && sectors[o.sector_slug] && (
                <Badge
                  tone="teal"
                  icon={<Tag className="size-3" aria-hidden />}
                >
                  {sectors[o.sector_slug]}
                </Badge>
              )}
              {open ? (
                o.response_deadline && (
                  <Badge tone={urgent ? "amber" : "sky"}>
                    {deadlineLabel(o.response_deadline)}
                  </Badge>
                )
              ) : (
                <Badge tone="slate">Clôturé</Badge>
              )}
            </div>
            <h3 className="mt-3 leading-snug font-semibold text-navy [overflow-wrap:anywhere] group-hover:underline">
              {o.title}
            </h3>
            <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
              {where && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4 text-slate-400" aria-hidden />{" "}
                  {where}
                </span>
              )}
              {o.response_deadline && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock
                    className="size-4 text-slate-400"
                    aria-hidden
                  />{" "}
                  Date limite : {formatDate(o.response_deadline)}
                </span>
              )}
              {o.published_at && (
                <span className="text-slate-500">
                  Publié le {formatDate(o.published_at)}
                </span>
              )}
            </p>
            {open && briefs.has(o.id) && (
              <span className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-teal to-violet px-2.5 py-1 text-white">
                  <Sparkles className="size-3.5" aria-hidden /> Fiche synthèse
                </span>
                {briefs.get(o.id)!.visit && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-800 ring-1 ring-rose-200">Visite obligatoire</span>}
                {briefs.get(o.id)!.lots > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                    <Layers className="size-3.5" aria-hidden /> {briefs.get(o.id)!.lots} lot{briefs.get(o.id)!.lots > 1 ? "s" : ""}
                  </span>
                )}
                {briefs.get(o.id)!.documents > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                    <ClipboardCheck className="size-3.5" aria-hidden /> {briefs.get(o.id)!.documents} pièce{briefs.get(o.id)!.documents > 1 ? "s" : ""} à fournir
                  </span>
                )}
              </span>
            )}
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-teal-700">
              {open && briefs.has(o.id) ? "Voir la fiche en 30 secondes" : "Voir l\u2019offre"}{" "}
              <ArrowRight
                className="size-4 transition group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
          </div>
        </Link>
      </li>
    );
  };

  const followBox = session ? (
    <div className="rounded-2xl border border-slate-200 border-t-4 border-t-teal bg-white p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-bold text-navy">
        <BellRing className="size-5 text-teal-700" aria-hidden /> Ne manquez pas
        ses prochains marchés
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Recevez par e-mail chaque nouvel appel d&apos;offres de {b.name}, dès sa
        publication.
      </p>
      <div className="mt-4">
        <FollowBuyerButton slug={slug} following={following} />
      </div>
      <Link
        href="/dashboard/alertes"
        className="mt-3 inline-block text-sm font-semibold text-teal-700 underline"
      >
        Gérer mes alertes
      </Link>
    </div>
  ) : (
    <section
      aria-labelledby="suivre"
      className="rounded-2xl border border-slate-200 border-t-4 border-t-teal bg-white p-6 shadow-md"
    >
      <h2
        id="suivre"
        className="flex items-center gap-2 text-lg font-bold text-navy"
      >
        <BellRing className="size-5 text-teal-700" aria-hidden /> Suivez cet
        acheteur
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Recevez ses prochains appels d&apos;offres par e-mail, gratuitement.
      </p>
      <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
        {[
          "Chacun de ses nouveaux appels d'offres par e-mail, dès sa publication",
          "Le lien officiel, le dossier de consultation et sa fiche officielle",
          mainSectors.length
            ? `Les offres « ${sectors[mainSectors[0]]} » partout en France`
            : "Les offres de votre métier partout en France",
        ].map((t) => (
          <li key={t} className="flex gap-2">
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-teal-700"
              aria-hidden
            />{" "}
            {t}
          </li>
        ))}
      </ul>
      <Link
        href={signup}
        className={buttonClasses({
          size: "lg",
          full: true,
          className: "mt-5 whitespace-normal text-center",
        })}
      >
        Suivre cet acheteur gratuitement
      </Link>
      <GoogleButton next={path} />
      <p className="mt-3 text-xs text-slate-500">
        Sans carte bancaire. Alerte modifiable ou arrêtable en un clic.
      </p>
    </section>
  );

  return (
    <div className="bg-slate-50/60">
      {b.open.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `Appels d'offres ouverts : ${b.name}`,
            numberOfItems: b.open.length,
            itemListElement: b.open.slice(0, 30).map((o, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `${siteUrl()}/opportunites/${o.id}`,
              name: o.title,
            })),
          }}
        />
      )}
      <JsonLd
        data={breadcrumbLd([
          { name: "Acheteurs publics", path: "/acheteurs" },
          { name: b.name, path },
        ])}
      />
      {/* En-tête */}
      <section className="relative isolate overflow-hidden border-b border-slate-200 bg-gradient-to-b from-sky via-white to-white">
        <div
          aria-hidden
          className="bg-tech-grid-light pointer-events-none absolute inset-0 -z-10"
        />
        <div className="container-page py-8 sm:py-12">
          <nav
            aria-label="Fil d'Ariane"
            className="mb-5 text-sm text-slate-500"
          >
            <Link href="/acheteurs" className="hover:underline">
              Acheteurs publics
            </Link>{" "}
            / <span className="text-navy">{b.name}</span>
          </nav>
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <span
                aria-hidden
                className="inline-flex size-16 shrink-0 items-center justify-center rounded-2xl bg-navy text-xl font-bold text-white shadow-md"
              >
                {initials}
              </span>
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700">
                  <Landmark className="size-4" aria-hidden /> Acheteur public
                </p>
                <h1 className="mt-1 text-2xl leading-tight font-bold text-navy [overflow-wrap:anywhere] sm:text-4xl">
                  Appels d&apos;offres : {b.name}
                </h1>
                <p className="mt-3 max-w-3xl text-slate-600">
                  {b.open.length
                    ? `${nf.format(b.open.length)} appel${b.open.length > 1 ? "s" : ""} d'offres ouvert${b.open.length > 1 ? "s" : ""} actuellement`
                    : "Aucun appel d'offres ouvert actuellement"}
                  , d&apos;après les annonces officielles (BOAMP, TED). {b.name}{" "}
                  a publié {nf.format(b.all.length)} annonce
                  {b.all.length > 1 ? "s" : ""} recensée
                  {b.all.length > 1 ? "s" : ""} sur LinkProB2B
                  {firstSeen ? ` depuis le ${formatDate(firstSeen)}` : ""}
                  {mainSectors.length
                    ? `, principalement en ${mainSectors.map((k) => sectors[k].toLowerCase()).join(", ")}`
                    : ""}
                  {mainPlaces.length ? ` (${mainPlaces.join(", ")})` : ""}.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {session ? (
                    <FollowBuyerButton slug={slug} following={following} />
                  ) : (
                    <div className="w-full max-w-xl animate-rise">
                      <AlertLeadForm
                        compact
                        buyer={slug}
                        label={`de ${b.name}`}
                        title="Suivre cet acheteur, juste avec votre e-mail"
                        sector={null}
                        department={null}
                        region={null}
                        path={path}
                      />
                      <p className="mt-2 text-sm text-slate-600">
                        Ou{" "}
                        <Link href={signup} className="font-semibold text-teal-700 hover:underline">
                          créez votre compte gratuit
                        </Link>{" "}
                        pour recevoir chaque marché dès sa publication ·{" "}
                        <Link href={`/connexion?suite=${encodeURIComponent(path)}`} className="font-semibold text-teal-700 hover:underline">
                          Se connecter
                        </Link>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Photo du métier principal de l'acheteur */}
            <div className="relative hidden lg:block">
              <SectorVisual
                sector={mainSectors[0] ?? null}
                priority
                className="aspect-[4/3] rounded-3xl shadow-xl ring-1 ring-slate-200"
              />
              <div className="absolute -bottom-4 -left-4 rounded-2xl bg-white px-4 py-3 shadow-lg ring-1 ring-slate-200">
                <p className="text-xs font-semibold text-slate-500">
                  Offres ouvertes
                </p>
                <p className="text-2xl font-bold text-navy">
                  {nf.format(b.open.length)}
                </p>
              </div>
            </div>
          </div>
          {/* Téléphone : bandeau photo */}
          <SectorVisual
            sector={mainSectors[0] ?? null}
            className="mt-6 h-36 rounded-2xl lg:hidden"
          />
          <dl className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm"
              >
                <dt className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <Icon className="size-3.5 text-teal-700" aria-hidden />{" "}
                  {label}
                </dt>
                <dd
                  className="mt-1.5 truncate text-lg font-bold text-navy"
                  title={value}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <section aria-labelledby="ouverts">
            <h2 id="ouverts" className="text-xl font-bold text-navy">
              Appels d&apos;offres ouverts{" "}
              <span className="text-slate-400">
                ({nf.format(b.open.length)})
              </span>
            </h2>
            {b.open.length ? (
              <ul className="mt-4 space-y-3">
                {b.open.map((o) => (
                  <Item key={o.id} o={o} open />
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">
                Aucun appel d&apos;offres ouvert pour le moment. Suivez cet
                acheteur pour être prévenu des prochains.
              </p>
            )}
          </section>
          {b.past.length > 0 && (
            <section aria-labelledby="passees" className="mt-12">
              <h2 id="passees" className="text-xl font-bold text-navy">
                Annonces passées{" "}
                <span className="text-slate-400">
                  ({nf.format(b.past.length)})
                </span>
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Utile pour connaître ses habitudes d&apos;achat et anticiper les
                renouvellements.
              </p>
              <ul className="mt-4 space-y-3">
                {pastShown.map((o) => (
                  <Item key={o.id} o={o} open={false} />
                ))}
              </ul>
              {pastLocked && (
                <div className="mt-6">
                  <UpgradeGate
                    session={session}
                    testId="buyer-history-limit"
                    title={`${nf.format(b.past.length - pastShown.length)} autres annonces de cet acheteur`}
                    reason="L'historique complet de l'acheteur est réservé à Pro : anticipez ses prochains contrats."
                    suite={path}
                  />
                </div>
              )}
            </section>
          )}
          {(nearby.length > 0 || (dep && reg)) && (
            <section aria-labelledby="proches" className="mt-12">
              <h2 id="proches" className="text-xl font-bold text-navy">
                Dans la même région
              </h2>
              {dep && reg && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {mainSectors[0] && (
                    <Link
                      href={`/opportunites/${reg.slug}/${dep.slug}/${mainSectors[0]}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-navy/90"
                    >
                      {sectors[mainSectors[0]]} · {dep.name} <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  )}
                  <Link
                    href={`/opportunites/${reg.slug}/${dep.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-navy ring-1 ring-slate-200 transition hover:-translate-y-px hover:ring-teal"
                  >
                    Tous les marchés · {dep.name} <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
              )}
              {nearby.length > 0 && (
                <>
                  <p className="mt-6 text-sm font-semibold text-slate-500">Acheteurs proches qui publient en ce moment</p>
                  <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                    {nearby.map((x) => (
                      <li key={x.slug}>
                        <Link
                          href={`/acheteurs/${x.slug}`}
                          className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-px hover:border-teal hover:shadow-md"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-navy group-hover:underline">{x.name}</span>
                            <span className="text-sm text-slate-500">
                              {nf.format(x.open)} appel{x.open > 1 ? "s" : ""} d&apos;offres ouvert{x.open > 1 ? "s" : ""}
                            </span>
                          </span>
                          <ArrowRight className="size-4 shrink-0 text-teal-700 transition group-hover:translate-x-0.5" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
          {similar.length > 0 && family && (
            <section aria-labelledby="similaires" className="mt-12">
              <h2 id="similaires" className="text-xl font-bold text-navy">
                {family.label} : autres acheteurs
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {similar.map((x) => (
                  <li key={x.slug}>
                    <Link
                      href={`/acheteurs/${x.slug}`}
                      className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-px hover:border-teal hover:shadow-md"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-navy group-hover:underline">{x.name}</span>
                        <span className="text-sm text-slate-500">
                          {x.open > 0 ? `${nf.format(x.open)} ouvert${x.open > 1 ? "s" : ""} · ` : ""}
                          {nf.format(x.total)} annonce{x.total > 1 ? "s" : ""}
                          {x.region ? ` · ${x.region}` : ""}
                        </span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-teal-700 transition group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="faq-acheteur" className="mt-12">
            <JsonLd
              data={{
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
              }}
            />
            <h2 id="faq-acheteur" className="text-xl font-bold text-navy">
              Questions fréquentes sur {b.name}
            </h2>
            <div className="mt-4 space-y-3">
              {faq.map((f) => (
                <details key={f.q} className="faq-item group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm open:shadow-md">
                  <summary className="cursor-pointer list-none font-semibold text-navy marker:hidden">{f.q}</summary>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <BuyerOfficial
            name={b.name}
            signedIn={Boolean(session)}
            signupHref={signup}
          />
          {followBox}
          {live && <MemberProofCompact initial={live} companies={memberCompanies} />}
          {mainSectors[0] && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-navy">
                Plus d&apos;offres dans ce métier
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {mainSectors.map((k) => (
                  <li key={k}>
                    <Link
                      href={`/opportunites/${k}`}
                      className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline"
                    >
                      {sectors[k]}{" "}
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
