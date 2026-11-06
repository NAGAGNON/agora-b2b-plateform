import Link from "next/link";
import { requireAccount } from "@/lib/members-only";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
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
import { UpgradeGate } from "@/components/billing/upsell";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

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
  const searching = Boolean(filters.q) || Object.keys(sp).some((k) => k !== "page");
  if (searching) {
    void track("search_opportunities", { has_query: Boolean(filters.q), sector: filters.sector ?? null, department: filters.department ?? null });
  }
  // Offre Gratuite (après la phase de lancement) : nombre de recherches par semaine limité ; au-delà,
  // l'essai Pro ou l'offre de lancement est proposé à la place des résultats
  const h = await headers();
  const prefetch = Boolean(h.get("next-router-prefetch")) || h.get("purpose") === "prefetch";
  const allowed = searching && filters.page === 1 && !prefetch ? await (await createClient()).rpc("count_search").then((r) => r.data !== false) : true;
  return (
    <>
      <PageHero
        compact
        eyebrow="Marchés publics et besoins d'entreprises"
        title="Explorer les opportunités"
        intro={
          <>
            Appels d&apos;offres publics, consultations et besoins publiés par des entreprises, partout en France.
            <span className="hidden sm:inline"> La source de chaque opportunité est toujours indiquée, avec un lien vers l&apos;annonce officielle.</span>{" "}
            Freelance ?{" "}
            <Link href="/independants" className="font-semibold text-teal-700 underline">
              Voir les missions de votre métier
            </Link>
            .
          </>
        }
      >
        <FreshnessBar stats={await getPlatformStats()} />
      </PageHero>
      <div className="container-page py-8 sm:py-10">
      {filters.page === 1 && !filters.q && filters.origin !== "EXTERNAL" && (
        <FeaturedNeeds sector={filters.sector} department={filters.department} region={filters.region ? (regionBySlug(filters.region)?.name ?? null) : null} />
      )}
      {allowed ? (
        <OpportunityResults filters={filters} rawParams={sp} basePath="/opportunites" />
      ) : (
        <UpgradeGate
          session={await getSession()}
          testId="search-limit"
          title="Vos 15 recherches gratuites de la semaine sont utilisées"
          reason="Avec Pro, vos recherches sont illimitées."
          suite={`/opportunites?${new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])))}`}
        />
      )}
      </div>
    </>
  );
}
