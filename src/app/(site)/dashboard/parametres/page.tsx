import { Download } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { NewPasswordForm } from "@/components/auth/forms";
import { DeleteAccountForm } from "@/components/dashboard/profile-forms";
import { MfaManager } from "@/components/dashboard/security-forms";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { title: "Paramètres" };

export default async function SettingsPage(props: PageProps<"/dashboard/parametres">) {
  const session = await requireSession("/dashboard/parametres");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp?.find((f) => f.status === "verified") ?? null;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Paramètres du compte</h1>
      {sp.mfa === "requis" && (
        <Notice tone="warning" title="Double authentification requise">
          L&apos;accès à l&apos;administration exige la double authentification. Activez-la ci-dessous.
        </Notice>
      )}
      <Card>
        <CardHeader title="Mot de passe" />
        <div className="max-w-md p-5">
          <NewPasswordForm />
        </div>
      </Card>
      <Card>
        <CardHeader title="Double authentification" description={session.isStaff ? "Fortement recommandée pour les comptes d'administration." : "Facultative."} />
        <div className="p-5">
          <MfaManager verifiedFactorId={verified?.id ?? null} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Mes données (RGPD)" description="Droit d'accès et de portabilité." />
        <div className="space-y-3 p-5 text-sm text-slate-600">
          <p>Téléchargez l&apos;ensemble des données personnelles associées à votre compte au format JSON.</p>
          <a href="/api/compte/export" className={buttonClasses({ variant: "outline" })}>
            <Download className="size-4" aria-hidden /> Exporter mes données
          </a>
          <p>
            Pour rectifier vos informations, utilisez les pages Profil et Entreprise. Pour toute autre demande, contactez-nous via la page Contact.
          </p>
        </div>
      </Card>
      <Card className="border-red-200">
        <CardHeader title="Supprimer mon compte" description="Action irréversible." />
        <div className="max-w-md space-y-4 p-5 text-sm text-slate-600">
          <p>
            Votre compte et vos données personnelles seront supprimés. Si vous êtes le seul membre d&apos;une entreprise, cette entreprise et ses
            publications seront également supprimées. Si d&apos;autres membres existent, l&apos;entreprise est conservée.
          </p>
          <DeleteAccountForm />
        </div>
      </Card>
    </div>
  );
}
