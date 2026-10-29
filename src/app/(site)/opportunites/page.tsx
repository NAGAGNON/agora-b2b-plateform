import { requireAccount } from "@/lib/members-only";
import { notFound } from "next/navigation";
import { OpportunityResults } from "@/components/opportunities/opportunity-results";
import { FeaturedNeeds } from "@/components/opportunities/featured-needs";
import { regionBySlug } from "@/lib/geo";
import { searchOpportunities } from "@/lib/queries/opportunities";
import { PAGE_SIZE } from "@/lib/constants";
import { parseOpportunityFilters } from "@/lib/search-params";
import { listingIndexing, pageMetadata } from "@/lib/seo";
import { track } from "@/lib/analytics";
import { getPlatformStats } from "@/lib/queries/platform";
import { FreshnessBar } from "@/components/opportunities/freshness";
import { PageHero } from "@/components/layout/page-hero";

export async function generateMetadata(props: PageProps<"/opportunites">) {
  const sp = await props.searchParams;
  const listing = listingIndexing("/opportunites", sp);
  return pageMetadata({
    title: "Opportunités B2B et appels d'offres",
    description: "Besoins d'entreprises, demandes de devis, consultations et marchés publics partout en France, par région, département, ville et secteur.",
    path: listing.path,
    // Les combinaisons de filtres ne sont pas indexées (évite les pages dupliquées) ; la pagination seule l'est.
    noindex: listing.filtered,
  });
}

export default async function OpportunitiesPage(props: PageProps<"/opportunites">) {
  const sp = await props.searchParams;
  // Recherche réservée aux membres : sans compte, inscription puis retour ici
  await requireAccount("/opportunites", sp);
  const filters = parseOpportunityFilters(sp);
  // Page au-delà des résultats (ou au-delà de la limite de 500) : page introuvable, jamais une page vide indexée
  const requested = typeof sp.page === "string" ? Number(sp.page) : 1;
  if (requested > 500) notFound();
  if (filters.page > 1) {
    const { total } = await searchOpportunities(filters);
    if ((filters.page - 1) * PAGE_SIZE >= total) notFound();
  }
  if (filters.q || Object.keys(sp).length > 0) {
    void track("search_opportunities", { has_query: Boolean(filters.q), sector: filters.sector ?? null, department: filters.department ?? null });
  }
  return (
    <>
      <PageHero
        compact
        eyebrow="Marchés publics et besoins d'entreprises"
        title="Explorer les opportunités"
        intro={
          <>
            Appels d&apos;offres publics, consultations et besoins publiés par des entreprises, partout en France.
            <span className="hidden sm:inline"> La source de chaque opportunité est toujours indiquée, avec un lien vers l&apos;annonce officielle.</span>
          </>
        }
      >
        <FreshnessBar stats={await getPlatformStats()} />
      </PageHero>
      <div className="container-page py-8 sm:py-10">
      {filters.page === 1 && !filters.q && filters.origin !== "EXTERNAL" && (
        <FeaturedNeeds sector={filters.sector} department={filters.department} region={filters.region ? (regionBySlug(filters.region)?.name ?? null) : null} />
      )}
      <OpportunityResults filters={filters} rawParams={sp} basePath="/opportunites" />
      </div>
    </>
  );
}
