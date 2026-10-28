import { ExternalLink, Landmark, Building2 } from "lucide-react";
import { OPPORTUNITY_TYPE_LABELS, type OpportunityOrigin, type OpportunityType } from "@/lib/constants";

const label = "inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide whitespace-nowrap uppercase";

/** Type d'opportunité (libellé discret, même style que les cartes et la fiche). */
export function OpportunityTypeBadge({ type }: { type: OpportunityType }) {
  return <span className={`${label} text-slate-500`}>{OPPORTUNITY_TYPE_LABELS[type]}</span>;
}

/**
 * Provenance — règle absolue : une opportunité externe est toujours
 * identifiée comme telle, jamais présentée comme publiée par un membre.
 */
export function OriginBadge({ origin, type }: { origin: OpportunityOrigin; type?: OpportunityType }) {
  if (origin === "EXTERNAL") {
    return (
      <span className={`${label} text-slate-500`}>
        {type === "PUBLIC_TENDER" ? <Landmark className="size-3.5" aria-hidden /> : <ExternalLink className="size-3.5" aria-hidden />}
        Opportunité externe
      </span>
    );
  }
  return (
    <span className={`${label} text-teal-700`}>
      <Building2 className="size-3.5" aria-hidden />
      Besoin publié sur LinkProB2B
    </span>
  );
}
