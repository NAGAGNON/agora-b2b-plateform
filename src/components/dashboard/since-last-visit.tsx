import Link from "next/link";
import { CalendarClock, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

const DAY = 86_400_000;

/**
 * Bandeau « Depuis votre dernière visite » : nouvelles offres recommandées publiées depuis la visite
 * précédente, et offres suivies (favoris, pipeline) dont la date limite tombe dans les 7 jours.
 * Chiffres réels uniquement ; rien n'est affiché s'il n'y a rien de nouveau.
 */
export async function SinceLastVisit({ userId, companyId, supplier, since, now, includeDemo }: { userId: string; companyId: string; supplier: boolean; since: string | null; now: number; includeDemo: boolean }) {
  const supabase = await createClient();
  const soon = new Date(now + 7 * DAY).toISOString();
  const nowIso = new Date(now).toISOString();
  const [reco, favs, pipe] = await Promise.all([
    supplier && since ? supabase.rpc("recommended_opportunities", { p_company_id: companyId, p_limit: 200, p_include_demo: includeDemo }) : null,
    supabase.from("favorites").select("opportunity:opportunities!inner(id, title, response_deadline, status)").eq("user_id", userId).not("opportunity_id", "is", null).gt("opportunity.response_deadline", nowIso).lte("opportunity.response_deadline", soon).eq("opportunity.status", "PUBLISHED"),
    supabase.from("pipeline_items").select("stage, opportunity:opportunities!inner(id, title, response_deadline, status)").eq("company_id", companyId).not("stage", "in", "(WON,LOST)").gt("opportunity.response_deadline", nowIso).lte("opportunity.response_deadline", soon).eq("opportunity.status", "PUBLISHED"),
  ]);
  const fresh = since ? (reco?.data ?? []).filter((o) => o.published_at && new Date(o.published_at) > new Date(since)) : [];
  type Opp = { id: string; title: string; response_deadline: string };
  const ending = new Map<string, Opp>();
  for (const r of [...(favs.data ?? []), ...(pipe.data ?? [])]) {
    const o = (Array.isArray(r.opportunity) ? r.opportunity[0] : r.opportunity) as Opp | null;
    if (o) ending.set(o.id, o);
  }
  const endingList = [...ending.values()].sort((a, b) => a.response_deadline.localeCompare(b.response_deadline));
  if (!fresh.length && !endingList.length) return null;
  const plural = (n: number, s: string, p: string) => `${n} ${n > 1 ? p : s}`;
  return (
    <section aria-labelledby="depuis-visite" className="rounded-2xl border border-teal-200 bg-teal-50/60 p-5" data-testid="since-last-visit">
      <h2 id="depuis-visite" className="text-sm font-semibold uppercase tracking-wide text-teal-800">
        {since ? `Depuis votre dernière visite (${formatDate(since)})` : "Cette semaine"}
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {fresh.length > 0 && (
          <div>
            <p className="flex items-center gap-2 font-heading text-lg font-bold text-navy">
              <Sparkles className="size-5 text-teal-600" aria-hidden /> {plural(fresh.length, "nouvelle offre pour vous", "nouvelles offres pour vous")}
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {fresh.slice(0, 3).map((o) => (
                <li key={o.id}>
                  <Link href={`/opportunites/${o.id}`} className="font-medium text-teal-800 hover:underline">
                    {o.title}
                  </Link>
                  {o.response_deadline && <span className="text-slate-500"> · avant le {formatDate(o.response_deadline)}</span>}
                </li>
              ))}
            </ul>
            <Link href="/dashboard/recommandations" className="mt-2 inline-block text-sm font-semibold text-teal-700 hover:underline">
              Voir toutes mes recommandations →
            </Link>
          </div>
        )}
        {endingList.length > 0 && (
          <div>
            <p className="flex items-center gap-2 font-heading text-lg font-bold text-navy">
              <CalendarClock className="size-5 text-amber-600" aria-hidden /> {plural(endingList.length, "offre suivie se termine", "offres suivies se terminent")} dans les 7 jours
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {endingList.slice(0, 3).map((o) => (
                <li key={o.id}>
                  <Link href={`/opportunites/${o.id}`} className="font-medium text-teal-800 hover:underline">
                    {o.title}
                  </Link>
                  <span className="text-slate-500"> · avant le {formatDate(o.response_deadline)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
