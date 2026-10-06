import { Directory } from "@/components/companies/directory";
import { parseCompanyFilters } from "@/lib/search-params";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(props: PageProps<"/entreprises">) {
  const sp = await props.searchParams;
  return pageMetadata({
    title: "Annuaire des entreprises",
    description: "Trouvez des fournisseurs et prestataires B2B en Bretagne : maintenance industrielle, sous-traitance, informatique, cybersécurité, logistique.",
    path: "/entreprises",
    noindex: Object.keys(sp).length > 0,
  });
}

export default async function DirectoryPage(props: PageProps<"/entreprises">) {
  const sp = await props.searchParams;
  return (
    <div className="container-page py-8 sm:py-10">
      <h1 className="text-2xl font-bold sm:text-3xl">Annuaire des entreprises</h1>
      <p className="mt-1 mb-6 max-w-3xl text-slate-600">
        Seules les entreprises ayant choisi d&apos;apparaître dans l&apos;annuaire sont affichées. Les informations sont déclarées par les entreprises
        elles-mêmes ; le badge « vérifiée » indique un contrôle effectué par LinkProB2B.
      </p>
      <Directory filters={parseCompanyFilters(sp)} rawParams={sp} basePath="/entreprises" />
    </div>
  );
}
