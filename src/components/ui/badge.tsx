import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "navy" | "teal" | "sky" | "slate" | "amber" | "red" | "green" | "violet" | "outline";
const tones: Record<BadgeTone, string> = {
  navy: "bg-navy text-white",
  teal: "bg-teal-50 text-teal-700 ring-1 ring-teal/30",
  sky: "bg-sky text-navy ring-1 ring-sky-200",
  slate: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  amber: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-1 ring-red-200",
  green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  violet: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  outline: "bg-white text-slate-700 ring-1 ring-slate-300",
};

export function Badge({ tone = "slate", children, className, icon }: { tone?: BadgeTone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
