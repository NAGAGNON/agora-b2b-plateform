import type { ReactNode } from "react";

/** Barre de filtre GET pour les listes d'administration. */
export function AdminFilter({ action, children }: { action: string; children: ReactNode }) {
  return (
    <form action={action} method="get" className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
      {children}
      <button type="submit" className="h-10 rounded-lg bg-navy px-4 text-sm font-semibold text-white">
        Filtrer
      </button>
    </form>
  );
}

export const adminInput = "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm";
