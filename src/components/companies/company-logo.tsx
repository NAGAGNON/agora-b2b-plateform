import Image from "next/image";
import { initials } from "@/lib/format";
import { logoUrl } from "@/lib/storage-urls";

/** Palettes du monogramme (deux halos + reflet des lettres), choisies de façon stable d'après le nom. */
const PALETTES: [string, string, string][] = [
  ["#14c2ad", "#3b82f6", "#99f6e4"],
  ["#7c6cff", "#14c2ad", "#c4b5fd"],
  ["#06b6d4", "#7c6cff", "#a5f3fc"],
  ["#10b981", "#0ea5e9", "#a7f3d0"],
  ["#3b82f6", "#ec4899", "#bfdbfe"],
  ["#14c2ad", "#a855f7", "#5eead4"],
];

function palette(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

/**
 * Logo d'une entreprise ; sans logo, un monogramme animé (halos de couleur en rotation lente,
 * initiales nacrées). Sans état ni effet : utilisable côté serveur et navigateur.
 */
export function CompanyLogo({ name, path, size = 56 }: { name: string; path: string | null; size?: number }) {
  const url = logoUrl(path);
  if (url)
    return (
      <Image src={url} alt={`Logo ${name}`} width={size} height={size} className="shrink-0 rounded-xl border border-slate-200 bg-white object-contain" style={{ width: size, height: size }} unoptimized />
    );
  const [m1, m2, m3] = palette(name);
  // Identifiant de dégradé propre au nom (plusieurs monogrammes sur une même page)
  const gid = Array.from(name).reduce((h, ch) => (h * 33 + ch.charCodeAt(0)) >>> 0, 5381).toString(36);
  return (
    <span
      aria-hidden
      className="monogram flex shrink-0 items-center justify-center rounded-[28%] font-heading font-extrabold"
      style={{ width: size, height: size, fontSize: size / 2.6, ["--m1" as string]: m1, ["--m2" as string]: m2, ["--m3" as string]: m3 }}
    >
      <svg viewBox="0 0 100 100" className="monogram-ring absolute inset-[9%] size-[82%]" aria-hidden>
        <defs>
          <linearGradient id={`mg-${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="0.5" stopColor={m3} stopOpacity="0.7" />
            <stop offset="1" stopColor={m1} stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="46" fill="none" stroke={`url(#mg-${gid})`} strokeWidth="2.2" strokeLinecap="round" strokeDasharray="190 300" />
        <circle cx="50" cy="50" r="38" fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="1" strokeDasharray="2 5" />
        <circle cx="96" cy="50" r="2.6" fill="#ffffff" className="monogram-spark" />
      </svg>
      <span className="monogram-text relative">{initials(name)}</span>
      <span className="monogram-sweep" />
    </span>
  );
}
