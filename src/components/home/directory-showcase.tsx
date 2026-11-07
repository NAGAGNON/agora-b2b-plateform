import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, Search } from "lucide-react";
import { familyPhoto } from "@/components/opportunities/sector-visual";
import { SECTOR_FAMILIES } from "@/lib/sector-families";

/**
 * Accueil : mise en avant de l'annuaire par grands domaines de métiers (photos), avec accès direct
 * aux entreprises de chaque domaine. Aucun chiffre ni nom d'entreprise affiché ici.
 */
export function DirectoryShowcase() {
  return (
    <section aria-labelledby="annuaire" className="relative isolate mt-12 overflow-hidden bg-navy-900 py-14 text-white sm:mt-16 sm:py-20">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-tech-grid absolute inset-0 opacity-50" />
        <div className="absolute -top-32 right-1/4 size-96 animate-aurora rounded-full bg-teal/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-10 size-96 animate-aurora rounded-full bg-violet/20 blur-3xl [animation-delay:-8s]" />
      </div>
      <div className="container-page">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-teal-200 ring-1 ring-white/15">
              <Building2 className="size-4" aria-hidden /> Annuaire des entreprises
            </p>
            <h2 id="annuaire" className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">
              Trouvez le bon <span className="text-gradient">prestataire</span>, domaine par domaine
            </h2>
            <p className="mt-3 text-base text-white/75 sm:text-lg">
              Fournisseurs, sous-traitants et prestataires présentés avec leurs métiers, leurs compétences et leur zone d&apos;intervention.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/entreprises"
              className="btn-shine group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal to-cyan-400 px-5 py-3 font-bold text-navy shadow-lg transition hover:-translate-y-px"
            >
              <Search className="size-4" aria-hidden /> Parcourir l&apos;annuaire
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link href="/inscription" className="inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/10">
              Référencer mon entreprise
            </Link>
          </div>
        </div>
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {SECTOR_FAMILIES.map((f, i) => (
            <li key={f.slug} className={i === 0 || i === SECTOR_FAMILIES.length - 1 ? "col-span-2" : ""}>
              <Link
                href={`/entreprises?domaine=${f.slug}`}
                className={`group relative flex h-full overflow-hidden rounded-3xl ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgb(20_194_173/0.7)] hover:ring-teal/50 min-h-40 sm:min-h-56`}
              >
                <Image src={familyPhoto(f.slug)} alt="" fill unoptimized sizes="(min-width: 1024px) 33vw, 50vw" className="object-cover transition duration-700 group-hover:scale-110" />
                <span className="absolute inset-0 bg-gradient-to-t from-navy-900/95 via-navy-900/45 to-navy-900/0" />
                <span className="relative mt-auto w-full p-4 sm:p-5">
                  <span className="block text-base leading-tight font-bold text-white sm:text-lg">{f.label}</span>
                  <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-teal-200 opacity-90 transition group-hover:opacity-100 sm:text-sm">
                    Voir les entreprises <ArrowRight className="size-3.5 transition group-hover:translate-x-1" aria-hidden />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 flex items-center gap-2 text-sm text-white/60">
          <BadgeCheck className="size-4 text-teal-300" aria-hidden /> Seules les entreprises ayant choisi d&apos;apparaître dans l&apos;annuaire sont affichées.
        </p>
      </div>
    </section>
  );
}
