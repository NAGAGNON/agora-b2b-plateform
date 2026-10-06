import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DEMO_BANNER, DEMO_NOTICE } from "@/lib/constants";

export function DemoBadge() {
  return (
    <Badge tone="amber" icon={<FlaskConical className="size-3" aria-hidden />}>
      <span title={DEMO_NOTICE}>Démo</span>
    </Badge>
  );
}

export function DemoBanner() {
  return (
    <div className="bg-amber-100 text-amber-950">
      <p className="container-page flex items-center justify-center gap-2 py-1.5 text-center text-xs font-medium sm:text-sm">
        <FlaskConical className="size-4 shrink-0" aria-hidden />
        Version de test — {DEMO_BANNER}
      </p>
    </div>
  );
}
