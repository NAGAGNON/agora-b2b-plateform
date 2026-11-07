import { requireAccount } from "@/lib/members-only";
import { Directory } from "@/components/companies/directory";
import { parseCompanyFilters } from "@/lib/search-params";
import { listingIndexing, pageMetadata } from "@/lib/seo";
import { ButtonLink } from "@/components/ui/button";
import { PageHero } from "@/components/layout/page-hero";

export async function generateMetadata(props: PageProps<"/entreprises">) {
  const sp = await props.searchParams;
  const listing = listingIndexing("/entreprises", sp);
  return pageMetadata({
    title: "Annuaire des entreprises B2B : fournisseurs et prestataires",
    description: "Trouvez des fournisseurs et prestataires B2B partout en France : industrie, sous-traitance, informatique, cybersécurité, BTP, logistique.",
    path: listing.path,
    noindex: listing.filtered,
  });
}

export default async function DirectoryPage(props: PageProps<"/entreprises">) {
  const sp = await props.searchParams;
  // Recherche réservée aux membres : sans compte, inscription puis retour ici
  await requireAccount("/entreprises", sp);
  return (
    <>
      <PageHero
        eyebrow="Fournisseurs et prestataires"
        image="/images/illustrations/poignee-de-main.webp"
        title="Annuaire des entreprises"
        intro="Trouvez des entreprises, fournisseurs et prestataires correspondant à vos besoins : secteur, localisation, compétences et services."
      >
        <p className="max-w-3xl text-sm text-slate-600">
          Seules les entreprises ayant choisi d&apos;apparaître dans l&apos;annuaire sont affichées. Les informations sont déclarées par les entreprises
          elles-mêmes ; le badge « vérifiée » indique un contrôle effectué par LinkProB2B.
        </p>
      </PageHero>
      <div className="container-page py-8 sm:py-10">
      <Directory filters={parseCompanyFilters(sp)} rawParams={sp} basePath="/entreprises" />
      <section aria-label="Référencer votre entreprise" className="relative mt-12 overflow-hidden rounded-3xl bg-navy p-6 text-white shadow-xl sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -top-20 -right-10 size-64 animate-aurora rounded-full bg-teal/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 left-10 size-64 animate-aurora rounded-full bg-violet/25 blur-3xl [animation-delay:-7s]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xl font-bold">Vous êtes fournisseur ou prestataire ?</p>
            <p className="mt-1 max-w-2xl text-sm text-white/75">
              Référencez gratuitement votre entreprise : les acheteurs vous trouvent ici, et vous recevez les opportunités de votre secteur.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <ButtonLink href="/inscription">Créer mon profil</ButtonLink>
            <ButtonLink href="/publier" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10">
              Publier un besoin
            </ButtonLink>
          </div>
        </div>
      </section>
      </div>
    </>
  );
}
