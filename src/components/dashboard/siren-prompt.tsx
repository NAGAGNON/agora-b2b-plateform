import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

/**
 * Bandeau du tableau de bord : l'entreprise est créée et utilisable sans SIREN, mais on demande de le
 * renseigner (il sert au badge « Entreprise vérifiée », contrôlé dans l'annuaire officiel). Disparaît dès
 * que le SIREN est enregistré.
 */
export async function SirenPrompt({ companyId }: { companyId: string }) {
  const { data } = await (await createClient()).from("companies").select("siren, verified_at, is_demo").eq("id", companyId).maybeSingle();
  if (!data || data.is_demo || data.verified_at || (data.siren && /^\d{9}$/.test(data.siren.replace(/\s/g, "")))) return null;
  return (
    <Link
      href="/dashboard/entreprise#f-siren"
      className="group flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-teal/40 transition hover:shadow-md"
      data-testid="siren-prompt"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal/15 text-teal-700">
        <BadgeCheck className="size-5" aria-hidden />
      </span>
      <span className="flex-1 text-sm text-slate-600">
        <strong className="block text-base text-navy">Ajoutez votre SIREN</strong>
        Votre entreprise est en ligne. Avec votre SIREN (9 chiffres), elle peut recevoir le badge « Entreprise vérifiée », qui rassure vos futurs clients.
      </span>
      <ArrowRight className="size-5 shrink-0 text-teal-700 transition-transform group-hover:translate-x-1" aria-hidden />
    </Link>
  );
}
