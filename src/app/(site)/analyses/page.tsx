import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { pageMetadata } from "@/lib/seo";
import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/ui/states";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Analyses des marchés en Bretagne",
  description: "Analyses mensuelles des marchés publics et des besoins d'entreprises en Bretagne, par secteur et par département, à partir des données BOAMP et TED.",
  path: "/analyses",
});

export default async function AnalysesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("articles")
    .select("slug, title, description, published_at")
    .eq("status", "PUBLISHED")
    .order("published_at", { ascending: false })
    .limit(100);
  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="text-3xl font-bold sm:text-4xl">Analyses des marchés</h1>
      <p className="mt-3 max-w-2xl text-lg text-slate-600">
        Chaque analyse est établie à partir des opportunités réellement publiées (BOAMP, TED et besoins des entreprises inscrites), à la date indiquée.
      </p>
      {data && data.length > 0 ? (
        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {data.map((a) => (
            <li key={a.slug}>
              <Link href={`/analyses/${a.slug}`} className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-teal hover:shadow-md">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <BarChart3 className="size-5 text-teal-600" aria-hidden />
                  {a.published_at && formatDate(a.published_at)}
                </div>
                <h2 className="mt-3 text-xl font-bold group-hover:text-teal-700">{a.title}</h2>
                <p className="mt-2 text-slate-600">{a.description}</p>
                <span className="mt-auto pt-4 text-sm font-semibold text-teal-700">Lire l&apos;analyse →</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-10">
          <EmptyState title="Première analyse en préparation" description="Les analyses sont publiées au fil des données collectées." />
        </div>
      )}
    </div>
  );
}
