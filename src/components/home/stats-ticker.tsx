import { RefreshCw } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { PlatformStats } from "@/lib/queries/platform";

const nf = (n: number) => n.toLocaleString("fr-FR");

/**
 * Bande défilante des chiffres réels de la plateforme (base de données, jamais estimés).
 * Défilement en boucle, arrêté au survol ; sans animation si le système le demande.
 */
export function StatsTicker({ stats }: { stats: PlatformStats | null }) {
  if (!stats || !stats.active) return null;
  const items = [
    `${nf(stats.active)} opportunités ouvertes`,
    stats.new_24h > 0 ? `${nf(stats.new_24h)} nouvelles en 24 h` : null,
    stats.new_7d > 0 ? `${nf(stats.new_7d)} ajoutées ces 7 derniers jours` : null,
    stats.regions ? `${nf(stats.regions)} régions couvertes` : null,
    stats.departments ? `${nf(stats.departments)} départements couverts` : null,
    stats.last_sync_at ? `Mise à jour le ${formatDateTime(stats.last_sync_at)}` : null,
    stats.sources.length ? `Sources : ${stats.sources.join(", ")} et entreprises inscrites` : null,
  ].filter((x): x is string => Boolean(x));
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {items.map((t) => (
        <li key={t} className="flex items-center gap-3 px-5 text-sm whitespace-nowrap">
          <span className="size-1.5 rounded-full bg-teal" aria-hidden /> {t}
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label="Activité de la plateforme" className="border-b border-white/10 bg-navy-900 text-slate-200">
      <div className="flex items-center">
        <p className="z-10 flex shrink-0 items-center gap-1.5 bg-teal px-3 py-2 text-xs font-bold tracking-wide text-navy uppercase">
          <RefreshCw className="size-3.5" aria-hidden /> En direct
        </p>
        <div className="flex-1 overflow-hidden py-2 motion-reduce:overflow-x-auto">
          <div className="flex w-max animate-ticker hover:[animation-play-state:paused] motion-reduce:animate-none">
            {row(false)}
            {row(true)}
          </div>
        </div>
      </div>
    </section>
  );
}
