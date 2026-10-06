import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)} {...props} />;
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
export function DashboardCard({ label, value, hint, href, icon }: { label: string; value: number | string; hint?: string; href?: string; icon?: ReactNode }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        {icon && <span className="text-teal-700">{icon}</span>}
      </div>
      <p className="mt-2 font-heading text-3xl font-bold text-navy tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </>
  );
  const cls = "block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
  return href ? (
    <Link href={href} className={cn(cls, "transition hover:border-teal hover:shadow-md")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
