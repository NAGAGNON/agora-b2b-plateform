import Image from "next/image";
import Link from "next/link";
import { Building, Factory, Search, Wrench, X } from "lucide-react";
import { CompanyCard } from "@/components/companies/company-card";
import { MobileFilters } from "@/components/opportunities/mobile-filters";
import { SearchActions } from "@/components/opportunities/save-search";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { ActiveFilters, Chip, ChipGroup, FilterHeader, FilterInput, FilterSection, FilterSelect, FilterSubmit, SubLabel, withoutParam } from "@/components/ui/filters";
import { directoryFamilyCounts, searchCompanies } from "@/lib/queries/companies";
import { familyPhoto } from "@/components/opportunities/sector-visual";
import { groupSectors, SECTOR_FAMILIES } from "@/lib/sector-families";
import { getDepartments, getSectors } from "@/lib/queries/platform";
import { getSession } from "@/lib/auth";
import { COMPANY_KIND_LABELS, COMPANY_SIZE_LABELS, PAGE_SIZE, sectorLabel, type SectorOption, type CompanyKind, type CompanySize } from "@/lib/constants";
import type { CompanyFilters, RawSearchParams } from "@/lib/search-params";

/** « PME (10 à 249 salariés) » devient « PME » dans les pastilles. */
const short = (l: string) => l.replace(/\s*\(.*\)$/, "");

function Fields({ f, departments, sectors, p }: { f: CompanyFilters; departments: { code: string; name: string }[]; sectors: SectorOption[]; p: string }) {
  return (
    <div>
      {f.family && !f.sector && <input type="hidden" name="domaine" value={f.family} />}
      <FilterSection title="Recherche" icon={<Search className="size-4" />} active={Boolean(f.q)}>
        <label htmlFor={`${p}-q`} className="sr-only">
          Nom ou activité
        </label>
        <FilterInput id={`${p}-q`} name="q" defaultValue={f.q} placeholder="ex. usinage, Brest…" icon={<Search />} />
      </FilterSection>
      <FilterSection title="Secteur et lieu" icon={<Factory className="size-4" />} active={Boolean(f.sector || f.department)}>
        <div>
          <SubLabel htmlFor={`${p}-secteur`}>Secteur</SubLabel>
          <FilterSelect id={`${p}-secteur`} name="secteur" defaultValue={f.sector ?? ""}>
            <option value="">Tous les secteurs</option>
            {groupSectors(sectors).map(({ family, sectors }) => (
              <optgroup key={family.slug} label={family.label}>
                {sectors.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </FilterSelect>
        </div>
        <div>
          <SubLabel htmlFor={`${p}-dep`}>Département</SubLabel>
          <FilterSelect id={`${p}-dep`} name="departement" defaultValue={f.department ?? ""}>
            <option value="">Toute la France</option>
            {departments.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name} ({d.code})
              </option>
            ))}
          </FilterSelect>
        </div>
      </FilterSection>
      <FilterSection title="Profil de l'entreprise" icon={<Building className="size-4" />} active={Boolean(f.kind || f.size)}>
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-500">Type d&apos;entreprise</p>
          <ChipGroup label="Type d'entreprise">
            <Chip name="type" value="" checked={!f.kind}>
              Tous
            </Chip>
            {(Object.keys(COMPANY_KIND_LABELS) as CompanyKind[]).map((k) => (
              <Chip key={k} name="type" value={k} checked={f.kind === k}>
                {COMPANY_KIND_LABELS[k]}
              </Chip>
            ))}
          </ChipGroup>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-500">Taille</p>
          <ChipGroup label="Taille">
            <Chip name="taille" value="" checked={!f.size}>
              Toutes
            </Chip>
            {(Object.keys(COMPANY_SIZE_LABELS) as CompanySize[]).map((k) => (
              <Chip key={k} name="taille" value={k} checked={f.size === k}>
                {short(COMPANY_SIZE_LABELS[k])}
              </Chip>
            ))}
          </ChipGroup>
        </div>
      </FilterSection>
      <FilterSection title="Compétences" icon={<Wrench className="size-4" />} active={f.skills.length > 0}>
        <label htmlFor={`${p}-comp`} className="sr-only">
          Compétences
        </label>
        <FilterInput id={`${p}-comp`} name="competences" defaultValue={f.skills.join(", ")} placeholder="ex. soudure, hydraulique" icon={<Wrench />} />
      </FilterSection>
    </div>
  );
}

/** Tuiles « Explorer par domaine » : photo du métier et nombre réel d'entreprises inscrites. */
function FamilyTiles({ active, counts, basePath, rawParams }: { active?: string; counts: Map<string, number>; basePath: string; rawParams: RawSearchParams }) {
  const href = (slug?: string) => {
    const q = new URLSearchParams(Object.entries(rawParams).flatMap(([k, v]) => (typeof v === "string" && !["page", "secteur", "domaine"].includes(k) ? [[k, v]] : [])));
    if (slug) q.set("domaine", slug);
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <nav aria-label="Explorer par domaine" className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-lg font-bold text-navy">Explorer par domaine</h2>
        {active && (
          <Link href={href()} className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:underline">
            <X className="size-4" aria-hidden /> Tous les domaines
          </Link>
        )}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {SECTOR_FAMILIES.map((f) => {
          const n = counts.get(f.slug) ?? 0;
          const on = active === f.slug;
          return (
            <li key={f.slug}>
              <Link
                href={on ? href() : href(f.slug)}
                aria-current={on ? "true" : undefined}
                className={`group relative flex h-28 overflow-hidden rounded-2xl ring-2 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg ${on ? "ring-teal shadow-lg" : "ring-transparent"}`}
              >
                <Image src={familyPhoto(f.slug)} alt="" fill unoptimized sizes="(min-width: 1280px) 16vw, (min-width: 640px) 33vw, 50vw" className="object-cover transition duration-700 group-hover:scale-110" />
                <span className={`absolute inset-0 bg-gradient-to-t transition ${on ? "from-teal-900/90 via-navy/50 to-navy/10" : "from-navy/90 via-navy/45 to-navy/5 group-hover:from-navy/80"}`} />
                <span className="relative mt-auto p-3 text-white">
                  <span className="block text-sm leading-tight font-bold">{f.label}</span>
                  {n > 0 && (
                    <span className="mt-0.5 block text-xs text-white/80">
                      {n} entreprise{n > 1 ? "s" : ""}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export async function Directory({ filters, rawParams, basePath }: { filters: CompanyFilters; rawParams: RawSearchParams; basePath: string }) {
  const [{ rows, total, error }, departments, sectors, session, counts] = await Promise.all([
    searchCompanies(filters),
    getDepartments(),
    getSectors(),
    getSession(),
    directoryFamilyCounts(),
  ]);
  const activeFamily = !filters.sector ? SECTOR_FAMILIES.find((f) => f.slug === filters.family) : undefined;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const count = [filters.sector ?? activeFamily?.slug, filters.department, filters.kind, filters.size].filter(Boolean).length + (filters.skills.length ? 1 : 0);
  const query = new URLSearchParams(Object.entries(rawParams).flatMap(([k, v]) => (typeof v === "string" && k !== "page" ? [[k, v]] : [])));
  const has = (k: string) => typeof rawParams[k] === "string" && rawParams[k] !== "";
  const off = (k: string) => withoutParam(basePath, rawParams, k);
  const labels = Object.fromEntries(sectors.map((s) => [s.slug, s.label]));
  const active = [
    ...(has("q") && filters.q ? [{ key: "q", label: `« ${filters.q} »`, href: off("q") }] : []),
    ...(activeFamily ? [{ key: "domaine", label: activeFamily.label, href: off("domaine") }] : []),
    ...(has("secteur") && filters.sector ? [{ key: "secteur", label: sectorLabel(filters.sector, labels), href: off("secteur") }] : []),
    ...(filters.department ? [{ key: "departement", label: `${departments.find((d) => d.code === filters.department)?.name ?? "Département"} (${filters.department})`, href: off("departement") }] : []),
    ...(filters.kind ? [{ key: "type", label: COMPANY_KIND_LABELS[filters.kind], href: off("type") }] : []),
    ...(filters.size ? [{ key: "taille", label: short(COMPANY_SIZE_LABELS[filters.size]), href: off("taille") }] : []),
    ...(filters.skills.length ? [{ key: "competences", label: filters.skills.join(", "), href: off("competences") }] : []),
  ];
  return (
    <>
    <FamilyTiles active={activeFamily?.slug} counts={counts} basePath={basePath} rawParams={rawParams} />
    <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
      <aside className="hidden lg:block" aria-label="Filtres">
        <form action={basePath} method="get" className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain rounded-3xl border border-slate-200 bg-white p-5 shadow-sm [scrollbar-width:thin]">
          <FilterHeader count={count} resetHref={basePath} />
          <Fields f={filters} departments={departments} sectors={sectors} p="d" />
          <FilterSubmit />
        </form>
      </aside>
      <div className="min-w-0">
        <MobileFilters count={count} action={basePath} title="Filtrer les entreprises">
          <Fields f={filters} departments={departments} sectors={sectors} p="m" />
        </MobileFilters>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 lg:mt-0">
          <p className="text-sm text-slate-600" aria-live="polite">
            <strong className="text-navy">{total}</strong> entreprise{total > 1 ? "s" : ""}
            {activeFamily && (
              <>
                {" "}
                · <span className="font-semibold text-teal-700">{activeFamily.label}</span>
              </>
            )}
          </p>
          <SearchActions query={query.toString()} signedIn={Boolean(session)} alertHref="/dashboard/alertes" scope="COMPANIES" />
        </div>
        {active.length > 0 && (
          <div className="mt-3">
            <ActiveFilters items={active} resetHref={basePath} />
          </div>
        )}
        <div className="mt-6">
          {error ? (
            <ErrorState description="La recherche n'a pas pu aboutir." />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Building className="size-6" aria-hidden />}
              title="Aucune entreprise ne correspond"
              description="L'annuaire s'enrichit au fil des inscriptions. Vous ne trouvez pas de prestataire ? Publiez votre besoin : les fournisseurs concernés seront alertés."
              action={<ButtonLink href="/publier">Publier un besoin</ButtonLink>}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((c) => (
                <CompanyCard key={c.id} c={c} />
              ))}
            </div>
          )}
          <Pagination page={filters.page} pageCount={pageCount} basePath={basePath} params={rawParams} />
        </div>
      </div>
    </div>
    </>
  );
}
