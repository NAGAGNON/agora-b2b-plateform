import Image from "next/image";
import Link from "next/link";
import { Building, X } from "lucide-react";
import { CompanyCard } from "@/components/companies/company-card";
import { MobileFilters } from "@/components/opportunities/mobile-filters";
import { SearchActions } from "@/components/opportunities/save-search";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { Label } from "@/components/ui/form";
import { directoryFamilyCounts, searchCompanies } from "@/lib/queries/companies";
import { familyPhoto } from "@/components/opportunities/sector-visual";
import { SECTOR_FAMILIES } from "@/lib/sector-families";
import { getDepartments, getSectors } from "@/lib/queries/platform";
import { getSession } from "@/lib/auth";
import { COMPANY_KIND_LABELS, COMPANY_SIZE_LABELS, PAGE_SIZE, type SectorOption, type CompanyKind, type CompanySize } from "@/lib/constants";
import type { CompanyFilters, RawSearchParams } from "@/lib/search-params";

const sel = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-navy focus:border-teal focus:ring-2 focus:ring-teal/30 focus:outline-none";

function Fields({ f, departments, sectors, p }: { f: CompanyFilters; departments: { code: string; name: string }[]; sectors: SectorOption[]; p: string }) {
  return (
    <div className="space-y-5">
      {f.family && !f.sector && <input type="hidden" name="domaine" value={f.family} />}
      <div>
        <Label htmlFor={`${p}-q`}>Nom ou activité</Label>
        <input id={`${p}-q`} name="q" defaultValue={f.q} className={sel} placeholder="ex. usinage, Brest…" />
      </div>
      <div>
        <Label htmlFor={`${p}-secteur`}>Secteur</Label>
        <select id={`${p}-secteur`} name="secteur" defaultValue={f.sector ?? ""} className={sel}>
          <option value="">Tous les secteurs</option>
          {sectors.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={`${p}-dep`}>Département</Label>
        <select id={`${p}-dep`} name="departement" defaultValue={f.department ?? ""} className={sel}>
          <option value="">Toute la France</option>
          {departments.map((d) => (
            <option key={d.code} value={d.code}>
              {d.name} ({d.code})
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={`${p}-type`}>Type d&apos;entreprise</Label>
        <select id={`${p}-type`} name="type" defaultValue={f.kind ?? ""} className={sel}>
          <option value="">Tous</option>
          {(Object.keys(COMPANY_KIND_LABELS) as CompanyKind[]).map((k) => (
            <option key={k} value={k}>
              {COMPANY_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={`${p}-taille`}>Taille</Label>
        <select id={`${p}-taille`} name="taille" defaultValue={f.size ?? ""} className={sel}>
          <option value="">Toutes tailles</option>
          {(Object.keys(COMPANY_SIZE_LABELS) as CompanySize[]).map((k) => (
            <option key={k} value={k}>
              {COMPANY_SIZE_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={`${p}-comp`}>Compétences</Label>
        <input id={`${p}-comp`} name="competences" defaultValue={f.skills.join(", ")} className={sel} placeholder="ex. soudure, hydraulique" />
      </div>
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
  return (
    <>
    <FamilyTiles active={activeFamily?.slug} counts={counts} basePath={basePath} rawParams={rawParams} />
    <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
      <aside className="hidden lg:block" aria-label="Filtres">
        <form action={basePath} method="get" className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Fields f={filters} departments={departments} sectors={sectors} p="d" />
          <div className="mt-6 flex gap-2">
            <a href={basePath} className="flex h-11 flex-1 items-center justify-center rounded-lg border border-slate-300 text-sm font-semibold text-navy hover:bg-sky">
              Effacer
            </a>
            <button type="submit" className="h-11 flex-[2] rounded-lg bg-teal text-sm font-semibold text-navy hover:bg-teal-400">
              Rechercher
            </button>
          </div>
        </form>
      </aside>
      <div className="min-w-0">
        <MobileFilters count={count} action={basePath}>
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
