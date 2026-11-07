import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

export type Step = { done: boolean; label: string; hint: string; href: string; cta: string };

/** « Pour bien démarrer » : étapes d'activation, cochées selon les données réelles du compte. */
export function GettingStarted({ steps }: { steps: Step[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const pct = Math.round((done / steps.length) * 100);
  const r = 26;
  const c = 2 * Math.PI * r;
  const next = steps.find((s) => !s.done);
  return (
    <section aria-labelledby="demarrer" className="relative overflow-hidden rounded-3xl border border-teal-200/70 bg-gradient-to-br from-teal-50 via-white to-sky p-5 shadow-sm sm:p-6" data-testid="getting-started">
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-48 animate-aurora rounded-full bg-teal/15 blur-3xl" />
      <div className="relative flex flex-wrap items-center gap-5">
        <div className="relative size-16 shrink-0" aria-hidden>
          <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
            <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(20 194 173 / 0.15)" strokeWidth="7" />
            <circle cx="32" cy="32" r={r} fill="none" stroke="url(#gs-grad)" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - done / steps.length)} className="transition-[stroke-dashoffset] duration-1000" />
            <defs>
              <linearGradient id="gs-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#14c2ad" />
                <stop offset="1" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-heading text-sm font-extrabold text-navy">{pct}%</span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="demarrer" className="text-lg font-bold text-navy">
            Pour bien démarrer
          </h2>
          <p className="text-sm text-slate-600">
            {done} / {steps.length} étapes · plus votre profil est complet, plus les offres proposées sont justes.
          </p>
        </div>
        {next && (
          <Link href={next.href} className="btn-shine inline-flex h-10 items-center gap-2 rounded-xl bg-navy px-4 text-sm font-bold text-white shadow-md transition hover:-translate-y-px">
            Étape suivante <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      <ol className="relative mt-5 grid items-start gap-2.5 md:grid-cols-2">
        {steps.map((s, i) => (
          <li
            key={s.label}
            style={{ animationDelay: `${i * 60}ms` }}
            className={`flex animate-rise items-start gap-3 rounded-2xl p-3 transition ${s.done ? "bg-white/50" : "bg-white shadow-sm ring-1 ring-slate-200 hover:ring-teal/40"}`}
          >
            {s.done ? (
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-teal text-navy" role="img" aria-label="Fait">
                <Check className="size-4" />
              </span>
            ) : (
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-xs font-bold text-slate-400" role="img" aria-label="À faire">
                {i + 1}
              </span>
            )}
            <div className="min-w-0">
              <p className={s.done ? "font-semibold text-slate-500 line-through" : "font-semibold text-navy"}>{s.label}</p>
              {!s.done && (
                <>
                  <p className="text-xs text-slate-600">{s.hint}</p>
                  <Link href={s.href} className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:underline">
                    {s.cta} <ArrowRight className="size-3.5" aria-hidden />
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
