import Image from "next/image";
import { initials } from "@/lib/format";
import { logoUrl } from "@/lib/storage-urls";

/** Dégradé stable par entreprise (même nom, même couleur) pour les initiales sans logo. */
const TONES = ["from-navy to-teal-700", "from-navy to-electric", "from-teal-700 to-cyan-500", "from-navy to-violet", "from-slate-700 to-teal-600", "from-navy-900 to-teal-600"];
function tone(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

/** Logo d'une entreprise, ou ses initiales s'il n'y en a pas. Utilisable côté serveur et navigateur. */
export function CompanyLogo({ name, path, size = 56 }: { name: string; path: string | null; size?: number }) {
  const url = logoUrl(path);
  return url ? (
    <Image src={url} alt={`Logo ${name}`} width={size} height={size} className="shrink-0 rounded-xl border border-slate-200 bg-white object-contain" style={{ width: size, height: size }} unoptimized />
  ) : (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br font-heading font-bold text-white ${tone(name)}`} style={{ width: size, height: size, fontSize: size / 2.8 }}>
      {initials(name)}
    </span>
  );
}
