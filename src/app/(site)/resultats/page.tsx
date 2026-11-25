import Link from "next/link";
import { RankingPage } from "@/components/awards/ranking-page";
import { pageMetadata } from "@/lib/seo";
import { REGIONS } from "@/lib/geo";
import { getSectors } from "@/lib/queries/platform";
import { getAwardCounts, getLatestAwards, getTopWinners, RANKING_MIN_AWARDS } from "@/lib/queries/awards";
import { ALL_TRADES } from "@/lib/awards-pages";

const nf = new Intl.NumberFormat("fr-FR");

export async function generateMetadata() {
  const year = new Date().getFullYear();
  const total = (await getAwardCounts().catch(() => [])).reduce((s, c) => s + c.n, 0);
  return pageMetadata({
    title: `Résultats des marchés publics ${year} : qui gagne quoi ?`,
    description: `${total ? `${nf.format(total)} marchés attribués` : "Les marchés attribués"} en France, d'après les avis officiels du BOAMP : les entreprises qui gagnent le plus, par métier et par région, et le détail de chaque contrat.`,
    path: "/resultats",
    noindex: total < RANKING_MIN_AWARDS,
  });
}

/** Résultats des marchés publics : classement national, derniers marchés, accès par métier et par région. */
export default async function ResultsHubPage() {
  const [winners, latest, counts, sectors] = await Promise.all([getTopWinners(null, null, 20), getLatestAwards({}, 15), getAwardCounts().catch(() => []), getSectors()]);
  const total = counts.reduce((s, c) => s + c.n, 0);
  const bySector = new Map<string, number>();
  const byRegion = new Map<string, number>();
  for (const c of counts) {
    if (c.sector) bySector.set(c.sector, (bySector.get(c.sector) ?? 0) + c.n);
    if (c.region) byRegion.set(c.region, (byRegion.get(c.region) ?? 0) + c.n);
  }
  return (
    <>
      <RankingPage
        heading="Résultats des marchés publics : qui gagne quoi ?"
        intro={`${total ? nf.format(total) : "Les"} marchés publics attribués, d'après les avis officiels du BOAMP : les entreprises qui en gagnent le plus, et le détail de chaque contrat. Choisissez un métier ou une région.`}
        crumbs={[{ name: "Résultats des marchés publics", path: "/resultats" }]}
        winners={winners}
        latest={latest}
        sector={null}
        sectorSlug={null}
        regionName={null}
        links={[]}
      />
      <div className="container-page grid gap-8 pb-14 sm:grid-cols-2">
        <nav aria-label="Classements par métier" className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="text-lg font-bold text-navy">Qui gagne, métier par métier</h2>
          <ul className="mt-3 grid gap-1.5 text-sm">
            {sectors
              .filter((s) => (bySector.get(s.slug) ?? 0) >= RANKING_MIN_AWARDS)
              .map((s) => (
                <li key={s.slug} className="flex justify-between gap-3">
                  <Link href={`/resultats/${s.slug}`} className="text-teal-800 hover:underline">
                    Marchés publics de {s.label.toLowerCase()}
                  </Link>
                  <span className="text-slate-500">{nf.format(bySector.get(s.slug) ?? 0)}</span>
                </li>
              ))}
          </ul>
        </nav>
        <nav aria-label="Classements par région" className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="text-lg font-bold text-navy">Qui gagne, région par région</h2>
          <ul className="mt-3 grid gap-1.5 text-sm">
            {REGIONS.filter((r) => (byRegion.get(r.name) ?? 0) >= RANKING_MIN_AWARDS).map((r) => (
              <li key={r.slug} className="flex justify-between gap-3">
                <Link href={`/resultats/${ALL_TRADES}/${r.slug}`} className="text-teal-800 hover:underline">
                  Marchés publics en {r.name}
                </Link>
                <span className="text-slate-500">{nf.format(byRegion.get(r.name) ?? 0)}</span>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
