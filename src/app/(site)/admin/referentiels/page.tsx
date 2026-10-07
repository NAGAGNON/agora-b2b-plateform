import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectorEditor } from "@/components/admin/sector-editor";
import { OPPORTUNITY_TYPE_LABELS, OPPORTUNITY_TYPE_HELP, INTERNAL_TYPES, EXTERNAL_TYPES } from "@/lib/constants";

export const metadata = { title: "Référentiels" };

export default async function AdminReferencesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: sectors }, { data: departments }, { count: places }, { data: usage }] = await Promise.all([
    supabase.from("sectors").select("slug, label, description, sort_order, is_active, is_pilot_priority").order("sort_order"),
    supabase.from("departments").select("code, name, region").order("code"),
    supabase.from("places").select("slug", { count: "exact", head: true }),
    supabase.from("opportunities").select("sector_slug").not("sector_slug", "is", null).limit(10000),
  ]);
  const counts = new Map<string, number>();
  for (const u of usage ?? []) if (u.sector_slug) counts.set(u.sector_slug, (counts.get(u.sector_slug) ?? 0) + 1);
  const regions = new Map<string, number>();
  for (const d of departments ?? []) regions.set(d.region, (regions.get(d.region) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Référentiels</h1>
      <Card>
        <CardHeader
          title={`Secteurs (${sectors?.length ?? 0})`}
          description="Utilisés par les fiches entreprises, les opportunités, les filtres, les alertes et la classification automatique des sources externes."
          action={<SectorEditor />}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-2">Ordre</th>
                <th scope="col" className="px-5 py-2">Secteur</th>
                <th scope="col" className="px-5 py-2">Opportunités</th>
                <th scope="col" className="px-5 py-2">Statut</th>
                <th scope="col" className="px-5 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(sectors ?? []).map((s) => (
                <tr key={s.slug}>
                  <td className="px-5 py-3 text-slate-500">{s.sort_order}</td>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-navy">{s.label}</p>
                    <p className="text-xs text-slate-500">/{s.slug}{s.description ? ` — ${s.description}` : ""}</p>
                  </td>
                  <td className="px-5 py-3">{counts.get(s.slug) ?? 0}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {s.is_active ? <Badge tone="green">Actif</Badge> : <Badge tone="slate">Inactif</Badge>}
                      {s.is_pilot_priority && <Badge tone="teal">Prioritaire</Badge>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <SectorEditor sector={s} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Types d'opportunités" description="Fixés par le modèle de données (les types externes ne peuvent provenir que d'une source référencée)." />
        <ul className="grid gap-3 p-5 sm:grid-cols-2">
          {[...INTERNAL_TYPES, ...EXTERNAL_TYPES].map((t) => (
            <li key={t} className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="font-semibold text-navy">
                {OPPORTUNITY_TYPE_LABELS[t]} {EXTERNAL_TYPES.includes(t) && <Badge tone="amber">Externe</Badge>}
              </p>
              <p className="text-slate-600">{OPPORTUNITY_TYPE_HELP[t]}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader
          title="Zones géographiques"
          description={`${departments?.length ?? 0} départements (${regions.size} régions) et ${places ?? 0} communes géolocalisées pour la recherche par rayon. Référentiel officiel (codes INSEE) : non modifiable depuis l'interface.`}
        />
        <details className="px-5 pb-5 text-sm">
          <summary className="cursor-pointer font-semibold text-navy">Voir les régions</summary>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {[...regions.entries()].sort().map(([r, n]) => (
              <li key={r} className="text-slate-600">
                {r} <span className="text-slate-500">({n})</span>
              </li>
            ))}
          </ul>
        </details>
      </Card>
    </div>
  );
}
