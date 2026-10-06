import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DemoBadge } from "@/components/demo";
import { COMPANY_KIND_LABELS, sectorLabel, type CompanyKind } from "@/lib/constants";
import { getSectorLabels } from "@/lib/queries/platform";
import { initials } from "@/lib/format";
import { logoUrl } from "@/lib/storage-urls";

export type CompanyCardData = {
  slug: string;
  name: string;
  kind: CompanyKind;
  city: string | null;
  department_code: string | null;
  logo_path: string | null;
  tagline: string | null;
  sectors: string[];
  skills: string[];
  verified: boolean;
  is_demo: boolean;
};

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

export async function CompanyCard({ c }: { c: CompanyCardData }) {
  const labels = await getSectorLabels();
  return (
    <article className="group relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal hover:shadow-md">
      <div className="flex items-start gap-4">
        <CompanyLogo name={c.name} path={c.logo_path} />
        <div className="min-w-0">
          <h3 className="flex items-center gap-1 text-lg leading-snug font-bold">
            <Link href={`/entreprises/${c.slug}`} className="after:absolute after:inset-0 group-hover:text-teal-700">
              {c.name}
            </Link>
            {c.verified && <BadgeCheck className="size-5 shrink-0 text-teal-600" aria-label="Entreprise vérifiée" />}
          </h3>
          <p className="text-sm text-slate-500">{COMPANY_KIND_LABELS[c.kind]}</p>
        </div>
      </div>
      {c.tagline && <p className="mt-3 line-clamp-2 text-sm text-slate-600">{c.tagline}</p>}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {c.is_demo && <DemoBadge />}
        {c.sectors.slice(0, 2).map((s) => (
          <Badge key={s} tone="sky">
            {sectorLabel(s, labels)}
          </Badge>
        ))}
      </div>
      {c.skills.length > 0 && <p className="mt-3 line-clamp-2 text-xs text-slate-500">{c.skills.slice(0, 6).join(" · ")}</p>}
      {c.city && (
        <p className="mt-auto flex items-center gap-1.5 pt-4 text-sm text-slate-600">
          <MapPin className="size-4 text-slate-400" aria-hidden />
          {c.city}
          {c.department_code ? ` (${c.department_code})` : ""}
        </p>
      )}
    </article>
  );
}
