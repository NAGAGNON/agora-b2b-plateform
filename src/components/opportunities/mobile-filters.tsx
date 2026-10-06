"use client";

import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

/** Bouton + tiroir de filtres pour mobile/tablette. */
export function MobileFilters({ children, count, action }: { children: ReactNode; count: number; action: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <Button variant="outline" full onClick={() => setOpen(true)} aria-expanded={open}>
        <SlidersHorizontal className="size-4" aria-hidden /> Filtres{count > 0 ? ` (${count})` : ""}
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Filtrer les opportunités">
        <form action={action} method="get">
          {children}
          <div className="sticky bottom-0 -mx-5 mt-6 flex gap-2 border-t border-slate-200 bg-white px-5 pt-4 pb-1">
            <a href={action} className="flex h-11 flex-1 items-center justify-center rounded-lg border border-slate-300 text-sm font-semibold text-navy">
              Réinitialiser
            </a>
            <button type="submit" className="h-11 flex-[2] rounded-lg bg-teal text-sm font-semibold text-navy">
              Voir les résultats
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
