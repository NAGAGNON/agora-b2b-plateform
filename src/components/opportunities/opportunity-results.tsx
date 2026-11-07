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
import { getDepartments, getPlaces, getSectorLabels } from "@/lib/queries/platform";
import { ActiveFilters, FilterHeader, FilterSubmit, withoutParam, type ActiveFilter } from "@/components/ui/filters";
import { REGIONS } from "@/lib/geo";
import { activeFilterCount, type OpportunityFilters, type RawSearchParams } from "@/lib/search-params";
import { getSession } from "@/lib/auth";
import { COMPANY_SIZE_LABELS, OPPORTUNITY_TYPE_LABELS, PAGE_SIZE, sectorLabel } from "@/lib/constants";

/** Liste de résultats + filtres, partagée par /opportunites et les pages secteur / département. */
export async function OpportunityResults({ filters, rawParams, basePath }: { filters: OpportunityFilters; rawParams: RawSearchParams; basePath: string }) {
  const [{ rows, total, error }, departments, places, session, labels] = await Promise.all([
    searchOpportunities(filters),
    getDepartments(),
    getPlaces(),
    getSession(),
    getSectorLabels(),
  ]);
  // Filtres présents dans l'adresse, en pastilles retirables (le secteur d'une page secteur n'en fait pas partie)
  const has = (k: string) => rawParams[k] !== undefined && rawParams[k] !== "";
  const off = (k: string, v?: string) => withoutParam(basePath, rawParams, k, v);
  const active: ActiveFilter[] = [
    ...(has("q") && filters.q ? [{ key: "q", label: `« ${filters.q} »`, href: off("q") }] : []),
    ...(has("secteur") && filters.sector ? [{ key: "secteur", label: sectorLabel(filters.sector, labels), href: off("secteur") }] : []),
    ...filters.types.map((t) => ({ key: `type-${t}`, label: OPPORTUNITY_TYPE_LABELS[t], href: off("type", t) })),
    ...(has("origine") && filters.origin ? [{ key: "origine", label: filters.origin === "INTERNAL" ? "Besoins d'entreprises" : "Marchés publics et externes", href: off("origine") }] : []),
    ...(has("region") && filters.region ? [{ key: "region", label: REGIONS.find((r) => r.slug === filters.region)?.name ?? filters.region, href: off("region") }] : []),
    ...(has("departement") && filters.department
      ? [{ key: "departement", label: `${departments.find((d) => d.code === filters.department)?.name ?? "Département"} (${filters.department})`, href: off("departement") }]
      : []),
    ...(has("ville") && filters.city ? [{ key: "ville", label: filters.city, href: off("ville") }] : []),
    ...(has("lieu") && filters.place
      ? [{ key: "lieu", label: `${places.find((p) => p.slug === filters.place)?.name ?? filters.place} · ${filters.radius ?? 50} km`, href: withoutParam(basePath, Object.fromEntries(Object.entries(rawParams).filter(([k]) => k !== "rayon")), "lieu") }]
      : []),
    ...(filters.status !== "OPEN" ? [{ key: "statut", label: filters.status === "CLOSED" ? "Clôturées" : "Ouvertes et clôturées", href: off("statut") }] : []),
    ...(filters.publishedWithin ? [{ key: "publiee", label: `Publiées depuis ${filters.publishedWithin} jours`, href: off("publiee") }] : []),
    ...(filters.deadlineBefore ? [{ key: "echeance", label: `Échéance avant le ${filters.deadlineBefore.split("-").reverse().join("/")}`, href: off("echeance") }] : []),
    ...(filters.size ? [{ key: "taille", label: COMPANY_SIZE_LABELS[filters.size].replace(/\s*\(.*\)$/, ""), href: off("taille") }] : []),
    ...(filters.skills.length ? [{ key: "competences", label: filters.skills.join(", "), href: off("competences") }] : []),
    ...(has("source") && filters.source ? [{ key: "source", label: `Source : ${filters.source}`, href: off("source") }] : []),
  ];
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const query = new URLSearchParams(
    Object.entries(rawParams).flatMap(([k, v]) => (v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((x) => [k, x] as [string, string]))),
  );
  query.delete("page");
  const alertParams = new URLSearchParams();
  if (filters.sector) alertParams.set("secteur", filters.sector);
  if (filters.region) alertParams.set("region", filters.region);
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
        <form action={basePath} method="get" className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain rounded-3xl border border-slate-200 bg-white p-5 shadow-sm [scrollbar-width:thin]">
          <FilterHeader count={count} resetHref={basePath} />
          <FilterFields f={filters} departments={departments} places={places} idPrefix="d" />
          <FilterSubmit />
        </form>
      </aside>
      <div className="min-w-0">
        <MobileFilters count={count} action={basePath} title="Filtrer les opportunités">
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
        {active.length > 0 && (
          <div className="mt-3">
            <ActiveFilters items={active} resetHref={basePath} />
          </div>
        )}
        <div className="mt-3">
          <SearchActions query={query.toString()} signedIn={Boolean(session)} alertHref={`/dashboard/alertes?${alertParams.toString()}`} />
        </div>
        <div className="mt-6">
          {error ? (
            <ErrorState description="La recherche n'a pas pu aboutir. Veuillez réessayer dans un instant." />
          ) : rows.length === 0 && filters.origin === "INTERNAL" ? (
            <EmptyState
              icon={<SearchX className="size-6" aria-hidden />}
              title={session ? "Aucun besoin d'entreprise ouvert pour ces critères" : "Aucun besoin d'entreprise visible pour le moment"}
              description={
                session
                  ? "Les besoins publiés par les entreprises apparaissent ici dès leur validation. Créez une alerte pour être prévenu, ou consultez les marchés publics en cours."
                  : "Certains besoins sont réservés aux membres : connectez-vous ou créez un compte gratuit pour les voir. Vous pouvez aussi publier le vôtre ou consulter les marchés publics en cours."
              }
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <ButtonLink href="/publier">Publier un besoin</ButtonLink>
                  {!session && (
                    <ButtonLink href="/inscription?suite=/opportunites?origine=INTERNAL" variant="outline">
                      Créer mon compte gratuit
                    </ButtonLink>
                  )}
                  <ButtonLink href="/opportunites" variant="outline">
                    Voir toutes les opportunités
                  </ButtonLink>
                </div>
              }
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<SearchX className="size-6" aria-hidden />}
              title="Aucune opportunité ne correspond à ces critères"
              description="Élargissez votre recherche (rayon, secteur, statut) ou créez une alerte pour être prévenu des prochaines publications."
              action={<ButtonLink href={basePath} variant="outline">Effacer les filtres</ButtonLink>}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
