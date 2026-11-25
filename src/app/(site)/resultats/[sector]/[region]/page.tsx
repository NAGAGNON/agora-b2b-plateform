import { notFound } from "next/navigation";
import { RankingPage } from "@/components/awards/ranking-page";
import { pageMetadata } from "@/lib/seo";
import { getAwardCounts, getLatestAwards, getTopWinners, RANKING_MIN_AWARDS } from "@/lib/queries/awards";
import { ALL_TRADES, fitTitle, rankingScope } from "@/lib/awards-pages";

const nf = new Intl.NumberFormat("fr-FR");

export async function generateMetadata(props: PageProps<"/resultats/[sector]/[region]">) {
  const { sector, region } = await props.params;
  const s = await rankingScope(sector, region);
  if (!s?.region) return { title: "Page introuvable", robots: { index: false } };
  const what = s.sector ? `de ${s.sector.label.toLowerCase()}` : "";
  return pageMetadata({
    title: fitTitle(
      `Qui gagne les marchés publics ${what} en ${s.region.name} en ${new Date().getFullYear()} ?`,
      `Qui gagne les marchés ${what} en ${s.region.name} en ${new Date().getFullYear()} ?`,
      `Qui gagne les marchés ${what} en ${s.region.name} ?`,
      `Marchés ${what} en ${s.region.name} : qui gagne ?`,
    ),
    description: `Les entreprises qui remportent le plus de marchés publics ${what} en ${s.region.name} (${nf.format(s.n)} marchés attribués au BOAMP), et le détail des derniers contrats.`.replace(/\s+/g, " "),
    path: `/resultats/${sector}/${region}`,
    noindex: !s.indexable,
  });
}

export default async function RegionRankingPage(props: PageProps<"/resultats/[sector]/[region]">) {
  const { sector, region } = await props.params;
  const s = await rankingScope(sector, region);
  if (!s?.region) notFound();
  const what = s.sector ? `de ${s.sector.label.toLowerCase()} ` : "";
  const [winners, latest, counts] = await Promise.all([
    getTopWinners(s.sector?.slug ?? null, s.region.name, 30),
    getLatestAwards({ sector: s.sector?.slug ?? null, region: s.region.name }, 15),
    getAwardCounts().catch(() => []),
  ]);
  // Autres métiers de la région (classements avec assez de données)
  const trades = s.sectors.filter((x) => x.slug !== s.sector?.slug && counts.filter((c) => c.sector === x.slug && c.region === s.region!.name).reduce((n, c) => n + c.n, 0) >= RANKING_MIN_AWARDS);
  return (
    <RankingPage
      heading={`Qui gagne les marchés publics ${what}en ${s.region.name} ?`}
      intro={`${nf.format(s.n)} marchés publics ${what}attribués en ${s.region.name} d'après les avis officiels du BOAMP : les entreprises qui en remportent le plus, et les derniers contrats signés.`}
      crumbs={[
        { name: "Résultats des marchés publics", path: "/resultats" },
        ...(s.sector ? [{ name: s.sector.label, path: `/resultats/${sector}` }] : []),
        { name: s.region.name, path: `/resultats/${sector}/${region}` },
      ]}
      winners={winners}
      latest={latest}
      sector={s.sector?.label ?? null}
      sectorSlug={s.sector?.slug ?? null}
      regionName={s.region.name}
      links={[
        ...(sector !== ALL_TRADES ? [{ href: `/resultats/${ALL_TRADES}/${region}`, label: `Tous les métiers en ${s.region.name}` }] : []),
        { href: `/opportunites/${region}`, label: `Appels d'offres ouverts en ${s.region.name}` },
        { href: `/acheteurs/region/${region}`, label: `Acheteurs publics en ${s.region.name}` },
        ...trades.slice(0, 12).map((t) => ({ href: `/resultats/${t.slug}/${region}`, label: `Marchés de ${t.label.toLowerCase()} en ${s.region!.name}` })),
      ]}
    />
  );
}
