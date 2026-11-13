import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { freeLaunch } from "@/lib/billing/entitlements";

/**
 * Proposition de l'offre « Visibilité » (entreprise ou besoin publié) : discrète, une seule ligne, tant
 * qu'aucune demande n'a été faite pour cette cible.
 */
export async function VisibilityPrompt({ companyId, opportunityId }: { companyId: string; opportunityId?: string }) {
  const supabase = await createClient();
  let q = supabase.from("visibility_boosts").select("id", { count: "exact", head: true }).eq("company_id", companyId);
  q = opportunityId ? q.eq("opportunity_id", opportunityId) : q.is("opportunity_id", null);
  const [{ count }, free] = await Promise.all([q, freeLaunch()]);
  if (count) return null;
  return (
    <Link
      href={`/dashboard/visibilite${opportunityId ? `?cible=${opportunityId}` : ""}`}
      className="group flex items-center gap-4 rounded-2xl bg-gradient-to-r from-navy to-navy-900 p-4 text-white shadow-md transition hover:shadow-xl"
      data-testid="visibility-prompt"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal text-navy">
        <Megaphone className="size-5" aria-hidden />
      </span>
      <span className="flex-1 text-sm">
        <strong className="block text-base">{opportunityId ? "Faites connaître votre besoin à plus d'entreprises" : "Faites connaître votre entreprise"}</strong>
        <span className="text-slate-300">
          {opportunityId ? "Choisissez combien d'entreprises du métier sont prévenues chaque jour, et affichez-le « À la une »." : "Présentation chaque jour à des entreprises ciblées et affichage « À la une » de l'annuaire."}
          {free && " Gratuit pendant la phase de lancement."}
        </span>
      </span>
      <ArrowRight className="size-5 shrink-0 text-teal transition-transform group-hover:translate-x-1" aria-hidden />
    </Link>
  );
}
