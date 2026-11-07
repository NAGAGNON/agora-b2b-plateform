import Image from "next/image";
import Link from "next/link";
import { Compass, PlusCircle, Sparkles } from "lucide-react";
import { CompanyLogo } from "@/components/companies/company-logo";
import { familyPhoto, sectorFamilySlug } from "@/components/opportunities/sector-visual";
import { SECTOR_FAMILIES } from "@/lib/sector-families";

/** Salutation selon l'heure de Paris. */
function greeting(now: number) {
  const h = Number(new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Europe/Paris" }).format(now));
  return h >= 18 || h < 5 ? "Bonsoir" : "Bonjour";
}

/**
 * En-tête du tableau de bord : photo du métier de l'entreprise, logo, salutation et accès directs.
 * Les pastilles n'affichent que des chiffres réels du compte.
 */
export function DashboardHero({
  firstName,
  company,
  sector,
  now,
  chips,
}: {
  firstName: string;
  company: { name: string; logo_path: string | null };
  sector: string | null;
  now: number;
  chips: { label: string; href: string }[];
}) {
  const fam = sectorFamilySlug(sector);
  const family = SECTOR_FAMILIES.find((f) => f.slug === fam);
  const date = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(now);
  return (
    <section aria-labelledby="dash-title" className="relative isolate overflow-hidden rounded-3xl bg-navy-900 text-white shadow-[0_30px_70px_-35px_rgb(11_27_52/0.8)]">
      <div aria-hidden className="absolute inset-0 -z-10">
        <Image src={familyPhoto(fam)} alt="" fill priority unoptimized sizes="(min-width: 1024px) 70vw, 100vw" className="object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-900 via-navy-900/90 to-navy-900/30" />
        <div className="bg-tech-grid absolute inset-0 opacity-40" />
        <div className="absolute -top-24 left-1/3 size-80 animate-aurora rounded-full bg-teal/25 blur-3xl" />
        <div className="absolute -bottom-28 -left-10 size-72 animate-aurora rounded-full bg-violet/25 blur-3xl [animation-delay:-7s]" />
      </div>
      <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 items-start gap-4 sm:gap-5">
          <span className="animate-float shrink-0 rounded-[1.4rem] bg-white/10 p-1.5 ring-1 ring-white/20 backdrop-blur">
            <CompanyLogo name={company.name} path={company.logo_path} size={72} />
          </span>
          <div className="min-w-0">
            <p className="animate-rise text-sm font-medium text-teal-200 first-letter:uppercase">{date}</p>
            <h1 id="dash-title" className="mt-1 animate-rise text-2xl font-extrabold text-white [animation-delay:80ms] sm:text-3xl">
              {greeting(now)}
              {firstName ? ` ${firstName}` : ""}, <span className="text-gradient">prêt à décrocher</span> de nouveaux marchés ?
            </h1>
            <p className="mt-2 animate-rise text-sm text-white/70 [animation-delay:160ms]">
              {company.name}
              {family ? ` · ${family.label}` : ""}
            </p>
            {chips.length > 0 && (
              <ul className="mt-4 flex animate-rise flex-wrap gap-2 [animation-delay:240ms]">
                {chips.map((c) => (
                  <li key={c.label}>
                    <Link href={c.href} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/20">
                      <Sparkles className="size-3.5 text-teal-300" aria-hidden /> {c.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href="/opportunites" className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/10">
            <Compass className="size-4" aria-hidden /> Explorer
          </Link>
          <Link
            href="/publier"
            className="btn-shine inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-teal to-cyan-400 px-5 text-sm font-bold text-navy shadow-lg transition hover:-translate-y-px"
          >
            <PlusCircle className="size-4" aria-hidden /> Publier un besoin
          </Link>
        </div>
      </div>
    </section>
  );
}
