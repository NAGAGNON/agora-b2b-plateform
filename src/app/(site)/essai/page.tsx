import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRing, Check, FileText, Rocket, Sparkles, Target } from "lucide-react";
import { requireCompany } from "@/lib/auth";
import { cardTrial, firstChargeDate } from "@/lib/billing/card-trial";
import { yearlyAvailable } from "@/lib/billing/stripe";
import { Notice } from "@/components/ui/notice";
import { TrialCheckout } from "@/components/billing/trial-checkout";
import { getOpenCounts } from "@/lib/queries/platform";

export const metadata: Metadata = { title: "Votre essai gratuit", robots: { index: false } };

const PERKS = [
  { icon: FileText, title: "Chaque appel d'offres résumé", text: "Ce que veut l'acheteur, les critères, les pièces à fournir : en 30 secondes, en PDF ou Word." },
  { icon: Sparkles, title: "Besoins d'entreprises en avant-première", text: "Vous les voyez avant les membres de l'offre Gratuite, et vous êtes proposé en premier." },
  { icon: BellRing, title: "Alertes et veille illimitées", text: "Les nouveaux marchés de votre métier chaque matin, du lundi au vendredi." },
  { icon: Target, title: "Pipeline commercial", text: "Suivez chaque réponse, de la découverte à la signature." },
];

/**
 * Essai de 7 jours avec carte (lancement payant). Visible du public uniquement quand le propriétaire a
 * activé l'essai (société, CGU/CGV et Stripe LIVE validés) ; avant, seule l'équipe en voit l'aperçu.
 */
export default async function TrialPage(props: PageProps<"/essai">) {
  const sp = await props.searchParams;
  const session = await requireCompany("/essai");
  const trial = await cardTrial();
  if (!trial.enabled && !session.isStaff) redirect("/dashboard");
  const plan = sp.offre === "BUSINESS" ? "BUSINESS" : "PRO";
  const count = await getOpenCounts().catch(() => null);
  const total = count ? count("total", "") : 0;
  const first = firstChargeDate(trial.days).toISOString();

  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex justify-center px-4 py-10 sm:px-8 sm:py-14">
        <div className="w-full max-w-lg">
          {!trial.enabled && (
            <Notice tone="warning" title="Aperçu équipe" className="mb-6">
              L&apos;essai n&apos;est pas encore ouvert au public : cette page n&apos;est visible que de l&apos;équipe.
            </Notice>
          )}
          {sp.paiement === "annule" && (
            <Notice tone="info" className="mb-6">
              Paiement non finalisé : rien n&apos;a été enregistré. Vous pouvez reprendre quand vous voulez.
            </Notice>
          )}
          <p className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-800 ring-1 ring-teal-200">
            <Rocket className="size-4" aria-hidden /> Dernière étape
          </p>
          <h1 className="mt-4 font-heading text-3xl leading-tight font-extrabold text-navy sm:text-4xl">
            Profitez de {trial.days} jours <span className="block text-teal-700">gratuits, sans engagement.</span>
          </h1>
          <p className="mt-3 text-slate-600">Choisissez votre offre : rien n&apos;est débité aujourd&apos;hui. Vous pouvez résilier à tout moment avant la fin de l&apos;essai.</p>
          <div className="mt-8">
            <TrialCheckout days={trial.days} firstCharge={first} yearly={yearlyAvailable("PRO")} initialPlan={plan} />
          </div>
          <p className="mt-6 text-center text-sm text-slate-500">
            <Link href="/dashboard?offre=gratuite" className="font-semibold text-slate-600 underline-offset-2 hover:underline">
              Continuer avec l&apos;offre Gratuite (fonctions limitées)
            </Link>
          </p>
        </div>
      </div>
      <aside className="relative isolate hidden overflow-hidden bg-gradient-to-br from-navy via-navy-900 to-navy px-10 py-14 text-white lg:block xl:px-16">
        <div aria-hidden className="absolute -top-24 -right-24 -z-10 size-96 rounded-full bg-teal/25 blur-3xl" />
        <p className="text-sm font-semibold tracking-wide text-teal uppercase">Pendant votre essai</p>
        <h2 className="mt-3 max-w-md font-heading text-3xl leading-tight font-extrabold text-white">Tout ce qu&apos;il faut pour remporter plus de marchés.</h2>
        <ul className="mt-8 max-w-md space-y-5">
          {PERKS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <Icon className="size-5 text-teal" aria-hidden />
              </span>
              <span>
                <span className="block font-semibold text-white">{title}</span>
                <span className="text-sm text-slate-300">{text}</span>
              </span>
            </li>
          ))}
        </ul>
        {total > 0 && (
          <p className="mt-10 flex max-w-md items-center gap-3 rounded-2xl bg-white/5 p-4 text-sm text-slate-200 ring-1 ring-white/10">
            <Check className="size-5 shrink-0 text-teal" aria-hidden />
            <span>
              <strong className="text-white">{total.toLocaleString("fr-FR")} opportunités ouvertes</strong> en ce moment, mises à jour chaque jour (BOAMP, TED et besoins
              d&apos;entreprises).
            </span>
          </p>
        )}
      </aside>
    </div>
  );
}
