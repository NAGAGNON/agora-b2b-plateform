import { notFound, redirect } from "next/navigation";
import { RankingPage } from "@/components/awards/ranking-page";
import { pageMetadata } from "@/lib/seo";
import { REGIONS } from "@/lib/geo";
import { getAwardCounts, getLatestAwards, getTopWinners, RANKING_MIN_AWARDS } from "@/lib/queries/awards";
import { ALL_TRADES, fitTitle, rankingScope } from "@/lib/awards-pages";

const nf = new Intl.NumberFormat("fr-FR");

export async function generateMetadata(props: PageProps<"/resultats/[sector]">) {
  const { sector } = await props.params;
  const s = await rankingScope(sector, null);
  if (!s?.sector) return { title: "Page introuvable", robots: { index: false } };
  const label = s.sector.label.toLowerCase();
  return pageMetadata({
    title: fitTitle(
      `Qui gagne les marchés publics de ${label} ? Classement ${new Date().getFullYear()}`,
      `Qui gagne les marchés de ${label} en ${new Date().getFullYear()} ?`,
      `Marchés de ${label} : qui gagne ?`,
    ),
    description: `Les entreprises qui remportent le plus de marchés publics de ${label} en France (${nf.format(s.n)} marchés attribués au BOAMP), et le détail des derniers contrats.`,
    path: `/resultats/${sector}`,
    noindex: !s.indexable,
  });
}

export default async function SectorRankingPage(props: PageProps<"/resultats/[sector]">) {
  const { sector } = await props.params;
  if (sector === ALL_TRADES) redirect("/resultats");
  const s = await rankingScope(sector, null);
  if (!s?.sector) notFound();
  const label = s.sector.label.toLowerCase();
  const [winners, latest, counts] = await Promise.all([getTopWinners(s.sector.slug, null, 30), getLatestAwards({ sector: s.sector.slug }, 15), getAwardCounts().catch(() => [])]);
  const regions = REGIONS.filter((r) => counts.filter((c) => c.sector === s.sector!.slug && c.region === r.name).reduce((n, c) => n + c.n, 0) >= RANKING_MIN_AWARDS);
  return (
    <RankingPage
      heading={`Qui gagne les marchés publics de ${label} ?`}
      intro={`${nf.format(s.n)} marchés publics de ${label} attribués en France d'après les avis officiels du BOAMP : les entreprises qui en remportent le plus, et les derniers contrats signés.`}
      crumbs={[
        { name: "Résultats des marchés publics", path: "/resultats" },
        { name: s.sector.label, path: `/resultats/${sector}` },
      ]}
      winners={winners}
      latest={latest}
      sector={s.sector.label}
      sectorSlug={s.sector.slug}
      regionName={null}
      links={[
        { href: `/opportunites/${sector}`, label: `Appels d'offres de ${label} ouverts` },
        ...regions.map((r) => ({ href: `/resultats/${sector}/${r.slug}`, label: `Qui gagne en ${r.name}` })),
      ]}
    />
  );
}
