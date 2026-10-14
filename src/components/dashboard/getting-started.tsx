import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";

export type Step = { done: boolean; label: string; hint: string; href: string; cta: string };

/** « Pour bien démarrer » : étapes d'activation, cochées selon les données réelles du compte. */
export function GettingStarted({ steps }: { steps: Step[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <section aria-labelledby="demarrer" className="rounded-2xl border border-teal-200 bg-teal-50/60 p-5" data-testid="getting-started">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="demarrer" className="text-lg font-bold text-navy">
          Pour bien démarrer
        </h2>
        <p className="text-sm text-slate-600">
          {done} / {steps.length} étapes
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white" aria-hidden>
        <div className="h-full rounded-full bg-teal" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-2">
        {steps.map((s) => (
          <li key={s.label} className="flex items-start gap-3 rounded-xl bg-white p-3">
            {s.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-teal-600" aria-label="Fait" /> : <Circle className="mt-0.5 size-5 shrink-0 text-slate-300" aria-label="À faire" />}
            <div className="min-w-0">
              <p className={s.done ? "font-semibold text-slate-500 line-through" : "font-semibold text-navy"}>{s.label}</p>
              {!s.done && (
                <>
                  <p className="text-xs text-slate-600">{s.hint}</p>
                  <Link href={s.href} className="mt-1 inline-block text-sm font-semibold text-teal-700 underline">
                    {s.cta}
                  </Link>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
