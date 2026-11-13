import Link from "next/link";
import { Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

/**
 * Invitation discrète à affiner ses alertes : affichée seulement si le membre n'a encore aucune
 * alerte précise (plusieurs métiers ou départements, exclusions, acheteurs, budget, délai, CPV).
 */
export async function PreciseAlertPrompt({ userId }: { userId: string }) {
  const { data } = await (await createClient())
    .from("alerts")
    .select("extra_sectors, extra_departments, exclude_keywords, buyer_terms, min_budget, min_days_left, cpv_prefixes")
    .eq("user_id", userId);
  const list = data ?? [];
  const hasPrecise = list.some(
    (a) => a.extra_sectors.length + a.extra_departments.length + a.buyer_terms.length + a.cpv_prefixes.length > 0 || a.exclude_keywords || a.min_budget != null || a.min_days_left != null,
  );
  if (hasPrecise) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-gradient-to-r from-teal-50 to-sky px-4 py-3 text-sm text-slate-700 ring-1 ring-teal/25">
      <Target className="size-4 shrink-0 text-teal-700" aria-hidden />
      <span className="flex-1">
        {list.length ? "Recevez uniquement les offres qui vous intéressent vraiment : " : "Ne ratez plus les offres de votre métier : "}
        plusieurs métiers et départements, mots à exclure, acheteurs, budget, délai pour répondre.
      </span>
      <Link href="/dashboard/alertes" className="font-semibold text-teal-700 hover:underline">
        {list.length ? "Créer une alerte précise" : "Créer mon alerte"}
      </Link>
    </p>
  );
}
