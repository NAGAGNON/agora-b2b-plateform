import Link from "next/link";
import { cn } from "@/lib/cn";

/** Onglets par liens (état dans l'URL, accessibles sans JavaScript). */
export function LinkTabs({ tabs, active }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <div className="relative mb-6 overflow-x-auto border-b border-slate-200">
      <nav className="flex gap-1" aria-label="Onglets">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={t.key === active ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold whitespace-nowrap",
              t.key === active ? "border-teal text-navy" : "border-transparent text-slate-500 hover:text-navy",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{t.count}</span>}
          </Link>
        ))}
      </nav>
    </div>
  );
}
