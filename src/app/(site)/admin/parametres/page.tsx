import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/queries/platform";
import { Card, CardHeader } from "@/components/ui/card";
import { MaintenanceButton, SettingToggle } from "@/components/admin/admin-actions";

export const metadata = { title: "Paramètres" };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const s = await getSettings();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Paramètres de la plateforme</h1>
      <Card>
        <CardHeader title="Fonctionnement" />
        <div className="divide-y divide-slate-100 px-5">
          <SettingToggle settingKey="registrations" value={s.registrations ?? {}} field="open" label="Inscriptions ouvertes" />
          <SettingToggle settingKey="demo" value={s.demo ?? {}} field="show_banner" label="Bandeau « données de démonstration »" hint="Affiché uniquement si des données de démonstration existent." />
          <SettingToggle settingKey="security" value={s.security ?? {}} field="admin_mfa_required" label="Double authentification obligatoire pour l'administration" hint="Activez-la seulement après avoir configuré votre propre 2FA (Paramètres du compte)." />
          <div className="py-3 text-sm text-slate-600">
            <p className="font-semibold text-navy">Modération</p>
            <p>Toutes les publications internes passent par la modération pendant le pilote (règle appliquée en base de données).</p>
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Traitements planifiés" description="Exécutés automatiquement chaque jour par la tâche planifiée (/api/cron/quotidien). Vous pouvez les lancer manuellement." />
        <div className="space-y-2 p-5 text-sm text-slate-600">
          <ul className="list-disc pl-5">
            <li>Passage en « Expirée » des opportunités dont la date limite est dépassée</li>
            <li>Résumés quotidiens et hebdomadaires des alertes</li>
            <li>Envoi de la file d&apos;e-mails (si un fournisseur e-mail est configuré)</li>
          </ul>
          <MaintenanceButton />
        </div>
      </Card>
      <Card>
        <CardHeader title="Zone pilote" />
        <pre className="overflow-x-auto p-5 text-xs text-slate-600">{JSON.stringify(s.pilot ?? {}, null, 2)}</pre>
      </Card>
    </div>
  );
}
