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
import { pageMetadata } from "@/lib/seo";
import { daysUntil, deadlineLabel, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { SectorVisual } from "@/components/opportunities/sector-visual";
import { JsonLd, breadcrumbLd } from "@/components/json-ld";
import { buttonClasses } from "@/components/ui/button";
import { getLocationLabel, getSectorLabels } from "@/lib/queries/platform";
import { cache } from "react";
import { getSession } from "@/lib/auth";
import { GoogleButton } from "@/components/auth/google-button";
import { clip } from "@/lib/format";

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
  const n = b.open.length;
  return pageMetadata({
    title: n
      ? clip(
          `Appels d'offres ${b.name} : ${nf.format(n)} ouvert${n > 1 ? "s" : ""}`,
          62,
        )
      : clip(`Appels d'offres ${b.name}`, 62),
    description: `${n ? `${nf.format(n)} appel${n > 1 ? "s" : ""} d'offres ouvert${n > 1 ? "s" : ""}` : "Aucun appel d'offres ouvert actuellement"} de ${b.name} : objet, lieu et date limite de réponse, d'après les annonces officielles (BOAMP, TED).`,
    path: `/acheteurs/${slug}`,
    // Indexée seulement avec au moins un appel d'offres ouvert (pas de page vide)
    noindex: n === 0,
  });
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
  const path = `/acheteurs/${slug}`;
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

  const stats = [
    {
      label: "Appels d'offres ouverts",
      value: nf.format(b.open.length),
      icon: FileText,
    },
    {
      label: "Annonces recensées",
      value: nf.format(b.all.length),
      icon: History,
    },
    {
      label: "Métier principal",
      value: mainSectors[0] ? sectors[mainSectors[0]] : "—",
      icon: Tag,
    },
    { label: "Zone", value: mainPlaces[0] ?? "—", icon: MapPin },
  ];

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
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-teal-700">
              Voir l&apos;offre{" "}
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-bold text-navy">
        <BellRing className="size-5 text-teal-700" aria-hidden /> Ne manquez pas
        ses prochains marchés
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Créez une alerte sur son métier et sa zone : vous recevez les nouvelles
        offres dès leur publication.
      </p>
      <Link
        href="/dashboard/alertes"
        className={buttonClasses({ full: true, className: "mt-4" })}
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
        <BellRing className="size-5 text-teal" aria-hidden /> Suivez cet
        acheteur
      </h2>
      <p className="mt-2 text-sm text-slate-300">
        Recevez ses prochains appels d&apos;offres par e-mail, gratuitement.
      </p>
      <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
        {[
          "Ses nouveaux appels d'offres dès leur publication",
          "Le lien officiel et le dossier de consultation",
          mainSectors.length
            ? `Les offres « ${sectors[mainSectors[0]]} » partout en France`
            : "Les offres de votre métier partout en France",
        ].map((t) => (
          <li key={t} className="flex gap-2">
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-teal"
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
        Créer mon compte gratuitement
      </Link>
      <GoogleButton next={path} />
      <p className="mt-3 text-xs text-slate-400">
        Sans carte bancaire. Alerte modifiable ou arrêtable en un clic.
      </p>
    </section>
  );

  return (
    <div className="bg-slate-50/60">
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
                {b.past.slice(0, 20).map((o) => (
                  <Item key={o.id} o={o} open={false} />
                ))}
              </ul>
            </section>
          )}
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {followBox}
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
