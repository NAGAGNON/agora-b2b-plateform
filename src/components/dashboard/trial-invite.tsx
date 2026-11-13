import Link from "next/link";
import { ArrowRight, Rocket } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cardTrial } from "@/lib/billing/card-trial";
import { companyPlan } from "@/lib/billing/entitlements";

/**
 * Lancement payant : invitation des membres déjà inscrits (offre Gratuite) à essayer Pro 7 jours.
 * N'apparaît que lorsque l'essai est ouvert, jamais pour une entreprise déjà abonnée ou en essai,
 * ni pour les membres pionniers (Pro déjà offert).
 */
export async function TrialInvite({ userId, companyId }: { userId: string; companyId: string | null }) {
  if (!companyId) return null;
  const trial = await cardTrial();
  if (!trial.enabled) return null;
  const supabase = await createClient();
  const [plan, { data: pioneer }] = await Promise.all([companyPlan(companyId), supabase.from("pioneer_rewards").select("user_id").eq("user_id", userId).maybeSingle()]);
  if (plan !== "FREE" || pioneer) return null;
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-navy p-5 text-white sm:flex-row sm:items-center" data-testid="trial-invite">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal to-electric">
        <Rocket className="size-6" aria-hidden />
      </span>
      <div className="flex-1">
        <p className="font-semibold">Nouveau : les offres Pro et Business sont ouvertes</p>
        <p className="text-sm text-slate-300">
          Essayez Pro {trial.days} jours, sans engagement : fiche synthèse de chaque appel d&apos;offres, besoins en avant-première, alertes illimitées. Rien n&apos;est débité
          avant la fin de l&apos;essai.
        </p>
      </div>
      <Link href="/essai" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-teal px-5 py-3 font-semibold text-navy transition hover:bg-teal-400">
        Essayer {trial.days} jours <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
