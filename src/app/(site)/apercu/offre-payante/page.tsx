import { Bell, MessageSquare } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { PRIVATE_METADATA } from "@/lib/seo";
import { CreditBadge, CreditSummaryCard, FreeWelcome, LegacyLaunchBanner, OutOfCredits, PlanChoice, SubscriptionCredits, TrialSummary } from "@/components/billing/credits";

export const metadata = { ...PRIVATE_METADATA, title: "Aperçu de l'offre payante" };

const day = (n: number) => new Date(Date.UTC(2026, 11, 26 + n, 9, 30)).toISOString();

/**
 * Aperçu, réservé à l'équipe, des écrans de l'offre par crédits tels que les clients les verront au
 * lancement (exemples de chiffres). Rien de tout cela n'est visible par les clients aujourd'hui.
 */
export default async function OfferPreviewPage() {
  await requireStaff();
  const frame = (id: string, title: string, children: React.ReactNode) => (
    <section id={id} className="scroll-mt-20" data-shot={id}>
      <p className="mb-3 text-xs font-bold tracking-wide text-slate-500 uppercase">{title}</p>
      {children}
    </section>
  );
  return (
    <div className="bg-slate-50/60">
      <div className="container-page space-y-14 py-8 sm:py-12">
        <p className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-900 ring-1 ring-violet-200">Aperçu réservé à l&apos;équipe : chiffres d&apos;exemple, aucun client ne voit ces écrans tant que l&apos;offre payante n&apos;est pas lancée.</p>

        {frame("choix", "1. Après l'inscription : choisir sa formule", <PlanChoice companyName="Durand Maintenance" />)}

        {frame("bienvenue", "2. S'il choisit Gratuit", <FreeWelcome renewsAt={day(0)} />)}

        {frame("essai", "3. S'il choisit Pro ou Business : l'essai de 3 jours", <div className="grid gap-5 lg:grid-cols-2"><TrialSummary plan="PRO" start={day(-30)} /><TrialSummary plan="BUSINESS" start={day(-30)} /></div>)}

        {frame(
          "solde",
          "4. Le solde, toujours visible en haut à côté du nom",
          <div className="space-y-5">
            <div className="flex h-16 items-center gap-2 rounded-2xl bg-white px-4 shadow-sm ring-1 ring-slate-200">
              <span className="font-heading text-lg font-extrabold text-navy">
                LinkPro<span className="text-teal">B2B</span>
              </span>
              <span className="ml-auto flex items-center gap-1 sm:gap-2">
                <CreditBadge balance={4} unlimited={false} />
                <MessageSquare className="mx-1 size-5 text-navy" aria-hidden />
                <Bell className="mx-1 size-5 text-navy" aria-hidden />
                <span className="hidden items-center gap-2 rounded-full bg-slate-100 py-1 pr-3 pl-1 text-sm font-semibold text-navy sm:flex">
                  <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-teal to-electric text-xs font-bold">MD</span> Morgan Durand
                </span>
              </span>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              <CreditSummaryCard plan="FREE" balance={4} perPeriod={5} renewsAt={day(0)} />
              <CreditSummaryCard plan="PRO" balance={13} perPeriod={20} renewsAt={day(0)} />
              <CreditSummaryCard plan="BUSINESS" balance={null} perPeriod={null} renewsAt={day(0)} />
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <span className="text-sm text-slate-600">Plus de crédit :</span>
              <CreditBadge balance={0} unlimited={false} />
              <span className="text-sm text-slate-600">Business :</span>
              <CreditBadge balance={null} unlimited />
            </div>
          </div>,
        )}

        {frame(
          "epuises",
          "5. La seule fenêtre : plus de crédit au moment de commencer une candidature",
          <div className="space-y-8 rounded-[2rem] bg-navy/60 p-4 sm:p-10">
            <OutOfCredits plan="FREE" renewsAt={day(0)} trialEligible founder={false} />
            <OutOfCredits plan="PRO" renewsAt={day(0)} trialEligible={false} founder={false} />
          </div>,
        )}

        {frame("anciens", "6. Anciens inscrits, le jour du lancement (tableau de bord)", <LegacyLaunchBanner until={day(-26 + 3)} />)}

        {frame(
          "fondateur",
          "7. Ancien inscrit sans crédit : Pro au tarif fondateur",
          <div className="rounded-[2rem] bg-navy/60 p-4 sm:p-10">
            <OutOfCredits plan="FREE" renewsAt={day(0)} trialEligible={false} founder />
          </div>,
        )}

        {frame(
          "abonnement",
          "8. Mon abonnement",
          <SubscriptionCredits
            plan="FREE"
            balance={3}
            perPeriod={5}
            renewsAt={day(0)}
            lines={[
              { at: day(-9), label: "Candidature : Entretien des espaces verts — Ville de Brest", amount: -1, balance: 3 },
              { at: day(-14), label: "Candidature : Nettoyage des locaux — CHU de Rennes", amount: -1, balance: 4 },
              { at: day(-30), label: "Crédits du mois (Gratuit)", amount: 5, balance: 5 },
            ]}
          />,
        )}
      </div>
    </div>
  );
}
