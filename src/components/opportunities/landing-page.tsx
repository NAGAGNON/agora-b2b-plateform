import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd, breadcrumbLd } from "@/components/json-ld";
import { OpportunityResults } from "@/components/opportunities/opportunity-results";
import { ButtonLink } from "@/components/ui/button";
import { searchOpportunities } from "@/lib/queries/opportunities";
import { parseOpportunityFilters, type RawSearchParams } from "@/lib/search-params";
import { pageMetadata } from "@/lib/seo";
import { MIN_INDEXABLE, type Landing } from "@/lib/landing";
import { getSession } from "@/lib/auth";

export async function landingMetadata(landing: Landing, path: string, sp: RawSearchParams): Promise<Metadata> {
  const { total } = await searchOpportunities(parseOpportunityFilters(landing.fixed), 1);
  return pageMetadata({
    title: landing.title,
    description: landing.description,
    // Adresse canonique (ex. /opportunites/finistere → /opportunites/bretagne/finistere)
    path: landing.crumbs.at(-1)?.path ?? path,
    // Pas d'indexation des pages sans contenu suffisant ni des combinaisons de filtres.
    noindex: total < MIN_INDEXABLE || Object.keys(sp).length > 0,
  });
}

/** Page d'atterrissage (France, région, département, secteur) : liste filtrée + liens utiles. */
export async function LandingPage({ landing, path, sp }: { landing: Landing; path: string; sp: RawSearchParams }) {
  const filters = parseOpportunityFilters({ ...sp, ...landing.fixed });
  const session = await getSession();
  const crumbs = [{ name: "Opportunités", path: "/opportunites" }, ...landing.crumbs];
  return (
    <div className="container-page py-8 sm:py-10">
      <JsonLd data={breadcrumbLd(crumbs)} />
      <nav aria-label="Fil d'Ariane" className="mb-3 text-sm text-slate-500">
        {crumbs.map((c, i) => (
          <span key={c.path}>
            {i > 0 && " / "}
            {i < crumbs.length - 1 ? (
              <Link href={c.path} className="hover:underline">
                {c.name}
              </Link>
            ) : (
              <span className="text-navy">{c.name}</span>
            )}
          </span>
        ))}
      </nav>
      <h1 className="text-2xl font-bold sm:text-3xl">{landing.heading}</h1>
      <p className="mt-1 mb-4 max-w-3xl text-slate-600">{landing.intro}</p>
      {landing.children && landing.children.length > 0 && (
        <details className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-navy">{landing.kind === "region" ? "Par département" : "Par région"}</summary>
          <ul className="mt-3 flex flex-wrap gap-2">
            {landing.children.map((c) => (
              <li key={c.path}>
                <Link href={c.path} className="inline-block rounded-full bg-sky px-3 py-1 text-navy hover:bg-sky-200">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
      <OpportunityResults filters={filters} rawParams={sp} basePath={path} />
      {!session && (
        <div className="mt-10 flex flex-col items-start gap-3 rounded-2xl bg-sky p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-navy">Vous recherchez des opportunités similaires ? Créez votre compte LinkProB2B et recevez-les par alerte.</p>
          <ButtonLink href="/inscription">Créer mon compte gratuitement</ButtonLink>
        </div>
      )}
    </div>
  );
}
