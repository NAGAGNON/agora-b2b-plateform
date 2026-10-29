import Link from "next/link";
import { CheckCircle2, ShieldCheck, Clock, Users } from "lucide-react";
import { PublishWizard } from "@/components/opportunities/publish-wizard";
import { NeedDraftForm } from "@/components/opportunities/need-draft-form";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { getSession } from "@/lib/auth";
import { PageHero } from "@/components/layout/page-hero";
import { getDepartments, getPlaces, getSectors } from "@/lib/queries/platform";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Publier un besoin",
  description: "Publiez gratuitement un besoin, une demande de devis, une consultation ou un appel d'offres privé et recevez des réponses de fournisseurs.",
  path: "/publier",
});

export default async function PublishPage() {
  const session = await getSession();
  if (!session || !session.activeCompany) {
    return (
      <>
      <PageHero
        eyebrow="Acheteurs et donneurs d'ordres"
        image="/images/illustrations/reunion.webp"
        title="Publier un besoin"
        intro="Décrivez votre besoin une seule fois et recevez des manifestations d'intérêt et des réponses comparables de fournisseurs qualifiés."
      />
      <div className="container-page py-10 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <ul className="space-y-4">
              {[
                { icon: CheckCircle2, t: "Quatre formats", d: "Besoin simple, demande de devis, consultation privée ou appel d'offres privé." },
                { icon: ShieldCheck, t: "Publication modérée", d: "Chaque publication est relue avant diffusion pour garantir la qualité du catalogue." },
                { icon: Users, t: "Vous gardez la main", d: "Présélection, demande d'informations, sélection et clôture depuis votre espace." },
                { icon: Clock, t: "Publication gratuite", d: "Aucun paiement, aucune carte bancaire." },
              ].map((x) => (
                <li key={x.t} className="reveal flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <x.icon className="mt-0.5 size-6 shrink-0 text-teal-600" aria-hidden />
                  <span>
                    <span className="font-semibold text-navy">{x.t}</span>
                    <span className="block text-slate-600">{x.d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-navy/5 sm:p-10">
            {!session ? (
              <>
                <h2 className="text-xl font-bold">Décrivez votre besoin</h2>
                <p className="mt-2 mb-6 text-slate-600">30 secondes pour commencer. Votre compte gratuit se crée juste après, avec votre besoin déjà rempli.</p>
                <NeedDraftForm sectors={await getSectors()} />
                <p className="mt-4 text-center text-sm">
                  <Link href="/connexion?suite=/publier" className="font-semibold text-teal-700 hover:underline">
                    J&apos;ai déjà un compte
                  </Link>
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold">Dernière étape avant de publier</h2>
                <p className="mt-2 text-slate-600">
                  Créez le profil de votre entreprise : il apparaîtra sur vos publications. Si vous avez déjà décrit votre besoin, il sera repris automatiquement.
                </p>
                <ButtonLink href="/onboarding/entreprise?suite=/publier" size="lg" full className="mt-6">
                  Créer mon entreprise
                </ButtonLink>
              </>
            )}
            <p className="mt-6 text-sm text-slate-500">
              Consultez les{" "}
              <Link href="/cgu" className="underline">
                règles de publication
              </Link>{" "}
              avant de commencer.
            </p>
          </div>
        </div>
      </div>
      </>
    );
  }
  const [places, departments] = await Promise.all([getPlaces(), getDepartments()]);
  const suspended = session.activeCompany.company.status !== "ACTIVE";
  return (
    <div className="container-page max-w-4xl py-8 sm:py-12">
      <h1 className="text-2xl font-bold sm:text-3xl">Publier un besoin</h1>
      <p className="mt-1 mb-8 text-slate-600">
        Au nom de <strong className="text-navy">{session.activeCompany.company.name}</strong>.
      </p>
      {suspended ? (
        <Notice tone="error">Votre entreprise est suspendue : la publication est désactivée. Contactez l&apos;équipe LinkProB2B.</Notice>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <PublishWizard places={places} departments={departments} sectors={await getSectors()} companyName={session.activeCompany.company.name} />
        </div>
      )}
    </div>
  );
}
