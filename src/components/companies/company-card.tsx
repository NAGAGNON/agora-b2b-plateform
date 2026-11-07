import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, MapPin, Users } from "lucide-react";
import { DemoBadge } from "@/components/demo";
import { COMPANY_KIND_LABELS, COMPANY_SIZE_LABELS, sectorLabel, type CompanyKind, type CompanySize } from "@/lib/constants";
import { getSectorLabels } from "@/lib/queries/platform";
import { CompanyLogo } from "@/components/companies/company-logo";
import { familyPhoto, sectorFamilySlug } from "@/components/opportunities/sector-visual";
import { SECTOR_FAMILIES } from "@/lib/sector-families";

export { CompanyLogo };

export type CompanyCardData = {
  slug: string;
  name: string;
  kind: CompanyKind;
  size?: CompanySize | null;
  city: string | null;
  department_code: string | null;
  logo_path: string | null;
  tagline: string | null;
  sectors: string[];
  skills: string[];
  verified: boolean;
  is_demo: boolean;
};

/** « PME (10 à 249 salariés) » devient « PME » : la carte reste lisible. */
function shortSize(size: CompanySize | null | undefined) {
  return size ? COMPANY_SIZE_LABELS[size].replace(/\s*\(.*\)$/, "") : null;
}

/**
 * Carte d'une entreprise de l'annuaire : photo de son domaine d'activité, logo bien visible,
 * secteurs, compétences et localisation. Uniquement les informations déclarées par l'entreprise.
 */
export async function CompanyCard({ c }: { c: CompanyCardData }) {
  const labels = await getSectorLabels();
  const familySlug = sectorFamilySlug(c.sectors[0]);
  const family = SECTOR_FAMILIES.find((f) => f.slug === familySlug);
  const size = shortSize(c.size);
  const skills = c.skills.slice(0, 4);
  const moreSkills = c.skills.length - skills.length;
  return (
    <article className="group reveal relative flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-24px_rgb(11_27_52/0.35)] hover:ring-teal/40">
      <div aria-hidden className="relative h-32 overflow-hidden bg-navy">
        <Image
          src={familyPhoto(familySlug)}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 45vw, 100vw"
          className="object-cover transition duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/30 to-navy/10" />
        <span className="absolute top-3 left-3 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white uppercase ring-1 ring-white/25 backdrop-blur">
          {family?.label ?? "Entreprise"}
        </span>
        {c.verified && (
          <span role="img" aria-label="Entreprise vérifiée" className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-teal px-2.5 py-1 text-[11px] font-bold text-navy shadow">
            <BadgeCheck className="size-3.5" aria-hidden /> <span>Vérifiée</span>
          </span>
        )}
      </div>
      <div className="relative flex flex-1 flex-col px-5 pb-5">
        <div className="-mt-9 mb-3 w-fit rounded-2xl bg-white p-1.5 shadow-lg ring-1 ring-slate-200 transition duration-300 group-hover:-translate-y-0.5">
          <CompanyLogo name={c.name} path={c.logo_path} size={60} />
        </div>
        <h3 className="flex items-center gap-1.5 text-lg leading-snug font-bold text-navy">
          <Link href={`/entreprises/${c.slug}`} className="after:absolute after:inset-0 group-hover:text-teal-700">
            {c.name}
          </Link>
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Building2 className="size-3.5" aria-hidden />
            {COMPANY_KIND_LABELS[c.kind]}
          </span>
          {size && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" aria-hidden />
              {size}
            </span>
          )}
        </p>
        {c.tagline && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-700">{c.tagline}</p>}
        {(c.sectors.length > 0 || c.is_demo) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {c.is_demo && <DemoBadge />}
            {c.sectors.slice(0, 2).map((s) => (
              <span key={s} className="rounded-full bg-gradient-to-r from-teal-50 to-sky px-2.5 py-0.5 text-xs font-semibold text-teal-800 ring-1 ring-teal/25">
                {sectorLabel(s, labels)}
              </span>
            ))}
          </div>
        )}
        {skills.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Compétences">
            {skills.map((s) => (
              <li key={s} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {s}
              </li>
            ))}
            {moreSkills > 0 && <li className="rounded-md px-1 py-0.5 text-xs font-semibold text-slate-500">+{moreSkills}</li>}
          </ul>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm">
          <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
            {c.city ? (
              <>
                <MapPin className="size-4 shrink-0 text-teal-600" aria-hidden />
                <span className="truncate">
                  {c.city}
                  {c.department_code ? ` (${c.department_code})` : ""}
                </span>
              </>
            ) : (
              <span className="text-slate-400">France</span>
            )}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-teal-700">
            Voir la fiche <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden />
          </span>
        </div>
      </div>
    </article>
  );
}
