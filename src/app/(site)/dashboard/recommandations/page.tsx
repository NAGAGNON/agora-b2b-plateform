import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSectorLabels, showDemoData } from "@/lib/queries/platform";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { RecommendationList, SCORING_RULES } from "@/components/dashboard/recommendations";

export const metadata = { title: "Recommandations" };

export default async function RecommendationsPage() {
  const session = await requireSession("/dashboard/recommandations");
  const company = session.activeCompany?.company;
  if (!company) {
    return (
      <EmptyState
        icon={<Sparkles className="size-6" aria-hidden />}
        title="Créez d'abord votre entreprise"
        description="Les recommandations s'appuient sur les secteurs, la zone et les compétences de votre fiche entreprise."
        action={<ButtonLink href="/onboarding/entreprise">Créer mon entreprise</ButtonLink>}
      />
    );
  }
  const supabase = await createClient();
  const [{ data, error }, sectorLabels] = await Promise.all([
    supabase.rpc("recommended_opportunities", { p_company_id: company.id, p_limit: 30, p_include_demo: await showDemoData() }),
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
