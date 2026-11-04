import Link from "next/link";
import { notFound } from "next/navigation";
import { BellRing, CalendarClock, CheckCircle2, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { pageMetadata } from "@/lib/seo";
import { formatDate } from "@/lib/format";
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
  const followBox = session ? null : (
    <section
      aria-labelledby="suivre"
      className="mt-8 rounded-2xl border border-teal/30 bg-sky/50 p-6"
    >
      <h2
        id="suivre"
        className="flex items-center gap-2 text-lg font-bold text-navy"
      >
        <BellRing className="size-5 text-teal-700" aria-hidden /> Suivez{" "}
        {b.name}
      </h2>
      <ul className="mt-3 space-y-2 text-sm text-slate-700">
        {[
          "Ses prochains appels d'offres par e-mail, dès leur publication",
          "Le lien officiel et le dossier de consultation de chaque offre",
          mainSectors.length
            ? `Les nouvelles offres « ${sectors[mainSectors[0]]} » de votre secteur, partout en France`
            : "Les nouvelles offres de votre métier, partout en France",
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
      <div className="mt-5 max-w-sm">
        <Link
          href={signup}
          className={buttonClasses({
            size: "lg",
            full: true,
            className: "whitespace-normal text-center",
          })}
        >
          Créer mon compte gratuitement
        </Link>
        <GoogleButton next={path} />
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Gratuit, sans carte bancaire. Alerte modifiable ou arrêtable en un clic.
      </p>
    </section>
  );
  const Item = ({ o }: { o: (typeof b.open)[number] }) => {
    const where = location(o.city, o.department_code);
    return (
      <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <Link
          href={`/opportunites/${o.id}`}
          className="font-semibold text-navy hover:underline"
        >
          {o.title}
        </Link>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          {where && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" aria-hidden /> {where}
            </span>
          )}
          {o.response_deadline && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-4" aria-hidden /> Date limite :{" "}
              {formatDate(o.response_deadline)}
            </span>
          )}
          {o.sector_slug && sectors[o.sector_slug] && (
            <span>{sectors[o.sector_slug]}</span>
          )}
        </p>
      </li>
    );
  };
  return (
    <div className="container-page py-10 sm:py-14">
      <JsonLd
        data={breadcrumbLd([
          { name: "Acheteurs publics", path: "/acheteurs" },
          { name: b.name, path },
        ])}
      />
      <nav aria-label="Fil d'Ariane" className="mb-3 text-sm text-slate-500">
        <Link href="/acheteurs" className="hover:underline">
          Acheteurs publics
        </Link>{" "}
        / <span className="text-navy">{b.name}</span>
      </nav>
      <h1 className="text-3xl font-bold sm:text-4xl">
        Appels d&apos;offres : {b.name}
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-slate-600">
        {b.open.length
          ? `${nf.format(b.open.length)} appel${b.open.length > 1 ? "s" : ""} d'offres ouvert${b.open.length > 1 ? "s" : ""} actuellement`
          : "Aucun appel d'offres ouvert actuellement"}
        , d&apos;après les annonces officielles publiées par cet acheteur
        (BOAMP, TED).
      </p>
      <p className="mt-3 max-w-3xl text-slate-600">
        {b.name} a publié {nf.format(b.all.length)} annonce
        {b.all.length > 1 ? "s" : ""} recensée{b.all.length > 1 ? "s" : ""} sur
        LinkProB2B
        {firstSeen ? ` depuis le ${formatDate(firstSeen)}` : ""}
        {mainSectors.length
          ? `, principalement en ${mainSectors.map((k) => sectors[k].toLowerCase()).join(", ")}`
          : ""}
        {mainPlaces.length ? ` (${mainPlaces.join(", ")})` : ""}.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={session ? "/dashboard/alertes" : signup}
          className={buttonClasses({
            className: "whitespace-normal text-center",
          })}
        >
          Être alerté de ses prochains appels d&apos;offres
        </Link>
        {mainSectors[0] ? (
          <Link
            href={`/opportunites/${mainSectors[0]}`}
            className={buttonClasses({
              variant: "outline",
              className: "whitespace-normal text-center",
            })}
          >
            Toutes les offres {sectors[mainSectors[0]].toLowerCase()}
          </Link>
        ) : null}
      </div>
      <section className="mt-10">
        <h2 className="text-xl font-bold">Appels d&apos;offres ouverts</h2>
        {b.open.length ? (
          <ul className="mt-4 space-y-3">
            {b.open.map((o) => (
              <Item key={o.id} o={o} />
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-slate-600">
            Aucun appel d&apos;offres ouvert pour le moment. Créez une alerte
            pour être prévenu des prochains.
          </p>
        )}
      </section>
      {followBox}
      {b.past.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold">Annonces passées</h2>
          <ul className="mt-4 space-y-3">
            {b.past.slice(0, 20).map((o) => (
              <Item key={o.id} o={o} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
