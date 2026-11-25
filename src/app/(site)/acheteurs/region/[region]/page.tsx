import Link from "next/link";
import { notFound } from "next/navigation";
import { Landmark } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { JsonLd, breadcrumbLd } from "@/components/json-ld";
import { pageMetadata } from "@/lib/seo";
import { REGIONS } from "@/lib/geo";
import { allBuyers, buyerRegionSlug, NATIONAL_BUYERS, type BuyerSummary } from "@/lib/queries/buyers";

const nf = new Intl.NumberFormat("fr-FR");

/** Région demandée (ou « national » : acheteurs sans région) et ses acheteurs, les plus actifs d'abord. */
async function regionBuyers(slug: string): Promise<{ name: string; buyers: BuyerSummary[] } | null> {
  const name = slug === NATIONAL_BUYERS.slug ? NATIONAL_BUYERS.name : REGIONS.find((r) => r.slug === slug)?.name;
  if (!name) return null;
  const buyers = (await allBuyers().catch(() => []))
    .filter((b) => buyerRegionSlug(b.region) === slug)
    .sort((a, b) => b.open - a.open || b.total - a.total || a.name.localeCompare(b.name, "fr"));
  return { name, buyers };
}

const inRegion = (name: string) => (name === NATIONAL_BUYERS.name ? "sans région précise (France entière)" : `en ${name}`);

export async function generateMetadata(props: PageProps<"/acheteurs/region/[region]">) {
  const { region } = await props.params;
  const r = await regionBuyers(region);
  if (!r) return { title: "Page introuvable", robots: { index: false } };
  const open = r.buyers.filter((b) => b.open > 0).length;
  const year = new Date().getFullYear();
  return pageMetadata({
    title: `Acheteurs publics ${r.name === NATIONAL_BUYERS.name ? "nationaux" : r.name} ${year} : appels d'offres en cours`,
    description: `${nf.format(r.buyers.length)} acheteurs publics ${inRegion(r.name)} (communes, intercommunalités, hôpitaux, bailleurs sociaux…), dont ${nf.format(open)} avec des appels d'offres ouverts aujourd'hui. Annonces officielles BOAMP et TED, mises à jour chaque jour.`,
    path: `/acheteurs/region/${region}`,
    noindex: r.buyers.length < 3,
  });
}

/** Acheteurs publics d'une région : chaque page acheteur est atteignable en deux clics depuis l'annuaire. */
export default async function BuyersByRegionPage(props: PageProps<"/acheteurs/region/[region]">) {
  const { region } = await props.params;
  const r = await regionBuyers(region);
  if (!r) notFound();
  const open = r.buyers.filter((b) => b.open > 0);
  const past = r.buyers.filter((b) => b.open === 0);
  const openTotal = open.reduce((n, b) => n + b.open, 0);
  const path = `/acheteurs/region/${region}`;
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Acheteurs publics", path: "/acheteurs" }, { name: r.name, path }])} />
      <PageHero
        eyebrow="Acheteurs publics"
        image="/images/illustrations/gratte-ciel.webp"
        title={`Acheteurs publics ${inRegion(r.name)}`}
        intro={
          <>
            {nf.format(r.buyers.length)} acheteurs publics {inRegion(r.name)} ont publié des appels d&apos;offres au BOAMP ou au journal européen TED.
            {open.length > 0 && (
              <>
                {" "}
                Aujourd&apos;hui, {nf.format(open.length)} d&apos;entre eux ont {nf.format(openTotal)} appel{openTotal > 1 ? "s" : ""} d&apos;offres ouvert{openTotal > 1 ? "s" : ""}.
              </>
            )}{" "}
            Ouvrez la page d&apos;un acheteur pour voir ses marchés en cours, ses dates limites et ses anciens appels d&apos;offres.
          </>
        }
      />
      <div className="container-page py-10 sm:py-14">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-slate-500">
          <Link href="/acheteurs" className="hover:underline">
            Acheteurs publics
          </Link>{" "}
          / <span className="text-navy">{r.name}</span>
        </nav>
        {open.length > 0 && (
          <section aria-labelledby="ouverts">
            <h2 id="ouverts" className="text-xl font-bold text-navy">
              Avec des appels d&apos;offres en cours ({nf.format(open.length)})
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {open.map((b) => (
                <li key={b.slug}>
                  <Link href={`/acheteurs/${b.slug}`} className="flex h-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal">
                    <Landmark className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden />
                    <span className="min-w-0">
                      <span className="block font-semibold text-navy [overflow-wrap:anywhere]">{b.name}</span>
                      <span className="text-sm text-slate-600">
                        {nf.format(b.open)} appel{b.open > 1 ? "s" : ""} d&apos;offres en cours
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {past.length > 0 && (
          <section aria-labelledby="historique" className="mt-10">
            <h2 id="historique" className="text-xl font-bold text-navy">
              Leurs anciens appels d&apos;offres ({nf.format(past.length)})
            </h2>
            <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {past.map((b) => (
                <li key={b.slug}>
                  <Link href={`/acheteurs/${b.slug}`} className="text-teal-800 hover:underline [overflow-wrap:anywhere]">
                    Appels d&apos;offres {b.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="mt-10 text-sm text-slate-600">
          Autres régions :{" "}
          {[...REGIONS.map((x) => ({ slug: x.slug, name: x.name })), NATIONAL_BUYERS]
            .filter((x) => x.slug !== region)
            .map((x, i, list) => (
              <span key={x.slug}>
                <Link href={`/acheteurs/region/${x.slug}`} className="font-semibold text-teal-800 hover:underline">
                  {x.name}
                </Link>
                {i < list.length - 1 ? " · " : ""}
              </span>
            ))}
        </p>
      </div>
    </>
  );
}
