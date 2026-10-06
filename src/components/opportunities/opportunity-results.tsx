import { SearchX } from "lucide-react";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { FilterFields } from "@/components/opportunities/filter-panel";
import { MobileFilters } from "@/components/opportunities/mobile-filters";
import { SortSelect } from "@/components/opportunities/sort-select";
import { SearchActions } from "@/components/opportunities/save-search";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { searchOpportunities } from "@/lib/queries/opportunities";
import { getDepartments, getPlaces } from "@/lib/queries/platform";
import { activeFilterCount, type OpportunityFilters, type RawSearchParams } from "@/lib/search-params";
import { getSession } from "@/lib/auth";
import { PAGE_SIZE } from "@/lib/constants";

/** Liste de résultats + filtres, partagée par /opportunites et les pages secteur / département. */
export async function OpportunityResults({ filters, rawParams, basePath }: { filters: OpportunityFilters; rawParams: RawSearchParams; basePath: string }) {
  const [{ rows, total, error }, departments, places, session] = await Promise.all([
    searchOpportunities(filters),
    getDepartments(),
    getPlaces(),
    getSession(),
  ]);
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const query = new URLSearchParams(
    Object.entries(rawParams).flatMap(([k, v]) => (v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((x) => [k, x] as [string, string]))),
  );
  query.delete("page");
  const alertParams = new URLSearchParams();
  if (filters.sector) alertParams.set("secteur", filters.sector);
  if (filters.department) alertParams.set("departement", filters.department);
  if (filters.q) alertParams.set("motscles", filters.q);
  if (filters.types.length === 1) alertParams.set("type", filters.types[0]);
  if (filters.place) {
    alertParams.set("lieu", filters.place);
    if (filters.radius) alertParams.set("rayon", String(filters.radius));
  }
  const count = activeFilterCount(filters);

  return (
    <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
      <aside className="hidden lg:block" aria-label="Filtres">
        <form action={basePath} method="get" className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <FilterFields f={filters} departments={departments} places={places} idPrefix="d" />
          <div className="mt-6 flex gap-2">
            <a href={basePath} className="flex h-11 flex-1 items-center justify-center rounded-lg border border-slate-300 text-sm font-semibold text-navy hover:bg-sky">
              Effacer
            </a>
            <button type="submit" className="h-11 flex-[2] rounded-lg bg-teal text-sm font-semibold text-white hover:bg-teal-600">
              Appliquer
            </button>
          </div>
        </form>
      </aside>
      <div className="min-w-0">
        <MobileFilters count={count} action={basePath}>
          <FilterFields f={filters} departments={departments} places={places} idPrefix="m" />
        </MobileFilters>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:mt-0">
          <p className="text-sm text-slate-600" aria-live="polite">
            <strong className="text-navy">{total}</strong> opportunité{total > 1 ? "s" : ""}
            {filters.q ? (
              <>
                {" "}
                pour « <strong className="text-navy">{filters.q}</strong> »
              </>
            ) : null}
          </p>
          <SortSelect value={filters.sort} hasQuery={Boolean(filters.q)} hasPlace={Boolean(filters.place)} />
        </div>
        <div className="mt-3">
          <SearchActions query={query.toString()} signedIn={Boolean(session)} alertHref={`/dashboard/alertes?${alertParams.toString()}`} />
        </div>
        <div className="mt-6">
          {error ? (
            <ErrorState description="La recherche n'a pas pu aboutir. Veuillez réessayer dans un instant." />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<SearchX className="size-6" aria-hidden />}
              title="Aucune opportunité ne correspond à ces critères"
              description="Élargissez votre recherche (rayon, secteur, statut) ou créez une alerte pour être prévenu des prochaines publications."
              action={<ButtonLink href={basePath} variant="outline">Effacer les filtres</ButtonLink>}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {rows.map((o) => (
                <OpportunityCard key={o.id} o={o} headingLevel={2} />
              ))}
            </div>
          )}
          <Pagination page={filters.page} pageCount={pageCount} basePath={basePath} params={rawParams} />
        </div>
      </div>
    </div>
  );
}
