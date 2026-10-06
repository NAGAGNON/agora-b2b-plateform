import { ExternalLink, Landmark, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OPPORTUNITY_TYPE_LABELS, type OpportunityOrigin, type OpportunityType } from "@/lib/constants";

/** Type d'opportunité. */
export function OpportunityTypeBadge({ type }: { type: OpportunityType }) {
  const tone = type === "PUBLIC_TENDER" ? "violet" : type === "EXTERNAL_OPPORTUNITY" ? "slate" : type === "PRIVATE_TENDER" ? "navy" : "sky";
  return <Badge tone={tone}>{OPPORTUNITY_TYPE_LABELS[type]}</Badge>;
}

/**
 * Badge de provenance — règle absolue : une opportunité externe est toujours
 * identifiée comme telle, jamais présentée comme publiée par un membre.
 */
export function OriginBadge({ origin, type }: { origin: OpportunityOrigin; type?: OpportunityType }) {
  if (origin === "EXTERNAL") {
    return (
      <Badge tone="amber" icon={type === "PUBLIC_TENDER" ? <Landmark className="size-3" aria-hidden /> : <ExternalLink className="size-3" aria-hidden />}>
        Opportunité externe référencée
      </Badge>
    );
  }
  return (
    <Badge tone="teal" icon={<Building2 className="size-3" aria-hidden />}>
      Besoin publié sur LinkProB2B
    </Badge>
  );
}
