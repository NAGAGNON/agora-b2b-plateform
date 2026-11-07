import { requireAccount } from "@/lib/members-only";
import { Directory } from "@/components/companies/directory";
import { parseCompanyFilters } from "@/lib/search-params";
import { listingIndexing, pageMetadata } from "@/lib/seo";
import { ButtonLink } from "@/components/ui/button";
import Image from "next/image";
import { Building2, Search, ShieldCheck } from "lucide-react";
import { familyPhoto } from "@/components/opportunities/sector-visual";
import { SECTOR_FAMILIES } from "@/lib/sector-families";

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
      <section className="relative isolate overflow-hidden bg-navy-900 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-y-0 right-0 hidden w-1/2 grid-cols-3 gap-3 p-3 opacity-60 lg:grid">
            {SECTOR_FAMILIES.map((f, i) => (
              <div key={f.slug} className={`relative overflow-hidden rounded-2xl ${i % 2 ? "translate-y-8" : ""}`}>
                <Image src={familyPhoto(f.slug)} alt="" fill unoptimized priority={i < 3} sizes="17vw" className="object-cover" />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-navy-900 from-35% via-navy-900/85 to-navy-900/20" />
          <div className="bg-tech-grid absolute inset-0 opacity-40" />
          <div className="absolute -top-32 left-1/4 size-96 animate-aurora rounded-full bg-teal/20 blur-3xl" />
          <div className="absolute -bottom-40 right-1/4 size-96 animate-aurora rounded-full bg-violet/20 blur-3xl [animation-delay:-8s]" />
        </div>
        <div className="container-page py-12 sm:py-16 lg:py-20">
          <p className="inline-flex animate-rise items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-teal-200 ring-1 ring-white/15">
            <Building2 className="size-4" aria-hidden /> Fournisseurs et prestataires
          </p>
          <h1 className="mt-4 max-w-3xl animate-rise text-4xl font-extrabold text-white [animation-delay:80ms] sm:text-5xl">
            L&apos;annuaire des <span className="text-gradient">entreprises B2B</span>
          </h1>
          <p className="mt-4 max-w-2xl animate-rise text-base text-white/75 [animation-delay:160ms] sm:text-lg">
            Trouvez le fournisseur, le sous-traitant ou le prestataire qu&apos;il vous faut : métier, compétences, taille et zone d&apos;intervention.
          </p>
          <form action="/entreprises" method="get" role="search" className="mt-8 flex max-w-2xl animate-rise flex-col gap-2 rounded-2xl bg-white p-2 shadow-2xl [animation-delay:240ms] sm:flex-row">
            <label htmlFor="hero-q" className="sr-only">
              Nom, métier ou compétence
            </label>
            <div className="flex flex-1 items-center gap-2 px-3">
              <Search className="size-5 shrink-0 text-slate-400" aria-hidden />
              <input id="hero-q" name="q" defaultValue={typeof sp.q === "string" ? sp.q : ""} placeholder="Usinage, maintenance, cybersécurité, Brest…" className="h-12 w-full bg-transparent text-navy placeholder:text-slate-400 focus:outline-none" />
            </div>
            <button type="submit" className="h-12 rounded-xl bg-gradient-to-r from-teal to-cyan-400 px-6 font-bold text-navy transition hover:brightness-105">
              Rechercher
            </button>
          </form>
          <p className="mt-5 flex max-w-2xl animate-rise items-start gap-2 text-sm text-white/60 [animation-delay:320ms]">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-300" aria-hidden />
            Seules les entreprises ayant choisi d&apos;apparaître dans l&apos;annuaire sont affichées. Les informations sont déclarées par les entreprises
            elles-mêmes ; le badge « Vérifiée » indique un contrôle effectué par LinkProB2B.
          </p>
        </div>
      </section>
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
