import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Directory } from "@/components/companies/directory";
import { searchCompanies } from "@/lib/queries/companies";
import { getDepartments, getSectors } from "@/lib/queries/platform";
import { parseCompanyFilters } from "@/lib/search-params";
import { listingIndexing, pageMetadata } from "@/lib/seo";

async function resolve(slug: string, location: string) {
  const sector = (await getSectors()).find((s) => s.slug === slug);
  const dep = (await getDepartments()).find((d) => d.slug === location);
  return sector && dep ? { sector, dep } : null;
}

export async function generateMetadata(props: PageProps<"/entreprises/[slug]/[location]">): Promise<Metadata> {
  const { slug, location } = await props.params;
  const r = await resolve(slug, location);
  if (!r) return { title: "Page introuvable" };
  const { total } = await searchCompanies(parseCompanyFilters({ secteur: r.sector.slug, departement: r.dep.code }), 1);
  const listing = listingIndexing(`/entreprises/${slug}/${location}`, await props.searchParams);
  return pageMetadata({
    title: `${r.sector.label} — entreprises ${r.dep.name}`,
    description: `Prestataires et fournisseurs en ${r.sector.label.toLowerCase()} dans le département ${r.dep.name} (${r.dep.code}).`,
    path: listing.path,
    // Pas de page indexée avec moins de 3 entreprises (contenu trop mince) ni de combinaison de filtres
    noindex: total < 3 || listing.filtered,
  });
}

export default async function SectorLocationPage(props: PageProps<"/entreprises/[slug]/[location]">) {
  const { slug, location } = await props.params;
  const sp = await props.searchParams;
  const r = await resolve(slug, location);
  if (!r) notFound();
  return (
    <div className="container-page py-8 sm:py-10">
      <nav aria-label="Fil d'Ariane" className="mb-3 text-sm text-slate-500">
        <Link href="/entreprises" className="hover:underline">
          Annuaire
        </Link>{" "}
        /{" "}
        <Link href={`/entreprises/${r.sector.slug}`} className="hover:underline">
          {r.sector.label}
        </Link>{" "}
        / <span className="text-navy">{r.dep.name}</span>
      </nav>
      <h1 className="text-2xl font-bold sm:text-3xl">
        {r.sector.label} — {r.dep.name}
      </h1>
      <p className="mt-1 mb-6 text-slate-600">
        Entreprises du secteur {r.sector.label.toLowerCase()} situées dans le département {r.dep.name} ({r.dep.code}).
      </p>
      <Directory
        filters={parseCompanyFilters({ ...sp, secteur: r.sector.slug, departement: r.dep.code })}
        rawParams={sp}
        basePath={`/entreprises/${slug}/${location}`}
      />
    </div>
  );
}
