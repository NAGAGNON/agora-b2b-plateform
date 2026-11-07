import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { CountUp } from "@/components/home/count-up";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-3xl border border-slate-200 bg-white shadow-sm", className)} {...props} />;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-bold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Tuile de chiffre clé pour les tableaux de bord (valeurs réelles uniquement). */
export function DashboardCard({ label, value, hint, href, icon, animate = false }: { label: string; value: number | string; hint?: string; href?: string; icon?: ReactNode; animate?: boolean }) {
  const body = (
    <>
      <span aria-hidden className="pointer-events-none absolute -top-10 -right-10 size-28 rounded-full bg-gradient-to-br from-teal/15 to-electric/10 blur-2xl transition duration-500 group-hover:scale-150" />
      <div className="relative flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        {icon && (
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-50 to-sky text-teal-700 ring-1 ring-teal/20 transition duration-300 group-hover:scale-110 group-hover:rotate-6">
            {icon}
          </span>
        )}
      </div>
      <p className="relative mt-2 font-heading text-3xl font-extrabold text-navy tabular-nums">{animate && typeof value === "number" ? <CountUp value={value} duration={900} /> : value}</p>
      {hint && <p className="relative mt-1 text-xs text-slate-500">{hint}</p>}
    </>
  );
  const cls = "group relative block overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm";
  return href ? (
    <Link href={href} className={cn(cls, "transition duration-300 hover:-translate-y-1 hover:border-teal/50 hover:shadow-lg")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
