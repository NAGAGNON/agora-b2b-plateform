import Link from "next/link";
import { Info } from "lucide-react";
import { OpportunityTypeBadge, OriginBadge } from "@/components/opportunities/opportunity-badge";
import { DemoBadge } from "@/components/demo";
import { sectorLabel, type OpportunityOrigin, type OpportunityType } from "@/lib/constants";
import { deadlineLabel } from "@/lib/format";

export type Recommendation = {
  id: string;
  title: string;
  type: OpportunityType;
  origin: OpportunityOrigin;
  sector_slug: string | null;
  city: string | null;
  response_deadline: string | null;
  is_demo: boolean;
  score: number;
  reasons: string[];
};

/** Barème affiché à l'utilisateur : la recommandation est explicable, sans boîte noire. */
export const SCORING_RULES = [
  ["Secteur de votre profil", 30],
  ["Dans votre zone d'intervention (ou votre département : 15)", 25],
  ["Compétences communes (10 par compétence)", 30],
  ["Mots-clés de vos compétences dans l'annonce", 10],
  ["Proche de vos favoris, intérêts et pipeline", 10],
  ["Taille d'entreprise visée", 5],
] as const;

export function RecommendationList({ items, sectorLabels }: { items: Recommendation[]; sectorLabels: Record<string, string> }) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((o) => (
        <li key={o.id} className="px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-1.5">
                <OriginBadge origin={o.origin} type={o.type} />
                {o.type !== "EXTERNAL_OPPORTUNITY" && <OpportunityTypeBadge type={o.type} />}
                {o.is_demo && <DemoBadge />}
              </div>
              <Link href={`/opportunites/${o.id}`} className="mt-1 block font-semibold text-navy hover:text-teal-700">
                {o.title}
              </Link>
              <p className="text-xs text-slate-500">
                {[o.city, o.sector_slug && sectorLabel(o.sector_slug, sectorLabels), deadlineLabel(o.response_deadline)].filter(Boolean).join(" · ")}
              </p>
            </div>
            <p className="shrink-0 text-sm font-bold text-teal-700" aria-label={`Pertinence : ${o.score} sur 100`}>
              {o.score}
              <span className="text-xs font-normal text-slate-500"> / 100</span>
            </p>
          </div>
          <details className="mt-2 text-sm">
            <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-teal-700">
              <Info className="size-3.5" aria-hidden /> Pourquoi cette opportunité vous est proposée
            </summary>
            <ul className="mt-1 list-disc pl-5 text-slate-600">
              {o.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </details>
        </li>
      ))}
    </ul>
  );
}
