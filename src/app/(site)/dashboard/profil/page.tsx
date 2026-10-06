import { requireSession } from "@/lib/auth";
import { Card, CardHeader } from "@/components/ui/card";
import { UserProfileForm } from "@/components/dashboard/profile-forms";
import { PLATFORM_ROLE_LABELS, COMPANY_ROLE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import Link from "next/link";

export const metadata = { title: "Profil" };

export default async function ProfilePage() {
  const s = await requireSession("/dashboard/profil");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Mon profil</h1>
      <Card>
        <CardHeader title="Informations personnelles" description={`Compte créé le ${formatDate(s.profile.created_at)}`} />
        <div className="p-5">
          <UserProfileForm v={{ ...s.profile, email: s.email }} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Rôles et entreprises" />
        <div className="space-y-3 p-5 text-sm">
          <p>
            Rôle sur la plateforme : <strong className="text-navy">{PLATFORM_ROLE_LABELS[s.profile.platform_role]}</strong>
          </p>
          {s.memberships.length === 0 ? (
            <p>
              Aucune entreprise.{" "}
              <Link href="/onboarding/entreprise" className="font-semibold text-teal-700 underline">
                Créer mon entreprise
              </Link>
            </p>
          ) : (
            <ul className="space-y-1">
              {s.memberships.map((m) => (
                <li key={m.id}>
                  {m.company.name} — {COMPANY_ROLE_LABELS[m.role]}
                </li>
              ))}
            </ul>
          )}
          <Link href="/onboarding/entreprise" className="inline-block text-sm font-semibold text-teal-700 underline">
            Ajouter une autre entreprise
          </Link>
        </div>
      </Card>
    </div>
  );
}
