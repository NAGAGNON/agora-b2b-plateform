import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Briques des filtres (formulaires GET, sans JavaScript) : sections repliables avec icône,
 * choix en pastilles, listes déroulantes et champs harmonisés, filtres actifs retirables.
 */

export const filterControl =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-navy shadow-inner shadow-slate-100 transition placeholder:text-slate-400 hover:border-slate-300 focus:border-teal focus:bg-white focus:ring-4 focus:ring-teal/15 focus:outline-none";

/** Section de filtre repliable (ouverte par défaut ou si un filtre y est actif). */
export function FilterSection({
  title,
  icon,
  active = false,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: ReactNode;
  active?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen || active} className="group/fs border-b border-slate-100 py-4 first:pt-0 last:border-0 last:pb-0">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 text-sm font-semibold text-navy select-none [&::-webkit-details-marker]:hidden">
        <span className={cn("flex size-7 items-center justify-center rounded-lg transition", active ? "bg-teal text-navy" : "bg-teal-50 text-teal-700")} aria-hidden>
          {icon}
        </span>
        <span className="flex-1">{title}</span>
        {active && <span className="size-2 rounded-full bg-teal" role="img" aria-label="Filtre actif" />}
        <ChevronDown className="size-4 text-slate-400 transition group-open/fs:rotate-180" aria-hidden />
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

/** Option en pastille (case à cocher ou bouton radio masqué, accessible au clavier). */
export function Chip({ type = "radio", name, value, checked, children }: { type?: "radio" | "checkbox"; name: string; value: string; checked: boolean; children: ReactNode }) {
  return (
    <label className="relative cursor-pointer">
      <input type={type} name={name} value={value} defaultChecked={checked} className="peer sr-only" />
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition select-none hover:border-teal/50 hover:text-navy peer-checked:border-navy peer-checked:bg-navy peer-checked:text-white peer-checked:shadow-md peer-focus-visible:ring-4 peer-focus-visible:ring-teal/30">
        {children}
      </span>
    </label>
  );
}

export function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {children}
    </div>
  );
}

/** Liste déroulante harmonisée (flèche dessinée, fond doux). */
export function FilterSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(filterControl, "appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
    </div>
  );
}

/** Champ texte avec icône à gauche. */
export function FilterInput({ icon, className, ...props }: ComponentProps<"input"> & { icon?: ReactNode }) {
  return (
    <div className="relative">
      {icon && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 [&>svg]:size-4">{icon}</span>}
      <input className={cn(filterControl, icon && "pl-9", className)} {...props} />
    </div>
  );
}

export function SubLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-slate-500">
      {children}
    </label>
  );
}

/** En-tête du panneau de filtres (desktop). */
export function FilterHeader({ count, resetHref }: { count: number; resetHref: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-100 pb-4">
      <p className="flex items-center gap-2 font-bold text-navy">
        <SlidersHorizontal className="size-4 text-teal-700" aria-hidden /> Filtres
        {count > 0 && <span className="rounded-full bg-teal px-2 py-0.5 text-xs font-bold text-navy">{count}</span>}
      </p>
      {count > 0 && (
        <Link href={resetHref} className="text-xs font-semibold text-slate-500 hover:text-red-600">
          Tout effacer
        </Link>
      )}
    </div>
  );
}

/** Boutons du bas du panneau, collés en bas à l'écran pendant le défilement. */
export function FilterSubmit({ label = "Afficher les résultats" }: { label?: string }) {
  return (
    <div className="sticky bottom-0 -mx-5 mt-5 -mb-5 rounded-b-3xl border-t border-slate-100 bg-white/90 px-5 py-4 backdrop-blur">
      <button type="submit" className="btn-shine h-11 w-full rounded-xl bg-gradient-to-r from-teal to-cyan-400 text-sm font-bold text-navy shadow-md transition hover:-translate-y-px hover:shadow-lg">
        {label}
      </button>
    </div>
  );
}

export type ActiveFilter = { key: string; label: string; href: string };

/** Filtres actifs en pastilles : un clic retire le filtre, sans rouvrir le panneau. */
export function ActiveFilters({ items, resetHref }: { items: ActiveFilter[]; resetHref: string }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Filtres actifs">
      {items.map((f) => (
        <Link
          key={f.key}
          href={f.href}
          className="group inline-flex animate-pop items-center gap-1.5 rounded-full bg-navy py-1 pr-2 pl-3 text-xs font-semibold text-white shadow-sm transition hover:bg-red-600"
          aria-label={`Retirer le filtre ${f.label}`}
        >
          {f.label}
          <X className="size-3.5 opacity-70 group-hover:opacity-100" aria-hidden />
        </Link>
      ))}
      {items.length > 1 && (
        <Link href={resetHref} className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-navy hover:underline">
          Tout effacer
        </Link>
      )}
    </div>
  );
}

/** Lien qui retire un paramètre (ou une valeur d'un paramètre multiple) de la recherche courante. */
export function withoutParam(basePath: string, params: Record<string, string | string[] | undefined>, key: string, value?: string) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === "page") continue;
    for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) {
      if (k === key && (value === undefined || x === value)) continue;
      if (x !== "") q.append(k, x);
    }
  }
  const s = q.toString();
  return s ? `${basePath}?${s}` : basePath;
}
