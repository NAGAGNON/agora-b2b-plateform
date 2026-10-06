import { CompanyForm } from "@/components/companies/company-form";
import { Notice } from "@/components/ui/notice";
import { requireSession } from "@/lib/auth";
import { getDepartments, getPlaces, getSectors } from "@/lib/queries/platform";
import { PRIVATE_METADATA } from "@/lib/seo";

export const metadata = { ...PRIVATE_METADATA, title: "Créer mon entreprise" };

export default async function OnboardingCompanyPage(props: PageProps<"/onboarding/entreprise">) {
  const session = await requireSession("/onboarding/entreprise");
  const sp = await props.searchParams;
  const next = typeof sp.suite === "string" ? sp.suite : undefined;
  const [places, departments] = await Promise.all([getPlaces(), getDepartments()]);
  return (
    <div className="container-page max-w-3xl py-10 sm:py-14">
      <p className="text-sm font-semibold tracking-wide text-teal-700 uppercase">Étape 2 sur 2</p>
      <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Créez le profil de votre entreprise</h1>
      <p className="mt-2 text-slate-600">
        Ces informations permettent de publier des besoins, de répondre aux opportunités et d&apos;apparaître dans l&apos;annuaire. Vous pourrez les
        compléter à tout moment.
      </p>
      {session.memberships.length > 0 && (
        <Notice tone="info" className="mt-6">
          Vous êtes déjà membre de {session.memberships.map((m) => m.company.name).join(", ")}. Vous pouvez créer une entreprise supplémentaire.
        </Notice>
      )}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <CompanyForm mode="create" places={places} departments={departments} sectors={await getSectors()} next={next} />
      </div>
    </div>
  );
}
