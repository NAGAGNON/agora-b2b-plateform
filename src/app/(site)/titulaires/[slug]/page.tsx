import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, Landmark, MapPin, Trophy } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { JsonLd, breadcrumbLd } from "@/components/json-ld";
import { AwardList } from "@/components/awards/award-list";
import { AlertLeadForm } from "@/components/alert-lead-form";
import { buttonClasses } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";
import { sectorLabel } from "@/lib/constants";
import { getSectorLabels } from "@/lib/queries/platform";
import { REGIONS } from "@/lib/geo";
import { getOptouts, getWinnerAwards, WINNER_MIN_AWARDS } from "@/lib/queries/awards";
import { fitTitle } from "@/lib/awards-pages";

const nf = new Intl.NumberFormat("fr-FR");

/** Les valeurs les plus fréquentes (acheteurs, métiers, départements de l'entreprise). */
function top<T extends string>(values: (T | null)[], n: number): { value: T; count: number }[] {
  const m = new Map<T, number>();
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([value, count]) => ({ value, count }));
}

async function load(slug: string) {
  if ((await getOptouts()).includes(slug)) return null;
  const awards = await getWinnerAwards(slug);
  if (!awards.length) return null;
  const i = awards[0].winner_keys.indexOf(slug);
  return { name: awards[0].winners[Math.max(0, i)] ?? slug, awards };
}

export async function generateMetadata(props: PageProps<"/titulaires/[slug]">) {
  const { slug } = await props.params;
  const w = await load(slug);
  if (!w) return { title: "Entreprise introuvable", robots: { index: false } };
  const n = w.awards.length;
  const year = new Date().getFullYear();
  const buyers = top(w.awards.map((a) => a.buyer_name), 2).map((b) => b.value);
  return pageMetadata({
    title: fitTitle(
      `Marchés publics ${w.name} ${year} : ${nf.format(n)} contrat${n > 1 ? "s" : ""} remporté${n > 1 ? "s" : ""}`,
      `Marchés publics ${w.name} : ${nf.format(n)} contrat${n > 1 ? "s" : ""} remporté${n > 1 ? "s" : ""}`,
      `${w.name} : ${nf.format(n)} marché${n > 1 ? "s" : ""} public${n > 1 ? "s" : ""} remporté${n > 1 ? "s" : ""}`,
      `Marchés publics ${w.name}`,
    ),
    description: `${w.name} a remporté ${nf.format(n)} marché${n > 1 ? "s" : ""} public${n > 1 ? "s" : ""} publié${n > 1 ? "s" : ""} au BOAMP${buyers.length ? `, notamment auprès de ${buyers.join(" et ")}` : ""} : objet, acheteur, date et avis officiel de chaque contrat.`,
    path: `/titulaires/${slug}`,
    noindex: n < WINNER_MIN_AWARDS,
  });
}

/** Marchés publics remportés par une entreprise (avis d'attribution BOAMP, données publiques). */
export default async function WinnerPage(props: PageProps<"/titulaires/[slug]">) {
  const { slug } = await props.params;
  const w = await load(slug);
  if (!w) notFound();
  const [labels, session] = await Promise.all([getSectorLabels(), getSession()]);
  const n = w.awards.length;
  const buyers = top(w.awards.map((a) => a.buyer_name), 6);
  const buyerKeys = new Map(w.awards.map((a) => [a.buyer_name, a.buyer_key]));
  const sectors = top(w.awards.map((a) => a.sector_slug), 3);
  const regions = top(w.awards.map((a) => a.region), 3);
  const deps = top(w.awards.map((a) => a.department_code), 1);
  const mainSector = sectors[0]?.value ?? null;
  const mainRegion = regions[0]?.value ?? null;
  const years = top(w.awards.map((a) => a.published_on.slice(0, 4)), 5).sort((a, b) => b.value.localeCompare(a.value));
  const path = `/titulaires/${slug}`;
  const regionSlug = mainRegion ? REGIONS.find((r) => r.name === mainRegion)?.slug : null;
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Résultats des marchés publics", path: "/resultats" }, { name: w.name, path }])} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Organization", name: w.name, url: `${path}` }} />
      <PageHero
        eyebrow="Marchés publics remportés"
        image="/images/illustrations/gratte-ciel.webp"
        title={`Marchés publics remportés par ${w.name}`}
        intro={
          <>
            {w.name} a remporté <strong>{nf.format(n)} marché{n > 1 ? "s" : ""} public{n > 1 ? "s" : ""}</strong> publié{n > 1 ? "s" : ""} au BOAMP
            {buyers[0] ? <>, auprès de {nf.format(new Set(w.awards.map((a) => a.buyer_name)).size)} acheteur{buyers.length > 1 ? "s" : ""}</> : null}
            {mainSector ? <>, surtout en {sectorLabel(mainSector, labels).toLowerCase()}</> : null}
            {mainRegion ? <> et en {mainRegion}</> : null}. Voici chaque contrat, avec l&apos;acheteur, la date et l&apos;avis officiel.
          </>
        }
      />
      <div className="container-page py-10 sm:py-14">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-slate-500">
          <Link href="/resultats" className="hover:underline">
            Résultats des marchés publics
          </Link>{" "}
          / <span className="text-navy">{w.name}</span>
        </nav>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-8">
            <section aria-labelledby="chiffres" className="grid gap-3 sm:grid-cols-3">
              <h2 id="chiffres" className="sr-only">
                En chiffres
              </h2>
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <Trophy className="size-5 text-teal-700" aria-hidden />
                <p className="mt-2 text-2xl font-extrabold text-navy">{nf.format(n)}</p>
                <p className="text-sm text-slate-600">marché{n > 1 ? "s" : ""} remporté{n > 1 ? "s" : ""}</p>
              </div>
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <Landmark className="size-5 text-teal-700" aria-hidden />
                <p className="mt-2 text-2xl font-extrabold text-navy">{nf.format(new Set(w.awards.map((a) => a.buyer_name)).size)}</p>
                <p className="text-sm text-slate-600">acheteur{buyers.length > 1 ? "s" : ""} public{buyers.length > 1 ? "s" : ""}</p>
              </div>
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <MapPin className="size-5 text-teal-700" aria-hidden />
                <p className="mt-2 text-2xl font-extrabold text-navy">{deps[0]?.value ?? "—"}</p>
                <p className="text-sm text-slate-600">département le plus fréquent</p>
              </div>
            </section>
            {years.length > 1 && (
              <p className="text-sm text-slate-600">
                Par année : {years.map((y) => `${y.value} : ${nf.format(y.count)}`).join(" · ")}
              </p>
            )}
            <section aria-labelledby="contrats">
              <h2 id="contrats" className="mb-4 text-xl font-bold text-navy">
                Les marchés remportés par {w.name}
              </h2>
              <AwardList awards={w.awards} />
            </section>
            <p className="text-xs text-slate-500">
              Source : avis d&apos;attribution publiés au BOAMP (données publiques). Vous représentez cette entreprise et souhaitez retirer cette page ?{" "}
              <Link href={`/contact?objet=retrait&page=${encodeURIComponent(path)}`} className="underline">
                Demander le retrait
              </Link>
              .
            </p>
          </div>
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl bg-navy p-5 text-white shadow-lg">
              <Award className="size-6 text-teal" aria-hidden />
              <p className="mt-2 text-lg font-bold">Vous êtes {w.name} ?</p>
              <p className="mt-1 text-sm text-slate-200">
                Recevez chaque matin les nouveaux appels d&apos;offres de votre métier et de votre zone, avec une fiche claire pour répondre. Gratuit.
              </p>
              {!session && (
                <Link href={`/inscription?suite=${encodeURIComponent(path)}`} className={`${buttonClasses({ size: "md" })} mt-4 w-full`}>
                  Créer mon compte gratuit
                </Link>
              )}
            </div>
            <AlertLeadForm
              label={mainSector ? sectorLabel(mainSector, labels).toLowerCase() : "votre métier"}
              sector={mainSector}
              department={deps[0]?.value ?? null}
              region={mainRegion}
              path={path}
              title="Recevoir les appels d'offres similaires"
              compact
            />
            {buyers.length > 0 && (
              <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                <h2 className="text-base font-bold text-navy">Ses principaux acheteurs</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {buyers.map((b) => (
                    <li key={b.value} className="flex justify-between gap-3">
                      {buyerKeys.get(b.value) ? (
                        <Link href={`/acheteurs/${buyerKeys.get(b.value)}`} className="text-teal-800 hover:underline [overflow-wrap:anywhere]">
                          Appels d&apos;offres {b.value}
                        </Link>
                      ) : (
                        <span>{b.value}</span>
                      )}
                      <span className="shrink-0 text-slate-500">{nf.format(b.count)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {mainSector && (
              <div className="rounded-2xl bg-white p-5 text-sm ring-1 ring-slate-200">
                <h2 className="text-base font-bold text-navy">Ses concurrents</h2>
                <ul className="mt-3 space-y-2">
                  <li>
                    <Link href={`/resultats/${mainSector}`} className="text-teal-800 hover:underline">
                      Qui gagne les marchés de {sectorLabel(mainSector, labels).toLowerCase()} en France
                    </Link>
                  </li>
                  {regionSlug && (
                    <li>
                      <Link href={`/resultats/${mainSector}/${regionSlug}`} className="text-teal-800 hover:underline">
                        … en {mainRegion}
                      </Link>
                    </li>
                  )}
                  <li>
                    <Link href={`/opportunites/${mainSector}`} className="text-teal-800 hover:underline">
                      Appels d&apos;offres {sectorLabel(mainSector, labels).toLowerCase()} ouverts
                    </Link>
                  </li>
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
