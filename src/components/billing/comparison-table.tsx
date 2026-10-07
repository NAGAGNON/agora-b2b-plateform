import { COMPARISON, PLANS } from "@/lib/billing/plans";

/** Tableau comparatif des offres (valeurs issues de la description des offres). */
export function ComparisonTable() {
  const cell = (v: string | boolean) => (v === true ? "✓" : v === false ? "—" : v);
  return (
    <div className="relative mt-4 overflow-x-auto">
      <table className="w-full min-w-[32rem] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left">
            <th className="py-2 pr-3">Fonctionnalité</th>
            {PLANS.map((p) => (
              <th key={p.code} className="px-3 py-2 text-center">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {COMPARISON.map((r) => (
            <tr key={r.label}>
              <td className="py-2 pr-3 text-slate-700">{r.label}</td>
              {r.values.map((v, i) => (
                <td key={i} className="px-3 py-2 text-center font-semibold text-navy">
                  <span aria-hidden>{cell(v)}</span>
                  <span className="sr-only">{v === true ? "Inclus" : v === false ? "Non inclus" : v}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
