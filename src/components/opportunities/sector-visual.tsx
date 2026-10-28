import { Building2, Cpu, Factory, HardHat, Landmark, Leaf, Truck } from "lucide-react";
import { SECTOR_FAMILIES } from "@/lib/sector-families";

/** Visuel de chaque famille de métiers : couleur et pictogramme (léger, sans image à télécharger). */
const VISUALS: Record<string, { className: string; Icon: typeof Factory }> = {
  industrie: { className: "from-slate-600 via-slate-700 to-navy", Icon: Factory },
  btp: { className: "from-amber-500 via-orange-500 to-orange-700", Icon: HardHat },
  "energie-environnement": { className: "from-emerald-500 via-teal-600 to-teal-800", Icon: Leaf },
  numerique: { className: "from-indigo-500 via-sky-600 to-navy", Icon: Cpu },
  "conseil-services": { className: "from-petrol via-teal-700 to-teal-600", Icon: Landmark },
  "services-generaux": { className: "from-cyan-600 via-sky-700 to-navy", Icon: Truck },
};
const FALLBACK = { className: "from-navy via-navy-700 to-petrol", Icon: Building2 };

export function sectorFamilySlug(sector: string | null | undefined): string | null {
  if (!sector) return null;
  return SECTOR_FAMILIES.find((f) => f.sectors.includes(sector))?.slug ?? null;
}

/** Bandeau illustré d'une opportunité, selon la famille de son secteur. */
export function SectorVisual({ sector, label, className = "" }: { sector: string | null | undefined; label?: string | null; className?: string }) {
  const v = VISUALS[sectorFamilySlug(sector) ?? ""] ?? FALLBACK;
  return (
    <div aria-hidden className={`relative overflow-hidden bg-gradient-to-br ${v.className} ${className}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.18)_1px,transparent_0)] [background-size:14px_14px]" />
      <v.Icon className="absolute -right-3 -bottom-4 size-24 text-white/20 transition duration-300 group-hover:scale-110 group-hover:text-white/30" strokeWidth={1.5} />
      {label && <span className="absolute bottom-2.5 left-4 rounded-full bg-black/25 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">{label}</span>}
    </div>
  );
}
