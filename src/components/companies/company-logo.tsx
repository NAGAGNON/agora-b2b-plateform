import Image from "next/image";
import { Briefcase, Building2, Cpu, Factory, HardHat, Leaf, Truck, type LucideIcon } from "lucide-react";
import { logoUrl } from "@/lib/storage-urls";
import { SECTOR_FAMILIES } from "@/lib/sector-families";

/** Palettes de l'emblème (deux halos + reflet), choisies de façon stable d'après le nom. */
const PALETTES: [string, string, string][] = [
  ["#14c2ad", "#3b82f6", "#99f6e4"],
  ["#7c6cff", "#14c2ad", "#c4b5fd"],
  ["#06b6d4", "#7c6cff", "#a5f3fc"],
  ["#10b981", "#0ea5e9", "#a7f3d0"],
  ["#3b82f6", "#ec4899", "#bfdbfe"],
  ["#14c2ad", "#a855f7", "#5eead4"],
];

/** Icône du métier (famille du premier secteur de l'entreprise). */
const FAMILY_ICONS: Record<string, LucideIcon> = {
  industrie: Factory,
  btp: HardHat,
  "energie-environnement": Leaf,
  numerique: Cpu,
  "conseil-services": Briefcase,
  "services-generaux": Truck,
};

function hash(name: string) {
  let h = 5381;
  for (const ch of name) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/**
 * Logo d'une entreprise ; sans logo, un emblème animé : halos de couleur en rotation lente,
 * anneau lumineux en orbite et icône du métier qui flotte. Sans état ni effet : utilisable côté
 * serveur et navigateur.
 */
export function CompanyLogo({ name, path, size = 56, sector }: { name: string; path: string | null; size?: number; sector?: string | null }) {
  const url = logoUrl(path);
  if (url)
    return (
      <Image src={url} alt={`Logo ${name}`} width={size} height={size} className="shrink-0 rounded-xl border border-slate-200 bg-white object-contain" style={{ width: size, height: size }} unoptimized />
    );
  const h = hash(name);
  const [m1, m2, m3] = PALETTES[h % PALETTES.length];
  const family = sector ? SECTOR_FAMILIES.find((f) => f.sectors.includes(sector))?.slug : undefined;
  const Icon = (family && FAMILY_ICONS[family]) || Building2;
  const gid = h.toString(36);
  const small = size < 44;
  return (
    <span
      aria-hidden
      className="monogram group/mono flex shrink-0 items-center justify-center rounded-[28%]"
      style={{ width: size, height: size, ["--m1" as string]: m1, ["--m2" as string]: m2, ["--m3" as string]: m3 }}
    >
      {!small && (
        <svg viewBox="0 0 100 100" className="monogram-ring absolute inset-[8%] size-[84%]" style={{ animationDelay: `-${h % 9}s` }} aria-hidden>
          <defs>
            <linearGradient id={`mg-${gid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="0.5" stopColor={m3} stopOpacity="0.7" />
              <stop offset="1" stopColor={m1} stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="46" fill="none" stroke={`url(#mg-${gid})`} strokeWidth="2.4" strokeLinecap="round" strokeDasharray="170 300" />
          <circle cx="50" cy="50" r="36" fill="none" stroke="rgb(255 255 255 / 0.14)" strokeWidth="1" strokeDasharray="2 5" />
          <circle cx="96" cy="50" r="3" fill="#ffffff" className="monogram-spark" />
        </svg>
      )}
      <span className="monogram-core relative flex items-center justify-center rounded-full" style={{ width: size * 0.52, height: size * 0.52 }}>
        <Icon className="monogram-icon text-white" style={{ width: size * 0.3, height: size * 0.3 }} strokeWidth={1.8} />
      </span>
      <span className="monogram-sweep" />
    </span>
  );
}
