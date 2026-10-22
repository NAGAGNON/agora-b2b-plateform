import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { JsonLd, breadcrumbLd } from "@/components/json-ld";
import { OpportunityResults } from "@/components/opportunities/opportunity-results";
import { ButtonLink } from "@/components/ui/button";
import { searchOpportunities } from "@/lib/queries/opportunities";
import { parseOpportunityFilters, type RawSearchParams } from "@/lib/search-params";
import { listingIndexing, pageMetadata } from "@/lib/seo";
import { MIN_INDEXABLE, type Landing } from "@/lib/landing";
import { getSession } from "@/lib/auth";
import { getPlatformStats } from "@/lib/queries/platform";
import { FreshnessBar } from "@/components/opportunities/freshness";
import { AlertLeadForm } from "@/components/alert-lead-form";
import { regionBySlug } from "@/lib/geo";

export async function landingMetadata(landing: Landing, path: string, sp: RawSearchParams): Promise<Metadata> {
  const { total } = await searchOpportunities(parseOpportunityFilters(landing.fixed), 1);
  // « France » reprend toute la liste : adresse canonique /opportunites (pas de doublon)
  const canonical = landing.kind === "france" ? "/opportunites" : (landing.crumbs.at(-1)?.path ?? path);
  const listing = listingIndexing(canonical, sp);
  return pageMetadata({
    title: landing.title,
    description: landing.description,
    // Adresse canonique (ex. /opportunites/finistere → /opportunites/bretagne/finistere)
    path: listing.path,
    // Pas d'indexation des pages sans contenu suffisant ni des combinaisons de filtres (pagination seule : indexée).
    noindex: total < MIN_INDEXABLE || listing.filtered,
  });
}

/** Page d'atterrissage (France, région, département, secteur) : liste filtrée + liens utiles. */
export async function LandingPage({ landing, path, sp }: { landing: Landing; path: string; sp: RawSearchParams }) {
  // Le visiteur a changé un filtre propre à cette page (autre région, autre secteur, « France entière ») :
  // la recherche continue sur la liste générale avec ses choix, au lieu d'être ignorée.
  const overridden = Object.entries(landing.fixed).some(([k, v]) => k in sp && sp[k] !== v);
  if (overridden) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...landing.fixed, ...sp })) {
      for (const x of Array.isArray(v) ? v : [v]) if (x) qs.append(k, x);
    }
    redirect(`/opportunites${qs.size ? `?${qs}` : ""}`);
  }
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
      <p className="mt-1 max-w-3xl text-slate-600">{landing.intro}</p>
      <FreshnessBar stats={await getPlatformStats()} className="mt-3 mb-4" />
      {!session && landing.kind !== "france" && (
        <div className="mb-6 max-w-3xl">
          <AlertLeadForm
            title="Recevoir ces marchés par e-mail"
            label={landing.heading.replace(/^Opportunités (B2B )?(dans le département |en |— )?/, "")}
            sector={typeof landing.fixed.secteur === "string" ? landing.fixed.secteur : null}
            department={typeof landing.fixed.departement === "string" ? landing.fixed.departement : null}
            region={typeof landing.fixed.region === "string" ? (regionBySlug(landing.fixed.region)?.name ?? null) : null}
            path={path}
          />
        </div>
      )}
      {landing.children && landing.children.length > 0 && (
        <details className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-navy">{landing.childrenLabel ?? (landing.kind === "region" ? "Par département" : "Par région")}</summary>
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
      {landing.related && landing.related.links.length > 0 && (
        <section className="mt-8" aria-labelledby="related-landings">
          <h2 id="related-landings" className="text-lg font-bold">
            {landing.related.label}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {landing.related.links.map((c) => (
              <li key={c.path}>
                <Link href={c.path} className="inline-block rounded-full bg-sky px-3 py-1 text-navy hover:bg-sky-200">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!session && (
        <div className="mt-10 flex flex-col items-start gap-3 rounded-2xl bg-sky p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-navy">Vous recherchez des opportunités similaires ? Créez votre compte LinkProB2B et recevez-les par alerte.</p>
          <ButtonLink href="/inscription">Créer mon compte gratuitement</ButtonLink>
        </div>
      )}
    </div>
  );
}
