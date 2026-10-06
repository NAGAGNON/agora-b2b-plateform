import Link from "next/link";
import { CalendarClock, MapPin, Tag, BadgeCheck } from "lucide-react";
import { OpportunityTypeBadge, OriginBadge } from "@/components/opportunities/opportunity-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { DemoBadge } from "@/components/demo";
import { SECTOR_LABELS, type OpportunityOrigin, type OpportunityType } from "@/lib/constants";
import { deadlineLabel, formatBudget, formatDate } from "@/lib/format";

export type OpportunityCardData = {
  id: string;
  title: string;
  summary: string | null;
  type: OpportunityType;
  origin: OpportunityOrigin;
  effective_status?: string | null;
  sector_slug: string | null;
  city: string | null;
  department_code?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  response_deadline: string | null;
  published_at: string | null;
  company_name?: string | null;
  company_verified?: boolean | null;
  external_buyer_name?: string | null;
  source_name?: string | null;
  is_demo: boolean;
  distance_km?: number | null;
};

export function OpportunityCard({ o, headingLevel = 3 }: { o: OpportunityCardData; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  const budget = formatBudget(o.budget_min ?? null, o.budget_max ?? null);
  const deadline = deadlineLabel(o.response_deadline);
  const closed = o.effective_status && o.effective_status !== "PUBLISHED";
  const by = o.origin === "EXTERNAL" ? (o.source_name ? `Source : ${o.source_name}` : "Source externe") : o.company_name;
  return (
    <article className="group relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal hover:shadow-md">
      <div className="flex flex-wrap items-center gap-1.5">
        <OriginBadge origin={o.origin} type={o.type} />
        {o.type !== "EXTERNAL_OPPORTUNITY" && <OpportunityTypeBadge type={o.type} />}
        {closed && <StatusBadge kind="opportunity" status={o.effective_status!} />}
        {o.is_demo && <DemoBadge />}
      </div>
      <H className="mt-3 text-lg leading-snug font-bold">
        <Link href={`/opportunites/${o.id}`} className="after:absolute after:inset-0 group-hover:text-teal-700 focus:outline-none">
          {o.title}
        </Link>
      </H>
      {by && (
        <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
          {by}
          {o.origin === "INTERNAL" && o.company_verified && <BadgeCheck className="size-4 text-teal-600" aria-label="Entreprise vérifiée" />}
        </p>
      )}
      {o.summary && <p className="mt-2 line-clamp-3 text-sm text-slate-600">{o.summary}</p>}
      <dl className="mt-auto grid gap-1.5 pt-4 text-sm text-slate-600">
        {(o.city || o.department_code) && (
          <div className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0 text-slate-400" aria-hidden />
            <dt className="sr-only">Localisation</dt>
            <dd>
              {o.city ?? ""}
              {o.department_code ? ` (${o.department_code})` : ""}
              {o.distance_km != null && <span className="text-slate-400"> · {Math.round(o.distance_km)} km</span>}
            </dd>
          </div>
        )}
        {o.sector_slug && (
          <div className="flex items-center gap-2">
            <Tag className="size-4 shrink-0 text-slate-400" aria-hidden />
            <dt className="sr-only">Secteur</dt>
            <dd>{SECTOR_LABELS[o.sector_slug] ?? o.sector_slug}</dd>
          </div>
        )}
        {deadline && (
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4 shrink-0 text-slate-400" aria-hidden />
            <dt className="sr-only">Échéance</dt>
            <dd className={deadline.startsWith("Encore") || deadline === "Dernier jour" ? "font-semibold text-navy" : undefined}>{deadline}</dd>
          </div>
        )}
      </dl>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>Publiée le {formatDate(o.published_at)}</span>
        {budget && <span className="font-semibold text-navy">{budget}</span>}
      </div>
    </article>
  );
}
