import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDepartments, getPlaces, getSectors } from "@/lib/queries/platform";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { CompanyForm } from "@/components/companies/company-form";
import { InviteMemberForm, MemberControls } from "@/components/dashboard/profile-forms";
import { COMPANY_ROLE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Entreprise" };

export default async function CompanySettingsPage() {
  const session = await requireCompany("/dashboard/entreprise");
  const cid = session.activeCompany.company.id;
  const isAdmin = session.activeCompany.role === "COMPANY_ADMIN";
  const supabase = await createClient();
  const [{ data: company }, { data: members }, { data: invitations }, places, departments] = await Promise.all([
    supabase.from("companies").select("*, profile:company_profiles(*)").eq("id", cid).single(),
    supabase.from("company_members").select("id, role, created_at, user_id, user:users(full_name, email)").eq("company_id", cid).order("created_at"),
    isAdmin ? supabase.from("company_invitations").select("*").eq("company_id", cid).is("accepted_at", null) : { data: [] },
    getPlaces(),
    getDepartments(),
  ]);
  if (!company) return null;
  const profile = Array.isArray(company.profile) ? company.profile[0] : company.profile;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            {company.name}
            {company.verified_at && <BadgeCheck className="size-6 text-teal-600" aria-label="Entreprise vérifiée" />}
          </h1>
          <p className="text-sm text-slate-500">
            Offre : gratuite · {company.verified_at ? `vérifiée le ${formatDate(company.verified_at)}` : "non vérifiée"}
          </p>
        </div>
        <Link href={`/entreprises/${company.slug}`} className="text-sm font-semibold text-teal-700 underline">
          Voir la page publique
        </Link>
      </div>
      {!company.verified_at && (
        <Notice tone="info" title="Vérification de l'entreprise">
          Le badge « Entreprise vérifiée » est attribué par l&apos;équipe LinkProB2B après contrôle (SIREN, existence de l&apos;entreprise). Renseignez votre
          SIREN et contactez-nous pour en faire la demande.
        </Notice>
      )}
      <Card>
        <CardHeader title="Profil de l'entreprise" description={isAdmin ? "Visible dans l'annuaire si l'option est cochée." : "Seuls les administrateurs de l'entreprise peuvent le modifier."} />
        <div className="p-5">
          {isAdmin ? (
            <CompanyForm mode="edit" values={{ ...company, ...(profile ?? {}) }} places={places} departments={departments} sectors={await getSectors()} />
          ) : (
            <Notice tone="info">Vous êtes membre de cette entreprise. Demandez à un administrateur de modifier le profil.</Notice>
          )}
        </div>
      </Card>
      <Card>
        <CardHeader title="Membres" description="Tous les membres peuvent publier et répondre au nom de l'entreprise ; les administrateurs gèrent le profil et l'équipe." />
        <ul className="divide-y divide-slate-100">
          {(members ?? []).map((m) => {
            const u = Array.isArray(m.user) ? m.user[0] : m.user;
            return (
              <li key={m.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-navy">{u?.full_name || u?.email}</p>
                  <p className="text-xs text-slate-500">
                    {u?.email} · depuis le {formatDate(m.created_at)}
                  </p>
                </div>
                <MemberControls memberId={m.id} role={m.role} isSelf={m.user_id === session.userId} canManage={isAdmin} />
              </li>
            );
          })}
        </ul>
        {isAdmin && (
          <div className="border-t border-slate-100 p-5">
            <h3 className="mb-3 text-sm font-bold">Ajouter un membre</h3>
            <InviteMemberForm />
            {invitations && invitations.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-navy">Invitations en attente d&apos;inscription</p>
                <ul className="mt-1 text-sm text-slate-600">
                  {invitations.map((i) => (
                    <li key={i.id}>
                      {i.email} — {COMPANY_ROLE_LABELS[i.role]}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
