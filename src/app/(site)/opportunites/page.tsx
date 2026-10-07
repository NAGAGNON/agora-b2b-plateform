import { OpportunityResults } from "@/components/opportunities/opportunity-results";
import { parseOpportunityFilters } from "@/lib/search-params";
import { pageMetadata } from "@/lib/seo";
import { track } from "@/lib/analytics";
import { getPlatformStats } from "@/lib/queries/platform";
import { FreshnessBar } from "@/components/opportunities/freshness";

export async function generateMetadata(props: PageProps<"/opportunites">) {
  const sp = await props.searchParams;
  const hasFilters = Object.keys(sp).length > 0;
  return pageMetadata({
    title: "Opportunités B2B et appels d'offres",
    description: "Besoins d'entreprises, demandes de devis, consultations et marchés publics partout en France, par région, département, ville et secteur.",
    path: "/opportunites",
    // Les combinaisons de filtres ne sont pas indexées (évite les pages dupliquées).
    noindex: hasFilters,
  });
}

export default async function OpportunitiesPage(props: PageProps<"/opportunites">) {
  const sp = await props.searchParams;
  const filters = parseOpportunityFilters(sp);
  if (filters.q || Object.keys(sp).length > 0) {
    void track("search_opportunities", { has_query: Boolean(filters.q), sector: filters.sector ?? null, department: filters.department ?? null });
  }
  return (
    <div className="container-page py-8 sm:py-10">
      <h1 className="text-2xl font-bold sm:text-3xl">Explorer les opportunités</h1>
      <p className="mt-1 max-w-3xl text-slate-600">
        Appels d&apos;offres publics, consultations et besoins publiés par des entreprises, partout en France. La source de chaque opportunité est
        toujours indiquée, avec un lien vers l&apos;annonce officielle.
      </p>
      <FreshnessBar stats={await getPlatformStats()} className="mt-3 mb-6" />
      <OpportunityResults filters={filters} rawParams={sp} basePath="/opportunites" />
    </div>
  );
}
