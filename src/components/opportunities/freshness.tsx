import { RefreshCw } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { PlatformStats } from "@/lib/queries/platform";

const nf = (n: number) => n.toLocaleString("fr-FR");

/**
 * Bandeau de fraîcheur des données : nouvelles opportunités et dernière
 * synchronisation (chiffres réels issus de la base, jamais estimés).
 */
export function FreshnessBar({ stats, className = "" }: { stats: PlatformStats | null; className?: string }) {
  if (!stats) return null;
  const items = [
    stats.new_24h > 0 ? `${nf(stats.new_24h)} nouvelle${stats.new_24h > 1 ? "s" : ""} en 24 h` : null,
    stats.new_7d > 0 ? `${nf(stats.new_7d)} ajoutée${stats.new_7d > 1 ? "s" : ""} sur 7 jours` : null,
    stats.last_sync_at ? `dernière mise à jour le ${formatDateTime(stats.last_sync_at)}` : null,
  ].filter(Boolean);
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600 ${className}`}>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-0.5 font-semibold text-teal-700 ring-1 ring-teal/30">
        <RefreshCw className="size-3.5" aria-hidden /> Données actualisées quotidiennement
      </span>
      {items.length > 0 && <span>{items.join(" · ")}</span>}
      {stats.sources.length > 0 && <span className="text-slate-500">· Sources : {stats.sources.join(", ")} et entreprises inscrites</span>}
    </p>
  );
}
