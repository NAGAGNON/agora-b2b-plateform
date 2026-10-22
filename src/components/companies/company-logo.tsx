import Image from "next/image";
import { initials } from "@/lib/format";
import { logoUrl } from "@/lib/storage-urls";

/** Logo d'une entreprise, ou ses initiales s'il n'y en a pas. Utilisable côté serveur et navigateur. */
export function CompanyLogo({ name, path, size = 56 }: { name: string; path: string | null; size?: number }) {
  const url = logoUrl(path);
  return url ? (
    <Image src={url} alt={`Logo ${name}`} width={size} height={size} className="shrink-0 rounded-xl border border-slate-200 bg-white object-contain" style={{ width: size, height: size }} unoptimized />
  ) : (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-xl bg-navy font-heading font-bold text-white" style={{ width: size, height: size, fontSize: size / 2.8 }}>
      {initials(name)}
    </span>
  );
}
