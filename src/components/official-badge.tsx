import { BadgeCheck } from "lucide-react";

/** Compte officiel de l'équipe LinkProB2B (entreprise interne et vérifiée). */
export const isOfficial = (c: { is_internal?: boolean | null; verified_at?: string | null } | null | undefined) => Boolean(c?.is_internal && c?.verified_at);

export function OfficialBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-teal-50 to-sky px-2.5 py-0.5 align-middle text-xs font-bold text-teal-800 ring-1 ring-teal/30 ${className}`} data-testid="official-badge">
      <BadgeCheck className="size-3.5 text-teal-700" aria-hidden /> Compte officiel LinkProB2B
    </span>
  );
}
