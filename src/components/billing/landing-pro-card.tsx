import Link from "next/link";
import { BellRing, FileText, Trophy } from "lucide-react";
import { getSession } from "@/lib/auth";
import { companyPlan, freeLaunch, isPaid } from "@/lib/billing/entitlements";
import { FOUNDER_PRICE_HT, REGULAR_PRICE_HT, founderOffer, founderOpen, founderSeatsTaken, seatsLeft } from "@/lib/billing/founder";
import { formatEuros } from "@/lib/billing/plans";

/**
 * Offre Pro au bon moment, sur les pages métier × département (celles qui transforment le mieux) :
 * ce que Pro apporte pour CE métier ici. EN SOMMEIL pendant la phase gratuite : n'apparaît qu'une fois
 * le lancement payant décidé (interrupteur « billing.free_launch » coupé), jamais pour un abonné Pro.
 */
export async function LandingProCard({ label, total }: { label: string; total: number }) {
  if (await freeLaunch()) return null;
  const session = await getSession();
  const companyId = session?.activeCompany?.company.id;
  if (companyId && isPaid(await companyPlan(companyId))) return null;
  const offer = await founderOffer();
  const founder = founderOpen(offer) && seatsLeft(offer, await founderSeatsTaken()) > 0;
  const href = founder ? "/offre-fondateur" : session ? "/dashboard/abonnement" : "/inscription?suite=/tarifs";
  return (
    <section className="mt-8 overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-navy-900 p-6 text-white shadow-lg sm:p-8" aria-labelledby="pro-here" data-testid="landing-pro">
      <p className="text-xs font-bold tracking-wide text-teal-400 uppercase">Pour répondre avant les autres</p>
      <h2 id="pro-here" className="mt-1 font-heading text-xl font-extrabold text-white sm:text-2xl">
        {total.toLocaleString("fr-FR")} marché{total > 1 ? "s" : ""} « {label} » ouvert{total > 1 ? "s" : ""}. Avec Pro, ne ratez plus les suivants.
      </h2>
      <ul className="mt-4 grid gap-3 text-sm text-slate-200 sm:grid-cols-3">
        <li className="flex gap-2">
          <BellRing className="mt-0.5 size-4 shrink-0 text-teal-400" aria-hidden /> Les nouveaux marchés de votre métier, le jour même de leur publication
        </li>
        <li className="flex gap-2">
          <FileText className="mt-0.5 size-4 shrink-0 text-teal-400" aria-hidden /> La fiche synthèse de chaque marché : l&apos;essentiel en 30 secondes
        </li>
        <li className="flex gap-2">
          <Trophy className="mt-0.5 size-4 shrink-0 text-teal-400" aria-hidden /> Le résultat surveillé pour vous, sans aller vérifier
        </li>
      </ul>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link href={href} className="inline-flex items-center rounded-xl bg-teal px-5 py-3 font-semibold text-navy transition hover:bg-teal-300">
          {founder ? `Pro à ${formatEuros(FOUNDER_PRICE_HT)} HT/mois les 3 premiers mois` : `Passer à Pro · ${formatEuros(REGULAR_PRICE_HT)} HT/mois`}
        </Link>
        <span className="text-sm text-slate-300">{founder ? `au lieu de ${formatEuros(REGULAR_PRICE_HT)} · sans engagement` : "Sans engagement"}</span>
      </div>
    </section>
  );
}
