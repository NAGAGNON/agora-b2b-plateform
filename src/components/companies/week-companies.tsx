import { CompanyLogo } from "@/components/companies/company-logo";
import type { WeekCompanies } from "@/lib/queries/platform";

/** En dessous de ce nombre de logos, le bandeau ne s'affiche pas (jamais une vitrine pauvre). */
export const WEEK_MIN_LOGOS = 5;

/**
 * Page de création d'entreprise : « N entreprises inscrites cette semaine », et les logos de celles qui en
 * ont un, qui défilent. Données réelles de l'annuaire public ; rien ne s'affiche s'il y a trop peu de logos.
 */
export function WeekCompaniesTicker({ data }: { data: WeekCompanies | null }) {
  if (!data || data.logos.length < WEEK_MIN_LOGOS) return null;
  const row = (dup: boolean) => (
    <ul className="flex shrink-0 items-center gap-3 pr-3" aria-hidden={dup || undefined}>
      {data.logos.map((c) => (
        <li key={`${dup ? "b" : "a"}-${c.slug}`} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200">
          <CompanyLogo name={c.name} path={c.logo_path} size={32} />
          <span className="max-w-40 truncate text-sm font-semibold text-navy">{c.name}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label="Entreprises inscrites cette semaine" className="animate-rise" data-testid="week-companies">
      <p className="mb-3 text-center text-sm text-slate-600">
        <span className="font-heading text-base font-bold text-navy">{data.total} entreprises</span> se sont inscrites cette semaine
      </p>
      <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)] motion-reduce:overflow-x-auto">
        <div className="flex w-max animate-ticker hover:[animation-play-state:paused] motion-reduce:animate-none">
          {row(false)}
          {row(true)}
        </div>
      </div>
    </section>
  );
}
