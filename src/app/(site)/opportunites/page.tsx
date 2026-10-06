import { OpportunityResults } from "@/components/opportunities/opportunity-results";
import { parseOpportunityFilters } from "@/lib/search-params";
import { pageMetadata } from "@/lib/seo";
import { track } from "@/lib/analytics";

export async function generateMetadata(props: PageProps<"/opportunites">) {
  const sp = await props.searchParams;
  const hasFilters = Object.keys(sp).length > 0;
  return pageMetadata({
    title: "Explorer les opportunités B2B",
    description: "Besoins d'entreprises, demandes de devis, consultations privées et opportunités externes référencées — Bretagne et France.",
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
      <p className="mt-1 mb-6 max-w-3xl text-slate-600">
        Besoins publiés par des entreprises sur LinkProB2B et opportunités externes référencées avec leur source. La provenance est toujours indiquée.
      </p>
      <OpportunityResults filters={filters} rawParams={sp} basePath="/opportunites" />
    </div>
  );
}
