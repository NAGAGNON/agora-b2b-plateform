import type { NamedCount } from "@/lib/article-figures";

const nf = new Intl.NumberFormat("fr-FR");

/** Chiffres clés d'une analyse (valeurs réelles du jeu de faits). */
export function KeyFigures({ items }: { items: { label: string; value: number }[] }) {
  return (
    <div className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((k) => (
        <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="font-heading text-3xl font-bold text-navy tabular-nums">{nf.format(k.value)}</div>
          <div className="mt-1 text-sm text-slate-600">{k.label}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Barres horizontales, une seule série (une teinte), libellés et valeurs écrits en
 * clair ; tableau équivalent pour les lecteurs d'écran.
 */
export function BarChart({ title, data, unit = "opportunités" }: { title: string; data: NamedCount[]; unit?: string }) {
  if (data.length === 0) return null;
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <figure className="my-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <figcaption className="mb-4 font-semibold text-navy">{title}</figcaption>
      <div className="space-y-3" aria-hidden>
        {data.map((d) => (
          <div key={d.name} title={`${d.name} : ${nf.format(d.count)} ${unit}`}>
            <div className="mb-1 flex justify-between gap-3 text-sm">
              <span className="truncate text-slate-700">{d.name}</span>
              <span className="font-semibold text-navy tabular-nums">{nf.format(d.count)}</span>
            </div>
            <div className="h-2.5 rounded-[4px] bg-slate-100">
              <div className="h-full rounded-[4px] bg-teal-600" style={{ width: `${Math.max(2, (d.count / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.name}>
              <th scope="row">{d.name}</th>
              <td>
                {d.count} {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
