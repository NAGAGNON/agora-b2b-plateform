import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSectorLabels, showDemoData } from "@/lib/queries/platform";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { RecommendationList, SCORING_RULES } from "@/components/dashboard/recommendations";
import { hasFullAccess } from "@/lib/billing/entitlements";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { Notice } from "@/components/ui/notice";

const FREE_PREVIEW = 3;

export const metadata = { title: "Recommandations" };

export default async function RecommendationsPage(props: PageProps<"/dashboard/recommandations">) {
  const sp = await props.searchParams;
  const session = await requireSession("/dashboard/recommandations");
  const company = session.activeCompany?.company;
  if (!company) {
    return (
      <EmptyState
        icon={<Sparkles className="size-6" aria-hidden />}
        title="Indiquez votre métier et votre ville"
        description="30 secondes suffisent : les recommandations s'appuient sur votre métier, votre zone et vos compétences."
        action={<ButtonLink href="/onboarding/entreprise?suite=/dashboard/recommandations">Compléter mon profil en 30 secondes</ButtonLink>}
      />
    );
  }
  const supabase = await createClient();
  const free = !(await hasFullAccess(company.id));
  // Fiche sans compétences : le critère le plus fin du score (30 points) ne peut pas jouer
  const { data: prof } = await supabase.from("company_profiles").select("skills").eq("company_id", company.id).maybeSingle();
  const noSkills = !prof?.skills?.length;
  const [{ data, error }, sectorLabels] = await Promise.all([
    // Offre Gratuite : aperçu des premières recommandations seulement (contrôlé côté serveur)
    supabase.rpc("recommended_opportunities", { p_company_id: company.id, p_limit: free ? FREE_PREVIEW : 30, p_include_demo: await showDemoData() }),
    getSectorLabels(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recommandations</h1>
        <p className="mt-1 text-slate-600">
          Opportunités ouvertes classées selon le profil de <strong>{company.name}</strong>. Chaque proposition est expliquée.
        </p>
      </div>
      {sp.bienvenue === "1" && (
        <Notice tone="success" title="Votre profil est prêt">
          Voici les offres ouvertes qui correspondent à votre entreprise, avec la raison de chaque recommandation. Une alerte e-mail est activée pour les
          nouvelles offres de votre métier : vous pouvez la modifier dans « Alertes ». Ajoutez vos compétences dans « Entreprise » pour des recommandations
          encore plus précises.
        </Notice>
      )}
      {noSkills && (
        <Notice tone="info" title="Des recommandations plus précises">
          Ajoutez vos compétences (ex. : couverture, zinguerie, étanchéité) : chaque compétence citée dans une offre la fait remonter.{" "}
          <Link href="/dashboard/entreprise" className="font-semibold text-teal-700 underline">
            Ajouter mes compétences
          </Link>
        </Notice>
      )}
      {free && (
        <UpgradePrompt message={`Offre Gratuite : aperçu des ${FREE_PREVIEW} meilleures recommandations. Avec Pro, accédez à toutes les opportunités « Recommandé pour votre entreprise », avec leur score de pertinence.`} />
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader title={`${data?.length ?? 0} opportunité(s) recommandée(s)`} />
          {error ? (
            <p className="px-5 py-6 text-sm text-red-700">Les recommandations n&apos;ont pas pu être calculées.</p>
          ) : data?.length ? (
            <RecommendationList items={data} sectorLabels={sectorLabels} />
          ) : (
            <p className="px-5 py-6 text-sm text-slate-500">
              Aucune opportunité ne correspond encore à votre profil. Complétez vos secteurs, votre zone et vos compétences dans{" "}
              <Link href="/dashboard/entreprise" className="font-semibold text-teal-700 underline">
                la fiche entreprise
              </Link>
              .
            </p>
          )}
        </Card>
        <Card className="h-fit">
          <CardHeader title="Comment est calculé le score ?" description="Barème transparent, sur 100 points. Aucune donnée n'est vendue ni partagée." />
          <dl className="space-y-2 px-5 pb-5 text-sm">
            {SCORING_RULES.map(([label, pts]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-slate-600">{label}</dt>
                <dd className="shrink-0 font-semibold text-navy">+{pts}</dd>
              </div>
            ))}
          </dl>
          <p className="px-5 pb-5 text-xs text-slate-500">
            Les opportunités expirées, celles de votre entreprise et celles pour lesquelles vous avez déjà manifesté votre intérêt sont exclues.
          </p>
        </Card>
      </div>
    </div>
  );
}
