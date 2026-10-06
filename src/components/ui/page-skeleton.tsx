/** Squelette affiché pendant le chargement d'une page de l'espace connecté. */
export function PageSkeleton({ label = "Chargement…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-6">
      <span className="sr-only">{label}</span>
      <div className="h-8 w-64 rounded-lg bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-5 rounded bg-slate-100" style={{ width: `${90 - i * 12}%` }} />
        ))}
      </div>
    </div>
  );
}
