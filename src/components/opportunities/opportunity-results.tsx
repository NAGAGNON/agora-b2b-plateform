import { SearchX } from "lucide-react";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { FilterFields } from "@/components/opportunities/filter-panel";
import { MobileFilters } from "@/components/opportunities/mobile-filters";
import { QuickFilters, type QuickFilter } from "@/components/opportunities/quick-filters";
import { createClient } from "@/lib/supabase/server";
import { SortSelect } from "@/components/opportunities/sort-select";
import { SearchActions } from "@/components/opportunities/save-search";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { searchOpportunities } from "@/lib/queries/opportunities";
import { correctQuery } from "@/lib/search-suggest";
import { track } from "@/lib/analytics";
import { getDepartments, getPlaces, getSectorLabels } from "@/lib/queries/platform";
import { ActiveFilters, FilterHeader, FilterSubmit, withoutParam, type ActiveFilter } from "@/components/ui/filters";
import { REGIONS } from "@/lib/geo";
import { activeFilterCount, type OpportunityFilters, type RawSearchParams } from "@/lib/search-params";
import { getSession } from "@/lib/auth";
import { COMPANY_SIZE_LABELS, OPPORTUNITY_TYPE_LABELS, PAGE_SIZE, sectorLabel } from "@/lib/constants";

/** Date (AAAA-MM-JJ) dans `n` jours (hors rendu pur). */
const dateInDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

/** Liste de résultats + filtres, partagée par /opportunites et les pages secteur / département. */
export async function OpportunityResults({ filters, rawParams, basePath, trackSearch = false }: { filters: OpportunityFilters; rawParams: RawSearchParams; basePath: string; trackSearch?: boolean }) {
  const [first, departments, places, session, labels] = await Promise.all([
    searchOpportunities(filters),
    getDepartments(),
    getPlaces(),
    getSession(),
    getSectorLabels(),
  ]);
  // Aucun résultat à cause d'une faute de frappe (« nétoyage ») : la recherche corrigée est montrée
  let { rows, total } = first;
  const { error } = first;
  let corrected: string | null = null;
  if (!error && total === 0 && filters.q) {
    const fixed = correctQuery(filters.q);
    if (fixed) {
      const retry = await searchOpportunities({ ...filters, q: fixed });
      if (!retry.error && retry.total > 0) {
        ({ rows, total } = retry);
        corrected = fixed;
      }
    }
  }
  // Toujours rien : on élargit tout seul (jamais de page vide). D'abord les mots cherchés partout en France
  // et dans tous les secteurs, puis la zone et le secteur choisis sans les mots.
  let nearby: { rows: typeof rows; label: string } | null = null;
  if (!error && total === 0) {
    const hasPlace = Boolean(filters.region || filters.department || filters.city || filters.place);
    const tries: { f: typeof filters; label: string }[] = [];
    const loose = { ...filters, city: undefined, place: undefined, source: undefined, size: undefined, types: [], publishedSince: undefined, publishedWithin: undefined, deadlineBefore: undefined, skills: [], status: "OPEN" as const, page: 1 };
    const sectorName = filters.sector ? sectorLabel(filters.sector, labels) : null;
    const deptRow = filters.department ? departments.find((d) => d.code === filters.department) : null;
    const regionSlug = filters.region ?? (deptRow?.region ? REGIONS.find((x) => x.name === deptRow.region)?.slug : undefined);
    const regionName = regionSlug ? REGIONS.find((x) => x.slug === regionSlug)?.name : null;
    const where = sectorName ? `${sectorName}, ` : "";
    // Sans mot-clé : on retire d'abord les filtres secondaires, puis on élargit la zone
    if (!filters.q) {
      const extra = Boolean(filters.city || filters.place || filters.size || filters.types.length || filters.publishedWithin || filters.deadlineBefore || filters.skills.length || filters.status !== "OPEN");
      if (extra && (filters.department || filters.region || filters.sector))
        tries.push({ f: { ...loose, origin: filters.origin }, label: `${where}${deptRow ? `${deptRow.name} (${deptRow.code})` : (regionName ?? "même zone")}, sans les autres filtres` });
      if (filters.department && regionSlug)
        tries.push({ f: { ...loose, origin: filters.origin, department: undefined, region: regionSlug }, label: `${where}dans toute la région ${regionName}` });
      if (filters.sector && (filters.department || filters.region))
        tries.push({ f: { ...loose, origin: filters.origin, department: undefined, region: undefined }, label: `${where}partout en France` });
      // Besoins d'entreprises introuvables : les marchés publics du même métier et de la même zone
      if (filters.origin === "INTERNAL" && (filters.sector || filters.department || filters.region)) tries.push({ f: { ...loose, origin: undefined }, label: `appels d'offres et besoins, ${where}${deptRow ? deptRow.name : (regionName ?? "même zone")}` });
    }
    // Mots cherchés avec des filtres qui ne donnent rien (zone, secteur, types, « besoins d'entreprises », taille…) :
    // les mêmes mots sans aucun filtre
    if (filters.q && (hasPlace || filters.sector || filters.types.length || filters.origin || filters.size || filters.skills.length || filters.publishedWithin || filters.deadlineBefore || filters.status !== "OPEN"))
      tries.push({
        f: { ...filters, region: undefined, department: undefined, city: undefined, place: undefined, sector: undefined, types: [], origin: undefined, size: undefined, skills: [], source: undefined, status: "OPEN", publishedSince: undefined, publishedWithin: undefined, deadlineBefore: undefined, page: 1 },
        label: filters.origin === "INTERNAL" ? `« ${corrected ?? filters.q} » dans les appels d'offres (aucun besoin d'entreprise pour ces mots)` : `« ${corrected ?? filters.q} », sans les autres filtres`,
      });
    if (filters.q && (hasPlace || filters.sector)) tries.push({ f: { ...filters, q: undefined, page: 1 }, label: "dans la même zone et le même secteur, sans les mots cherchés" });
    if (filters.q && filters.q.trim().split(/\s+/).length > 1) {
      const longest = filters.q.trim().split(/\s+/).sort((a, b) => b.length - a.length)[0];
      tries.push({ f: { ...filters, q: longest, page: 1 }, label: `« ${longest} »` });
    }
    for (const t of tries) {
      const r = await searchOpportunities(t.f).catch(() => null);
      if (r && !r.error && r.total > 0) {
        nearby = { rows: r.rows.slice(0, 6), label: t.label };
        break;
      }
    }
  }
  // Recherche d'un membre : mesurée avec son nombre de résultats (part des recherches sans résultat)
  if (trackSearch && !error) {
    // Tous les filtres actifs sont notés, pour comprendre les recherches sans résultat
    void track("search_opportunities", {
      has_query: Boolean(filters.q),
      sector: filters.sector ?? null,
      region: filters.region ?? null,
      department: filters.department ?? null,
      results: first.total,
      ...(corrected ? { corrected: true } : {}),
      ...(filters.city ? { city: filters.city } : {}),
      ...(filters.place ? { place: filters.place, radius: filters.radius ?? null } : {}),
      ...(filters.origin ? { origin: filters.origin } : {}),
      ...(filters.types.length ? { types: filters.types.join(",") } : {}),
      ...(filters.size ? { size: filters.size } : {}),
      ...(filters.skills.length ? { skills: filters.skills.length } : {}),
      ...(filters.status !== "OPEN" ? { status: filters.status } : {}),
      ...(filters.publishedWithin ? { published_within: filters.publishedWithin } : {}),
      ...(filters.deadlineBefore ? { deadline_before: true } : {}),
      ...(first.total === 0 ? { nearby: nearby?.label ?? null } : {}),
    });
  }
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
  const supabase = await createClient();
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
  // Raccourcis : métier et département de l'entreprise du membre, puis les filtres les plus utilisés
  const company = session?.activeCompany?.company.id;
  const [{ data: myProfile }, { data: myCompany }] = company
    ? await Promise.all([
        supabase.from("company_profiles").select("sectors").eq("company_id", company).maybeSingle(),
        supabase.from("companies").select("department_code").eq("id", company).maybeSingle(),
      ])
    : [{ data: null }, { data: null }];
  const mySector = myProfile?.sectors?.[0];
  const myDept = myCompany?.department_code;
  const in15 = dateInDays(15);
  const quick: QuickFilter[] = [
    ...(mySector && !basePath.includes(mySector) ? [{ key: "metier", label: `Mon métier · ${sectorLabel(mySector, labels)}`, icon: "metier" as const, set: { secteur: mySector } }] : []),
    ...(myDept ? [{ key: "zone", label: `Mon département · ${departments.find((d) => d.code === myDept)?.name ?? myDept}`, icon: "zone" as const, set: { departement: myDept } }] : []),
    { key: "nouveau", label: "Nouvelles (7 jours)", icon: "nouveau", set: { publiee: "7" } },
    { key: "echeance", label: "Clôture sous 15 jours", icon: "echeance", set: { echeance: in15 } },
  ];

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
        <div className="mt-4 lg:mt-0">
          <QuickFilters items={quick} basePath={basePath} raw={rawParams} />
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        {corrected && (
          <p className="mt-4 rounded-xl bg-sky/60 px-4 py-3 text-sm text-slate-700" data-testid="search-corrected">
            Aucune offre pour « {filters.q} ». Résultats pour <strong className="text-navy">« {corrected} »</strong>.
          </p>
        )}
        <div className="mt-6">
          {error ? (
            <ErrorState description="La recherche n'a pas pu aboutir. Veuillez réessayer dans un instant." />
          ) : rows.length === 0 && filters.origin === "INTERNAL" && !nearby ? (
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
          ) : rows.length === 0 && nearby ? (
            <div className="space-y-4" data-testid="nearby-results">
              <p className="rounded-2xl bg-sky px-4 py-3 text-sm text-navy ring-1 ring-slate-200">
                Aucune offre exacte pour ces critères. Voici des offres proches : <strong>{nearby.label}</strong>.{" "}
                <a href={basePath} className="font-semibold text-teal-700 underline">
                  Effacer les filtres
                </a>
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {nearby.rows.map((o) => (
                  <OpportunityCard key={o.id} o={o} headingLevel={2} />
                ))}
              </div>
            </div>
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
          <Pagination page={filters.page} pageCount={pageCount} basePath={basePath} params={corrected ? { ...rawParams, q: corrected } : rawParams} />
        </div>
      </div>
    </div>
  );
}
