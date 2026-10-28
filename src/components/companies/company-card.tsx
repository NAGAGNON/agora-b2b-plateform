import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DemoBadge } from "@/components/demo";
import { COMPANY_KIND_LABELS, sectorLabel, type CompanyKind } from "@/lib/constants";
import { getSectorLabels } from "@/lib/queries/platform";
import { CompanyLogo } from "@/components/companies/company-logo";

export { CompanyLogo };

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


export async function CompanyCard({ c }: { c: CompanyCardData }) {
  const labels = await getSectorLabels();
  return (
    <article className="group reveal glow-card relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
          <MapPin className="size-4 text-slate-500" aria-hidden />
          {c.city}
          {c.department_code ? ` (${c.department_code})` : ""}
        </p>
      )}
    </article>
  );
}
