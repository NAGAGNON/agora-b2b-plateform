import { Search } from "lucide-react";
import { SECTORS, BRITTANY_DEPARTMENTS, OPPORTUNITY_TYPE_LABELS, type OpportunityType } from "@/lib/constants";

/** Recherche principale (formulaire GET vers /opportunites — fonctionne sans JavaScript). */
export function SearchBar({ defaults = {} }: { defaults?: { q?: string; secteur?: string; departement?: string; type?: string } }) {
  const field = "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-[15px] text-navy focus:border-teal focus:ring-2 focus:ring-teal/30 focus:outline-none";
  return (
    <form action="/opportunites" method="get" role="search" aria-label="Rechercher des opportunités" className="rounded-2xl bg-white p-3 shadow-xl ring-1 ring-slate-900/5 sm:p-4">
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-[1.5fr_1.2fr_1fr_1fr_auto]">
        <div>
          <label htmlFor="hero-q" className="sr-only">
            Que recherchez-vous ?
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
            <input id="hero-q" name="q" defaultValue={defaults.q} placeholder="Que recherchez-vous ?" className={`${field} pl-10`} />
          </div>
        </div>
        <div>
          <label htmlFor="hero-secteur" className="sr-only">
            Secteur
          </label>
          <select id="hero-secteur" name="secteur" defaultValue={defaults.secteur ?? ""} className={field}>
            <option value="">Tous les secteurs</option>
            {SECTORS.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="hero-dep" className="sr-only">
            Localisation
          </label>
          <select id="hero-dep" name="departement" defaultValue={defaults.departement ?? ""} className={field}>
            <option value="">Toute la France</option>
            {BRITTANY_DEPARTMENTS.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="hero-type" className="sr-only">
            Type d&apos;opportunité
          </label>
          <select id="hero-type" name="type" defaultValue={defaults.type ?? ""} className={field}>
            <option value="">Tous les types</option>
            {(Object.keys(OPPORTUNITY_TYPE_LABELS) as OpportunityType[]).map((t) => (
              <option key={t} value={t}>
                {OPPORTUNITY_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-teal px-6 font-semibold text-white hover:bg-teal-600">
          <Search className="size-5" aria-hidden /> Rechercher
        </button>
      </div>
    </form>
  );
}
