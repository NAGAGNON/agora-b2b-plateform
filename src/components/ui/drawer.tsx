"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/** Panneau latéral (filtres mobiles, menu) — basé sur <dialog> pour l'accessibilité. */
export function Drawer({
  open,
  onClose,
  title,
  side = "right",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: "left" | "right";
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="drawer-title"
      className={cn(
        "fixed inset-y-0 m-0 h-dvh max-h-dvh w-[min(24rem,100vw)] max-w-full bg-white p-0 text-slate shadow-2xl backdrop:bg-navy/60",
        side === "right" ? "right-0 left-auto" : "left-0 right-auto",
      )}
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 id="drawer-title" className="text-lg font-bold">
              {title}
            </h2>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-sky" aria-label="Fermer">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="border-t border-slate-200 px-5 py-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
