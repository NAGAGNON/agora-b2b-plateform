import Link from "next/link";
import Image from "next/image";
import { BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listingIndexing, pageMetadata } from "@/lib/seo";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/ui/states";
import { REGIONS } from "@/lib/geo";

export const revalidate = 3600;

const PER_PAGE = 24;

const BASE_META = {
  title: "Analyses des marchés publics et appels d'offres",
  description:
    "Analyses des marchés publics et des besoins d'entreprises en France, par région, secteur et département, à partir des données BOAMP et TED.",
  path: "/analyses",
};

// Toutes les analyses restent atteignables (pagination indexable, pas seulement les plus récentes)
export async function generateMetadata(props: PageProps<"/analyses">) {
  const listing = listingIndexing("/analyses", await props.searchParams);
  return pageMetadata({ ...BASE_META, path: listing.path, noindex: listing.filtered });
}

export default async function AnalysesPage(props: PageProps<"/analyses">) {
  const sp = await props.searchParams;
  const page = Math.max(1, Math.min(9999, Number(typeof sp.page === "string" ? sp.page : 1) || 1));
  const supabase = await createClient();
  const { data, count } = await supabase
    .from("articles")
    .select("slug, title, description, published_at", { count: "exact" })
    .eq("status", "PUBLISHED")
    .order("published_at", { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="text-3xl font-bold sm:text-4xl">Analyses des marchés</h1>
      <p className="mt-3 max-w-2xl text-lg text-slate-600">
        Chaque jour, une nouvelle analyse des marchés publics et des besoins
        d&apos;entreprises : par région, par département, par secteur ou par
        acheteur. Chaque chiffre est établi à partir des opportunités réellement
        publiées (BOAMP, TED et besoins des entreprises inscrites), à la date
        indiquée, avec des liens vers les opportunités concernées.
      </p>
      <nav aria-label="Opportunités par région" className="mt-6">
        <h2 className="text-sm font-bold tracking-wide text-slate-500 uppercase">
          Explorer les opportunités par région
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          <li>
            <Link href="/opportunites" className="inline-block rounded-full bg-navy px-3 py-1 font-semibold text-white">
              France entière
            </Link>
          </li>
          {REGIONS.map((r) => (
            <li key={r.slug}>
              <Link href={`/opportunites/${r.slug}`} className="inline-block rounded-full bg-sky px-3 py-1 text-navy hover:bg-sky-200">
                {r.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {data && data.length > 0 ? (
        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {data.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/analyses/${a.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-teal hover:shadow-md"
              >
                <Image
                  src={`/visuels/analyses/${a.slug}`}
                  alt=""
                  width={1200}
                  height={630}
                  unoptimized
                  className="h-auto w-full border-b border-slate-100"
                />
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <BarChart3 className="size-5 text-teal-600" aria-hidden />
                    {a.published_at && formatDate(a.published_at)}
                  </div>
                  <h2 className="mt-3 text-xl font-bold group-hover:text-teal-700">
                    {a.title}
                  </h2>
                  <p className="mt-2 text-slate-600">{a.description}</p>
                  <span className="mt-auto pt-4 text-sm font-semibold text-teal-700">
                    Lire l&apos;analyse →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-10">
          <EmptyState
            title={page > 1 ? "Aucune analyse sur cette page" : "Première analyse en préparation"}
            description="Les analyses sont publiées au fil des données collectées."
          />
        </div>
      )}
      <Pagination page={page} pageCount={Math.ceil((count ?? 0) / PER_PAGE)} basePath="/analyses" params={sp} />
    </div>
  );
}
