import Link from "next/link";
import { freeLaunch } from "@/lib/billing/entitlements";
import { CompanyForm } from "@/components/companies/company-form";
import { ExpressCompanyForm } from "@/components/companies/express-form";
import { CheckCircle2 } from "lucide-react";
import { Notice } from "@/components/ui/notice";
import { requireSession } from "@/lib/auth";
import { getDepartments, getPlaces, getSectors } from "@/lib/queries/platform";
import { PRIVATE_METADATA } from "@/lib/seo";

export const metadata = { ...PRIVATE_METADATA, title: "Créer mon entreprise" };

export default async function OnboardingCompanyPage(props: PageProps<"/onboarding/entreprise">) {
  const session = await requireSession("/onboarding/entreprise");
  const sp = await props.searchParams;
  const next = typeof sp.suite === "string" ? sp.suite : undefined;
  const [places, departments, sectors] = await Promise.all([getPlaces(), getDepartments(), getSectors()]);
  // Par défaut, profil express (4 informations) ; formulaire complet sur demande
  const full = sp.complet === "1";
  const qs = (extra: Record<string, string>) => `?${new URLSearchParams({ ...(next ? { suite: next } : {}), ...extra })}`;
  if (!full)
    return (
      <div className="container-page max-w-2xl py-10 sm:py-14">
        {sp.bienvenue === "1" && (
          <p className="mb-4 inline-flex animate-rise items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-800 ring-1 ring-teal/20">
            <CheckCircle2 className="size-4" aria-hidden /> Adresse confirmée, bienvenue sur LinkProB2B
          </p>
        )}
        <p className="text-sm font-semibold tracking-wide text-teal-700 uppercase">Dernière étape · 30 secondes</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Quelles offres vous intéressent ?</h1>
        <p className="mt-2 text-slate-600">
          Indiquez votre métier et votre ville : nous vous montrons tout de suite les appels d&apos;offres et besoins qui correspondent à votre entreprise, et
          vous recevez les nouveaux par e-mail.
        </p>
        <ul className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
          {["Offres triées par pertinence", "Pourquoi chaque offre vous concerne", "Alerte e-mail automatique"].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 shrink-0 text-teal-700" aria-hidden /> {t}
            </li>
          ))}
        </ul>
        {session.memberships.length > 0 && (
          <Notice tone="info" className="mt-6">
            Vous êtes déjà membre de {session.memberships.map((m) => m.company.name).join(", ")}. Vous pouvez créer une entreprise supplémentaire.
          </Notice>
        )}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <ExpressCompanyForm sectors={sectors} places={places} next={next} freeLaunch={await freeLaunch()} />
        </div>
        <p className="mt-6 text-center text-sm text-slate-600">
          SIREN, présentation, références : vous les ajouterez quand vous voudrez.{" "}
          <Link href={`/onboarding/entreprise${qs({ complet: "1" })}`} className="font-semibold text-teal-700 underline">
            Remplir le formulaire complet
          </Link>
        </p>
      </div>
    );
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
        <CompanyForm mode="create" places={places} departments={departments} sectors={sectors} next={next} freeLaunch={await freeLaunch()} />
      </div>
    </div>
  );
}
