import { Briefcase, CalendarClock, Compass, Factory, Layers, MapPin, Search, Wrench } from "lucide-react";
import { OPPORTUNITY_TYPE_LABELS, COMPANY_SIZE_LABELS, type OpportunityType, type CompanySize } from "@/lib/constants";
import type { OpportunityFilters } from "@/lib/search-params";
import { getPublicSources, getSectors } from "@/lib/queries/platform";
import { groupSectors } from "@/lib/sector-families";
import { REGIONS } from "@/lib/geo";
import { Chip, ChipGroup, FilterInput, FilterSection, FilterSelect, SubLabel } from "@/components/ui/filters";

type Dept = { code: string; name: string; region: string };
type Place = { name: string; slug: string; department_code: string };

/** « PME (10 à 249 salariés) » devient « PME » dans les pastilles. */
const short = (l: string) => l.replace(/\s*\(.*\)$/, "");

/**
 * Champs de filtre (formulaire GET). Utilisé en panneau latéral (desktop)
 * et dans un tiroir (mobile). Fonctionne sans JavaScript.
 */
export async function FilterFields({ f, departments, places, idPrefix }: { f: OpportunityFilters; departments: Dept[]; places: Place[]; idPrefix: string }) {
  const id = (n: string) => `${idPrefix}-${n}`;
  const [sources, sectors] = await Promise.all([getPublicSources(), getSectors()]);
  const placeName = (f.place && places.find((p) => p.slug === f.place)?.name) ?? f.place ?? "";
  return (
    <div>
      <FilterSection title="Recherche" icon={<Search className="size-4" />} active={Boolean(f.q)}>
        <label htmlFor={id("q")} className="sr-only">
          Mots-clés
        </label>
        <FilterInput key={f.q ?? ""} id={id("q")} name="q" defaultValue={f.q} placeholder="ex. maintenance compresseurs" icon={<Search />} />
      </FilterSection>

      <FilterSection title="Secteur d'activité" icon={<Factory className="size-4" />} active={Boolean(f.sector)}>
        <label htmlFor={id("secteur")} className="sr-only">
          Secteur d&apos;activité
        </label>
        <FilterSelect id={id("secteur")} name="secteur" defaultValue={f.sector ?? ""}>
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
      </FilterSection>

      <FilterSection title="Type d'opportunité" icon={<Briefcase className="size-4" />} active={f.types.length > 0}>
        <ChipGroup label="Type d'opportunité">
          {(Object.keys(OPPORTUNITY_TYPE_LABELS) as OpportunityType[]).map((t) => (
            <Chip key={t} type="checkbox" name="type" value={t} checked={f.types.includes(t)}>
              {OPPORTUNITY_TYPE_LABELS[t]}
            </Chip>
          ))}
        </ChipGroup>
        <ChipGroup label="Provenance">
          {[
            ["", "Toutes provenances"],
            ["INTERNAL", "Besoins d'entreprises"],
            ["EXTERNAL", "Marchés publics et externes"],
          ].map(([v, l]) => (
            <Chip key={v} name="origine" value={v} checked={(f.origin ?? "") === v}>
              {l}
            </Chip>
          ))}
        </ChipGroup>
      </FilterSection>

      <FilterSection title="Localisation" icon={<MapPin className="size-4" />} active={Boolean(f.region || f.department || f.city || f.place)}>
        <div>
          <SubLabel htmlFor={id("region")}>Région</SubLabel>
          <FilterSelect id={id("region")} name="region" defaultValue={f.region ?? ""}>
            <option value="">France entière</option>
            {REGIONS.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </FilterSelect>
        </div>
        <div>
          <SubLabel htmlFor={id("departement")}>Département</SubLabel>
          <FilterSelect id={id("departement")} name="departement" defaultValue={f.department ?? ""}>
            <option value="">Tous les départements</option>
            {REGIONS.map((r) => (
              <optgroup key={r.slug} label={r.name}>
                {departments
                  .filter((d) => d.region === r.name)
                  .map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.name} ({d.code})
                    </option>
                  ))}
              </optgroup>
            ))}
          </FilterSelect>
        </div>
        <div>
          <SubLabel htmlFor={id("ville")}>Ville ou code postal</SubLabel>
          <FilterInput id={id("ville")} name="ville" defaultValue={f.city} placeholder="ex. Lyon ou 69003" icon={<MapPin />} />
        </div>
        <div>
          <SubLabel htmlFor={id("lieu")}>Autour d&apos;une ville</SubLabel>
          <div className="grid grid-cols-[1fr_6.5rem] gap-2">
            <FilterInput id={id("lieu")} name="lieu" defaultValue={placeName} placeholder="ex. Nantes" autoComplete="address-level2" icon={<Compass />} />
            <label htmlFor={id("rayon")} className="sr-only">
              Rayon
            </label>
            <FilterSelect id={id("rayon")} name="rayon" defaultValue={String(f.radius ?? 50)}>
              {[10, 25, 50, 100, 200].map((r) => (
                <option key={r} value={r}>
                  {r} km
                </option>
              ))}
            </FilterSelect>
          </div>
        </div>
      </FilterSection>

      <FilterSection title="Dates et statut" icon={<CalendarClock className="size-4" />} active={f.status !== "OPEN" || Boolean(f.publishedWithin || f.deadlineBefore)}>
        <ChipGroup label="Statut">
          {[
            ["OPEN", "Ouvertes"],
            ["CLOSED", "Clôturées"],
            ["ALL", "Toutes"],
          ].map(([v, l]) => (
            <Chip key={v} name="statut" value={v} checked={f.status === v}>
              {l}
            </Chip>
          ))}
        </ChipGroup>
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-500">Publiées depuis</p>
          <ChipGroup label="Publiées depuis">
            {[
              ["", "Toujours"],
              ["7", "7 jours"],
              ["30", "30 jours"],
              ["90", "90 jours"],
            ].map(([v, l]) => (
              <Chip key={v} name="publiee" value={v} checked={String(f.publishedWithin ?? "") === v}>
                {l}
              </Chip>
            ))}
          </ChipGroup>
        </div>
        <div>
          <SubLabel htmlFor={id("echeance")}>Date limite de réponse avant le</SubLabel>
          <FilterInput id={id("echeance")} type="date" name="echeance" defaultValue={f.deadlineBefore} />
        </div>
      </FilterSection>

      <FilterSection
        title="Plus de critères"
        icon={<Layers className="size-4" />}
        defaultOpen={false}
        active={Boolean(f.size || f.skills.length || f.source)}
      >
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-500">Taille de l&apos;entreprise</p>
          <ChipGroup label="Taille d'entreprise">
            <Chip name="taille" value="" checked={!f.size}>
              Toutes
            </Chip>
            {(Object.keys(COMPANY_SIZE_LABELS) as CompanySize[]).map((s) => (
              <Chip key={s} name="taille" value={s} checked={f.size === s}>
                {short(COMPANY_SIZE_LABELS[s])}
              </Chip>
            ))}
          </ChipGroup>
        </div>
        <div>
          <SubLabel htmlFor={id("competences")}>Compétences (séparées par des virgules)</SubLabel>
          <FilterInput id={id("competences")} name="competences" defaultValue={f.skills.join(", ")} placeholder="ex. hydraulique, soudure" icon={<Wrench />} />
        </div>
        {sources.length > 0 && (
          <div>
            <SubLabel htmlFor={id("source")}>Source</SubLabel>
            <FilterSelect id={id("source")} name="source" defaultValue={f.source ?? ""}>
              <option value="">Toutes les sources</option>
              {sources.map((src) => (
                <option key={src.code} value={src.code}>
                  {src.name}
                </option>
              ))}
            </FilterSelect>
          </div>
        )}
      </FilterSection>
      <input type="hidden" name="tri" value={f.sort} />
    </div>
  );
}
