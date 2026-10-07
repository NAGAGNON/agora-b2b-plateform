import { Building } from "lucide-react";
import { CompanyCard } from "@/components/companies/company-card";
import { MobileFilters } from "@/components/opportunities/mobile-filters";
import { SearchActions } from "@/components/opportunities/save-search";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { Label } from "@/components/ui/form";
import { searchCompanies } from "@/lib/queries/companies";
import { getDepartments, getSectors } from "@/lib/queries/platform";
import { getSession } from "@/lib/auth";
import { COMPANY_KIND_LABELS, COMPANY_SIZE_LABELS, PAGE_SIZE, type SectorOption, type CompanyKind, type CompanySize } from "@/lib/constants";
import type { CompanyFilters, RawSearchParams } from "@/lib/search-params";

const sel = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-navy focus:border-teal focus:ring-2 focus:ring-teal/30 focus:outline-none";

function Fields({ f, departments, sectors, p }: { f: CompanyFilters; departments: { code: string; name: string }[]; sectors: SectorOption[]; p: string }) {
  return (
    <div className="space-y-5">
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

export async function Directory({ filters, rawParams, basePath }: { filters: CompanyFilters; rawParams: RawSearchParams; basePath: string }) {
  const [{ rows, total, error }, departments, sectors, session] = await Promise.all([searchCompanies(filters), getDepartments(), getSectors(), getSession()]);
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const count = [filters.sector, filters.department, filters.kind, filters.size].filter(Boolean).length + (filters.skills.length ? 1 : 0);
  const query = new URLSearchParams(Object.entries(rawParams).flatMap(([k, v]) => (typeof v === "string" && k !== "page" ? [[k, v]] : [])));
  return (
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
  );
}
