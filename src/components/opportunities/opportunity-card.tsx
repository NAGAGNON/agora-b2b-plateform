import Link from "next/link";
import { BadgeCheck, Building2, CalendarClock, ExternalLink, Landmark, MapPin, Tag } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { DemoBadge } from "@/components/demo";
import { CompanyLogo } from "@/components/companies/company-logo";
import { SectorVisual } from "@/components/opportunities/sector-visual";
import { OPPORTUNITY_TYPE_LABELS, sectorLabel, type OpportunityOrigin, type OpportunityType } from "@/lib/constants";
import { getLocationLabel, getSectorLabels } from "@/lib/queries/platform";
import { deadlineLabel, formatBudget, formatDate, isRecent } from "@/lib/format";

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
  company_logo_path?: string | null;
  external_buyer_name?: string | null;
  source_name?: string | null;
  is_demo: boolean;
  distance_km?: number | null;
};

export async function OpportunityCard({ o, headingLevel = 3 }: { o: OpportunityCardData; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  const budget = formatBudget(o.budget_min ?? null, o.budget_max ?? null);
  const deadline = deadlineLabel(o.response_deadline);
  const closed = o.effective_status && o.effective_status !== "PUBLISHED";
  const by = o.origin === "EXTERNAL" ? o.external_buyer_name : o.company_name;
  const isNew = isRecent(o.published_at) && !closed;
  const sector = o.sector_slug ? sectorLabel(o.sector_slug, await getSectorLabels()) : null;
  const urgent = Boolean(deadline && !closed && (deadline === "Dernier jour" || /^Encore [1-7] jours?$/.test(deadline)));
  // Résumé des sources externes souvent préfixé par l'acheteur (« OPCO SANTE — Marché de services ») : pas de doublon
  const summary = o.summary && by && o.summary.startsWith(by) ? o.summary.slice(by.length).replace(/^\s*[—–-]\s*/, "") || null : o.summary;
  const typeLabel = o.type !== "EXTERNAL_OPPORTUNITY" ? OPPORTUNITY_TYPE_LABELS[o.type] : null;
  return (
    <article className="group reveal relative flex h-full flex-col glow-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <SectorVisual sector={o.sector_slug} className="size-11 shrink-0 rounded-xl sm:size-12" />
        <div className="min-w-0 flex-1">
          {/* Provenance toujours indiquée : externe (source) ou besoin publié par un membre */}
          <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            {o.origin === "EXTERNAL" ? (
              <>
                {o.type === "PUBLIC_TENDER" ? <Landmark className="size-3.5" aria-hidden /> : <ExternalLink className="size-3.5" aria-hidden />}
                <span>{typeLabel ?? "Opportunité externe"}</span>
                <span aria-hidden>·</span>
                <span className="sr-only">Opportunité externe référencée, source :</span>
                <span>{o.source_name ?? "Source externe"}</span>
              </>
            ) : (
              <>
                <Building2 className="size-3.5 text-teal-700" aria-hidden />
                <span className="text-teal-700">Besoin publié sur LinkProB2B</span>
                {typeLabel && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{typeLabel}</span>
                  </>
                )}
              </>
            )}
            {isNew && <span className="ml-1 rounded-full bg-teal-50 px-1.5 py-px text-[10px] font-bold tracking-normal text-teal-700 normal-case ring-1 ring-teal/30">Nouveau</span>}
          </p>
          {(closed || o.is_demo) && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {closed && <StatusBadge kind="opportunity" status={o.effective_status!} />}
              {o.is_demo && <DemoBadge />}
            </div>
          )}
          <H className="mt-1 line-clamp-3 text-[15px] leading-snug font-semibold text-navy [overflow-wrap:anywhere] sm:text-base">
            <Link href={`/opportunites/${o.id}`} title={o.title} className="after:absolute after:inset-0 group-hover:text-teal-700 focus:outline-none">
              {o.title}
            </Link>
          </H>
          {by && (
            <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-slate-600">
              {o.origin === "EXTERNAL" && <span className="sr-only">Acheteur : </span>}
              {o.origin === "INTERNAL" && o.company_logo_path && <CompanyLogo name={by} path={o.company_logo_path} size={20} />}
              <span className="truncate">{by}</span>
              {o.origin === "INTERNAL" && o.company_verified && <BadgeCheck className="size-4 shrink-0 text-teal-600" aria-label="Entreprise vérifiée" />}
            </p>
          )}
        </div>
      </div>
      {summary && <p className="mt-3 line-clamp-2 text-sm text-slate-600 [overflow-wrap:anywhere]">{summary}</p>}
      <dl className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-4 text-[13px] text-slate-600">
        {(o.city || o.department_code) && (
          <div className="flex min-w-0 items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0 text-slate-400" aria-hidden />
            <dt className="sr-only">Localisation</dt>
            <dd className="truncate">
              {(await getLocationLabel())(o.city, o.department_code)}
              {o.distance_km != null && <span className="text-slate-500"> · {Math.round(o.distance_km)} km</span>}
            </dd>
          </div>
        )}
        {sector && (
          <div className="flex min-w-0 items-center gap-1.5">
            <Tag className="size-3.5 shrink-0 text-slate-400" aria-hidden />
            <dt className="sr-only">Secteur</dt>
            <dd className="truncate">{sector}</dd>
          </div>
        )}
      </dl>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
        {deadline ? (
          <span className="flex items-center gap-1.5">
            <CalendarClock className="size-3.5 shrink-0" aria-hidden />
            <span className="sr-only">Échéance : </span>
            <span className={urgent ? "font-semibold text-amber-800" : deadline.startsWith("Encore") ? "font-semibold text-navy" : undefined}>{deadline}</span>
          </span>
        ) : (
          <span>Publiée le {formatDate(o.published_at)}</span>
        )}
        {budget ? <span className="font-semibold text-navy">{budget}</span> : deadline && <span>Publiée le {formatDate(o.published_at)}</span>}
      </div>
    </article>
  );
}
