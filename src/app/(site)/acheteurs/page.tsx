import { notFound } from "next/navigation";
import { PageHero } from "@/components/layout/page-hero";
import Link from "next/link";
import { Landmark } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listingIndexing, pageMetadata } from "@/lib/seo";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/states";
import { REGIONS } from "@/lib/geo";
import { NATIONAL_BUYERS } from "@/lib/queries/buyers";

const PER_PAGE = 60;
const nf = new Intl.NumberFormat("fr-FR");

export async function generateMetadata(props: PageProps<"/acheteurs">) {
  const listing = listingIndexing("/acheteurs", await props.searchParams);
  return pageMetadata({
    title: "Acheteurs publics : leurs appels d'offres en cours",
    description: "Communes, intercommunalités, départements, régions, hôpitaux : retrouvez les appels d'offres en cours de chaque acheteur public, à partir des annonces BOAMP et TED.",
    path: listing.path,
    noindex: listing.filtered,
  });
}

/** Annuaire des acheteurs publics ayant au moins un appel d'offres ouvert (données réelles). */
export default async function BuyersPage(props: PageProps<"/acheteurs">) {
  const sp = await props.searchParams;
  const page = Math.max(1, Math.min(999, Number(typeof sp.page === "string" ? sp.page : 1) || 1));
  const supabase = await createClient();
  // Une ligne de plus pour savoir s'il existe une page suivante
  const { data } = await supabase.rpc("public_buyers", { p_limit: PER_PAGE + 1, p_offset: (page - 1) * PER_PAGE });
  const rows = (data ?? []).slice(0, PER_PAGE);
  if (page > 1 && !rows.length) notFound();
  const hasNext = (data ?? []).length > PER_PAGE;
  return (
    <>
      <PageHero
        eyebrow="Marchés publics"
        image="/images/illustrations/gratte-ciel.webp"
        title="Acheteurs publics"
        intro={<>Les communes, intercommunalités, départements, régions, hôpitaux et autres organismes publics qui ont des appels d&apos;offres en cours, à partir des
        annonces officielles (BOAMP, TED). Les acheteurs avec le plus d&apos;appels d&apos;offres ouverts apparaissent en premier.</>}
      />
    <div className="container-page py-10 sm:py-14">
      {page === 1 && (
        <nav aria-label="Acheteurs publics par région" className="rounded-2xl bg-sky/60 p-5 ring-1 ring-teal/20">
          <h2 className="text-base font-bold text-navy">Tous les acheteurs publics, région par région</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {[...REGIONS.map((r) => ({ slug: r.slug, name: r.name })), NATIONAL_BUYERS].map((r) => (
              <li key={r.slug}>
                <Link href={`/acheteurs/region/${r.slug}`} className="inline-flex rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-teal-800 ring-1 ring-teal/30 transition hover:-translate-y-0.5 hover:bg-teal hover:text-navy">
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {rows.length ? (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((b) => (
            <li key={b.slug}>
              <Link href={`/acheteurs/${b.slug}`} className="flex h-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-teal">
                <Landmark className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden />
                <span className="min-w-0">
                  <span className="block font-semibold text-navy">{b.name}</span>
                  <span className="text-sm text-slate-600">
                    {nf.format(b.open_count)} appel{b.open_count > 1 ? "s" : ""} d&apos;offres ouvert{b.open_count > 1 ? "s" : ""}
                    {b.region ? ` · ${b.region}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-10">
          <EmptyState title="Aucun acheteur sur cette page" description="Les acheteurs apparaissent dès qu'un de leurs appels d'offres est ouvert." />
        </div>
      )}
      <Pagination page={page} pageCount={hasNext ? page + 1 : page} basePath="/acheteurs" params={sp} />
    </div>
    </>
  );
}
