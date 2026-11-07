"use client";

import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";

/** Bouton + tiroir de filtres pour mobile/tablette. */
export function MobileFilters({ children, count, action, title = "Filtrer" }: { children: ReactNode; count: number; action: string; title?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-navy shadow-sm transition hover:border-teal/50 hover:shadow-md"
      >
        <SlidersHorizontal className="size-4 text-teal-700" aria-hidden /> Filtres
        {count > 0 && <span className="rounded-full bg-teal px-2 py-0.5 text-xs font-bold text-navy">{count}</span>}
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title={title}>
        <form action={action} method="get">
          {children}
          <div className="sticky bottom-0 -mx-5 mt-6 flex gap-2 border-t border-slate-100 bg-white/95 px-5 pt-4 pb-1 backdrop-blur">
            <a href={action} className="flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-navy hover:bg-slate-50">
              Réinitialiser
            </a>
            <button type="submit" className="h-11 flex-[2] rounded-xl bg-gradient-to-r from-teal to-cyan-400 text-sm font-bold text-navy shadow-md">
              Voir les résultats
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
