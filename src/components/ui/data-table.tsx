import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Masqué dans la vue carte mobile */
  hideOnMobile?: boolean;
  /** Utilisé comme titre de la carte mobile */
  primary?: boolean;
};

/**
 * Tableau responsive : tableau classique à partir de 768 px, cartes empilées
 * (MobileCard) en dessous.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  empty,
  caption,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  caption?: string;
}) {
  if (rows.length === 0) return <>{empty}</>;
  const primary = columns.find((c) => c.primary) ?? columns[0];
  return (
    <>
      <div className="relative hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-slate-50">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn("px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase", c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={rowKey(r)} className="hover:bg-slate-50/60">
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 py-3 align-top", c.className)}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)}>
            <MobileCard title={primary.cell(r)}>
              {columns
                .filter((c) => c !== primary && !c.hideOnMobile)
                .map((c) => (
                  <div key={c.key} className="flex items-start justify-between gap-4 py-1.5">
                    <dt className="text-xs font-semibold text-slate-500 uppercase">{c.header}</dt>
                    <dd className="text-right text-sm">{c.cell(r)}</dd>
                  </div>
                ))}
            </MobileCard>
          </li>
        ))}
      </ul>
    </>
  );
}

export function MobileCard({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 font-semibold text-navy">{title}</div>
      <dl className="divide-y divide-slate-100">{children}</dl>
    </div>
  );
}
