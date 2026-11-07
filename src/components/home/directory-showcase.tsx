import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, MapPin, Search } from "lucide-react";
import { CompanyLogo } from "@/components/companies/company-logo";
import { LogoMarquee } from "@/components/home/member-proof";
import { familyPhoto, sectorFamilySlug } from "@/components/opportunities/sector-visual";
import { directoryFamilyCounts, searchCompanies } from "@/lib/queries/companies";
import { getSectorLabels } from "@/lib/queries/platform";
import { sectorLabel } from "@/lib/constants";
import { SECTOR_FAMILIES } from "@/lib/sector-families";

/**
 * Accueil : vitrine de l'annuaire. Grands domaines de métiers en photo (avec le nombre réel
 * d'entreprises quand il y en a) et une sélection d'entreprises de l'annuaire public, présentées
 * avec leur photo de domaine, leur logo et leur ville. Uniquement des entreprises ayant choisi
 * d'apparaître dans l'annuaire ; rien n'est affiché si la lecture échoue.
 */
export async function DirectoryShowcase() {
  const [{ rows }, counts, labels] = await Promise.all([
    searchCompanies({ skills: [], page: 1 }, 16).catch(() => ({ rows: [] as Awaited<ReturnType<typeof searchCompanies>>["rows"] })),
    directoryFamilyCounts().catch(() => new Map<string, number>()),
    getSectorLabels(),
  ]);
  // Entreprises ayant mis leur logo : bandeau défilant (leur choix d'apparaître dans l'annuaire)
  const withLogo = rows.filter((c) => c.logo_path).map((c) => ({ name: c.name, slug: c.slug, logo_path: c.logo_path, city: c.city, region: null }));
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

        {withLogo.length >= 2 && (
          <div className="mt-10">
            <p className="mb-4 text-sm font-semibold text-white/70">Elles sont dans l&apos;annuaire</p>
            <LogoMarquee companies={withLogo} />
          </div>
        )}

        <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {SECTOR_FAMILIES.map((f, i) => {
            const n = counts.get(f.slug) ?? 0;
            return (
              <li key={f.slug} className={i === 0 || i === SECTOR_FAMILIES.length - 1 ? "col-span-2" : ""}>
                <Link
                  href={`/entreprises?domaine=${f.slug}`}
                  className="group relative flex h-full min-h-36 overflow-hidden rounded-3xl ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgb(20_194_173/0.7)] hover:ring-teal/50 sm:min-h-44"
                >
                  <Image src={familyPhoto(f.slug)} alt="" fill unoptimized sizes="(min-width: 1024px) 33vw, 50vw" className="object-cover transition duration-700 group-hover:scale-110" />
                  <span className="absolute inset-0 bg-gradient-to-t from-navy-900/95 via-navy-900/45 to-navy-900/0" />
                  {n > 0 && (
                    <span className="absolute top-3 right-3 rounded-full bg-navy-900/60 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur">
                      {n} entreprise{n > 1 ? "s" : ""}
                    </span>
                  )}
                  <span className="relative mt-auto w-full p-4 sm:p-5">
                    <span className="block text-base leading-tight font-bold text-white sm:text-lg">{f.label}</span>
                    <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-teal-200 opacity-90 transition group-hover:opacity-100 sm:text-sm">
                      Voir les entreprises <ArrowRight className="size-3.5 transition group-hover:translate-x-1" aria-hidden />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {rows.length > 0 && (
          <div className="mt-14">
            <div className="flex items-end justify-between gap-4">
              <h3 className="text-xl font-bold text-white sm:text-2xl">Entreprises à découvrir</h3>
              <Link href="/entreprises" className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-teal-200 hover:text-white">
                Tout l&apos;annuaire <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <ul className="-mx-4 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
              {rows.slice(0, 8).map((c, i) => {
                const fam = sectorFamilySlug(c.sectors?.[0]);
                return (
                  <li key={c.id} className={`w-72 shrink-0 snap-start sm:w-auto ${i >= 4 ? "hidden lg:block" : ""}`}>
                    <Link
                      href={`/entreprises/${c.slug}`}
                      className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white/[0.06] ring-1 ring-white/10 backdrop-blur transition duration-300 hover:-translate-y-1 hover:bg-white/10 hover:ring-teal/40"
                    >
                      <span aria-hidden className="relative block h-24 overflow-hidden">
                        <Image src={familyPhoto(fam)} alt="" fill unoptimized sizes="(min-width: 1024px) 25vw, 300px" className="object-cover opacity-80 transition duration-700 group-hover:scale-110 group-hover:opacity-100" />
                        <span className="absolute inset-0 bg-gradient-to-t from-navy-900 to-navy-900/10" />
                      </span>
                      <span className="relative flex flex-1 flex-col px-5 pb-5">
                        <span className="-mt-8 mb-3 block w-fit rounded-2xl bg-white p-1 shadow-lg ring-1 ring-white/20">
                          <CompanyLogo name={c.name} path={c.logo_path} size={52} sector={c.sectors?.[0]} />
                        </span>
                        <span className="flex items-center gap-1.5 font-bold text-white group-hover:text-teal-200">
                          <span className="line-clamp-1">{c.name}</span>
                          {c.verified && <BadgeCheck className="size-4 shrink-0 text-teal-300" aria-label="Entreprise vérifiée" />}
                        </span>
                        {c.sectors?.[0] && <span className="mt-1 line-clamp-1 text-sm text-teal-200/90">{sectorLabel(c.sectors[0], labels)}</span>}
                        {c.tagline && <span className="mt-2 line-clamp-2 text-sm text-white/65">{c.tagline}</span>}
                        {c.city && (
                          <span className="mt-auto flex items-center gap-1.5 pt-4 text-xs text-white/60">
                            <MapPin className="size-3.5 text-teal-300" aria-hidden /> {c.city}
                            {c.department_code ? ` (${c.department_code})` : ""}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <p className="mt-6 flex items-center gap-2 text-sm text-white/60">
          <BadgeCheck className="size-4 text-teal-300" aria-hidden /> Seules les entreprises ayant choisi d&apos;apparaître dans l&apos;annuaire sont affichées.
        </p>
      </div>
    </section>
  );
}
