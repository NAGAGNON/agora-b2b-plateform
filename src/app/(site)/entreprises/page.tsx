import { Directory } from "@/components/companies/directory";
import { parseCompanyFilters } from "@/lib/search-params";
import { pageMetadata } from "@/lib/seo";
import { ButtonLink } from "@/components/ui/button";

export async function generateMetadata(props: PageProps<"/entreprises">) {
  const sp = await props.searchParams;
  return pageMetadata({
    title: "Annuaire des entreprises B2B : fournisseurs et prestataires",
    description: "Trouvez des fournisseurs et prestataires B2B partout en France : industrie, sous-traitance, informatique, cybersécurité, BTP, logistique.",
    path: "/entreprises",
    noindex: Object.keys(sp).length > 0,
  });
}

export default async function DirectoryPage(props: PageProps<"/entreprises">) {
  const sp = await props.searchParams;
  return (
    <div className="container-page py-8 sm:py-10">
      <h1 className="text-2xl font-bold sm:text-3xl">Annuaire des entreprises</h1>
      <p className="mt-1 max-w-3xl text-slate-600">
        Trouvez des entreprises, fournisseurs et prestataires correspondant à vos besoins : secteur, localisation, compétences et services.
      </p>
      <p className="mt-1 max-w-3xl text-sm text-slate-500">
        Seules les entreprises ayant choisi d&apos;apparaître dans l&apos;annuaire sont affichées. Les informations sont déclarées par les entreprises
        elles-mêmes ; le badge « vérifiée » indique un contrôle effectué par LinkProB2B.
      </p>
      <div className="mt-4 mb-6 flex flex-col gap-3 rounded-2xl border border-teal/40 bg-teal-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-navy">
          <strong>Vous êtes fournisseur ou prestataire ?</strong> Référencez gratuitement votre entreprise pour être trouvé par les acheteurs et recevoir
          les opportunités de votre secteur.
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ButtonLink href="/inscription" size="sm">
            Créer mon profil
          </ButtonLink>
          <ButtonLink href="/publier" size="sm" variant="outline">
            Publier un besoin
          </ButtonLink>
        </div>
      </div>
      <Directory filters={parseCompanyFilters(sp)} rawParams={sp} basePath="/entreprises" />
    </div>
  );
}
