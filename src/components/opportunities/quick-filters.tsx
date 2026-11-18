import Link from "next/link";
import { Briefcase, CalendarClock, Check, Handshake, Landmark, MapPin, Sparkles } from "lucide-react";
import type { RawSearchParams } from "@/lib/search-params";

export type QuickFilter = { key: string; label: string; icon: "metier" | "zone" | "echeance" | "nouveau" | "besoins" | "publics"; set: Record<string, string> };

const ICONS = { metier: Briefcase, zone: MapPin, echeance: CalendarClock, nouveau: Sparkles, besoins: Handshake, publics: Landmark };

/** Lien qui active (ou retire) un raccourci de filtre en gardant le reste de la recherche. */
function toggleHref(basePath: string, raw: RawSearchParams, set: Record<string, string>, on: boolean) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) {
    if (k === "page") continue;
    for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) if (x !== "") q.append(k, x);
  }
  for (const [k, v] of Object.entries(set)) {
    q.delete(k);
    if (!on) q.set(k, v);
  }
  const s = q.toString();
  return s ? `${basePath}?${s}` : basePath;
}

/**
 * Raccourcis en un clic au-dessus des résultats (métier et département de l'entreprise, clôture
 * proche, nouveautés, provenance) : les filtres les plus utiles sans ouvrir le panneau.
 */
export function QuickFilters({ items, basePath, raw }: { items: QuickFilter[]; basePath: string; raw: RawSearchParams }) {
  if (!items.length) return null;
  return (
    // Sur plusieurs lignes, sans défilement horizontal (le glissement sur téléphone faisait bouger la page)
    <nav aria-label="Filtres rapides">
      <ul className="flex flex-wrap gap-2">
        {items.map((f) => {
          const on = Object.entries(f.set).every(([k, v]) => raw[k] === v);
          const Icon = on ? Check : ICONS[f.icon];
          return (
            <li key={f.key}>
              <Link
                href={toggleHref(basePath, raw, f.set, on)}
                aria-current={on ? "true" : undefined}
                scroll={false}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap sm:px-3.5 sm:py-2 transition ${
                  on ? "bg-navy text-white shadow-md hover:bg-navy-900" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:text-navy hover:ring-teal/50"
                }`}
              >
                <Icon className={`size-4 ${on ? "text-teal-300" : "text-teal-700"}`} aria-hidden />
                {f.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
