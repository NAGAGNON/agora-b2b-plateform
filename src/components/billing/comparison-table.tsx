import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { COMPARISON, PLANS } from "@/lib/billing/plans";

/** Tableau comparatif des offres (valeurs issues de la description des offres), colonne Pro mise en avant. */
export function ComparisonTable() {
  const popular = PLANS.findIndex((p) => p.popular);
  return (
    <div className="relative mt-6 overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-slate-200" tabIndex={0} role="region" aria-label="Tableau comparatif des offres">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="text-left">
            <th className="sticky left-0 z-10 bg-white px-5 py-4 font-semibold text-slate-500">Fonctionnalité</th>
            {PLANS.map((p, i) => (
              <th key={p.code} className={cn("px-4 py-4 text-center font-heading text-base font-extrabold text-navy", i === popular && "bg-teal-50/70 text-teal-900")}>
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON.map((r) => (
            <tr key={r.label} className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
              <td className="sticky left-0 z-10 bg-white px-5 py-3.5 text-slate-700">{r.label}</td>
              {r.values.map((v, i) => (
                <td key={i} className={cn("px-4 py-3.5 text-center", i === popular && "bg-teal-50/70")}>
                  {v === true ? (
                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-teal text-navy">
                      <Check className="size-3.5" strokeWidth={3} aria-hidden />
                    </span>
                  ) : v === false ? (
                    <Minus className="mx-auto size-4 text-slate-300" aria-hidden />
                  ) : (
                    <span className="font-semibold text-navy" aria-hidden>
                      {v}
                    </span>
                  )}
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
