import { OPPORTUNITY_TYPE_LABELS, COMPANY_SIZE_LABELS, type OpportunityType, type CompanySize } from "@/lib/constants";
import type { OpportunityFilters } from "@/lib/search-params";
import { getSectors } from "@/lib/queries/platform";
import { Label } from "@/components/ui/form";

type Dept = { code: string; name: string; region: string };
type Place = { name: string; slug: string; department_code: string };

const sel =
  "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-navy focus:border-teal focus:ring-2 focus:ring-teal/30 focus:outline-none";

/**
 * Champs de filtre (formulaire GET). Utilisé en panneau latéral (desktop)
 * et dans un tiroir (mobile). Fonctionne sans JavaScript.
 */
export async function FilterFields({ f, departments, places, idPrefix }: { f: OpportunityFilters; departments: Dept[]; places: Place[]; idPrefix: string }) {
  const id = (n: string) => `${idPrefix}-${n}`;
  const brittany = departments.filter((d) => d.region === "Bretagne");
  const others = departments.filter((d) => d.region !== "Bretagne");
  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor={id("q")}>Mots-clés</Label>
        <input id={id("q")} name="q" defaultValue={f.q} placeholder="ex. maintenance compresseurs" className={sel} />
      </div>
      <div>
        <Label htmlFor={id("secteur")}>Secteur</Label>
        <select id={id("secteur")} name="secteur" defaultValue={f.sector ?? ""} className={sel}>
          <option value="">Tous les secteurs</option>
          {(await getSectors()).map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={id("departement")}>Département</Label>
        <select id={id("departement")} name="departement" defaultValue={f.department ?? ""} className={sel}>
          <option value="">Toute la France</option>
          <optgroup label="Bretagne">
            {brittany.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name} ({d.code})
              </option>
            ))}
          </optgroup>
          <optgroup label="Autres départements">
            {others.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name} ({d.code})
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      <fieldset className="grid grid-cols-[1fr_7rem] gap-2">
        <legend className="mb-1.5 text-sm font-semibold text-navy">Autour de</legend>
        <div>
          <label htmlFor={id("lieu")} className="sr-only">
            Ville
          </label>
          <select id={id("lieu")} name="lieu" defaultValue={f.place ?? ""} className={sel}>
            <option value="">Ville…</option>
            {places.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name} ({p.department_code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={id("rayon")} className="sr-only">
            Rayon
          </label>
          <select id={id("rayon")} name="rayon" defaultValue={String(f.radius ?? 50)} className={sel}>
            {[10, 25, 50, 100, 200].map((r) => (
              <option key={r} value={r}>
                {r} km
              </option>
            ))}
          </select>
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold text-navy">Type d&apos;opportunité</legend>
        <div className="space-y-1.5">
          {(Object.keys(OPPORTUNITY_TYPE_LABELS) as OpportunityType[]).map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="type" value={t} defaultChecked={f.types.includes(t)} className="size-4 accent-teal" />
              {OPPORTUNITY_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold text-navy">Provenance</legend>
        <div className="space-y-1.5 text-sm">
          {[
            ["", "Toutes"],
            ["INTERNAL", "Besoins publiés sur LinkProB2B"],
            ["EXTERNAL", "Opportunités externes"],
          ].map(([v, l]) => (
            <label key={v} className="flex items-center gap-2">
              <input type="radio" name="origine" value={v} defaultChecked={(f.origin ?? "") === v} className="size-4 accent-teal" />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <Label htmlFor={id("statut")}>Statut</Label>
        <select id={id("statut")} name="statut" defaultValue={f.status} className={sel}>
          <option value="OPEN">Ouvertes</option>
          <option value="CLOSED">Clôturées ou expirées</option>
          <option value="ALL">Toutes</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor={id("publiee")}>Publication</Label>
          <select id={id("publiee")} name="publiee" defaultValue={f.publishedWithin ?? ""} className={sel}>
            <option value="">Toutes dates</option>
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="90">90 derniers jours</option>
          </select>
        </div>
        <div>
          <Label htmlFor={id("echeance")}>Échéance avant</Label>
          <input id={id("echeance")} type="date" name="echeance" defaultValue={f.deadlineBefore} className={sel} />
        </div>
      </div>
      <div>
        <Label htmlFor={id("taille")}>Taille d&apos;entreprise</Label>
        <select id={id("taille")} name="taille" defaultValue={f.size ?? ""} className={sel}>
          <option value="">Toutes tailles</option>
          {(Object.keys(COMPANY_SIZE_LABELS) as CompanySize[]).map((s) => (
            <option key={s} value={s}>
              {COMPANY_SIZE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={id("competences")}>Compétences</Label>
        <input id={id("competences")} name="competences" defaultValue={f.skills.join(", ")} placeholder="ex. hydraulique, soudure" className={sel} />
        <p className="mt-1 text-xs text-slate-500">Séparées par des virgules</p>
      </div>
      <input type="hidden" name="tri" value={f.sort} />
    </div>
  );
}
