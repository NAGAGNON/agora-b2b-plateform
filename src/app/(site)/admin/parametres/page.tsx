import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/queries/platform";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { Badge } from "@/components/ui/badge";
import { DemoDataControls } from "@/components/admin/demo-data";
import { Card, CardHeader } from "@/components/ui/card";
import { MaintenanceButton, SettingToggle } from "@/components/admin/admin-actions";

export const metadata = { title: "Paramètres" };

export default async function AdminSettingsPage() {
  const session = await requireAdmin();
  const s = await getSettings();
  const supabase = await createClient();
  const { count: demoCount } = await supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("is_demo", true);
  const ENV_LABELS = { development: "Développement", staging: "Prévisualisation (staging)", production: "Production" } as const;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Paramètres de la plateforme</h1>
      <Card>
        <CardHeader title="Environnement" description="Défini par la variable APP_ENV (ou déduit de Vercel). La production ne contient que des données réelles." />
        <dl className="grid gap-3 px-5 pb-5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Environnement</dt>
            <dd>
              <Badge tone={env.isProduction ? "green" : "amber"}>{ENV_LABELS[env.appEnv]}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">E-mails</dt>
            <dd>{env.resendApiKey ? <Badge tone="green">Resend configuré</Badge> : <Badge tone="amber">Aucun fournisseur (e-mails non envoyés)</Badge>}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Adresse publique</dt>
            <dd className="break-all">{env.siteUrl}</dd>
          </div>
        </dl>
      </Card>
      <Card>
        <CardHeader
          title="Données de démonstration"
          description="Jeu fictif (entreprises « Démo… », comptes @demo.linkprob2b.test) marqué is_demo, séparé des données réelles et supprimable en un clic. Interdit en production."
        />
        <div className="space-y-4 px-5 pb-5">
          <p className="text-sm text-slate-600">
            Actuellement : <strong>{demoCount ?? 0}</strong> opportunité(s) de démonstration.
          </p>
          {session.isSuperAdmin ? (
            <DemoDataControls allowed={!env.isProduction} present={(demoCount ?? 0) > 0} />
          ) : (
            <p className="text-sm text-slate-500">Réservé au super-administrateur.</p>
          )}
          {!env.isProduction && (
            <SettingToggle settingKey="demo" value={s.demo ?? {}} field="visible" label="Afficher les données de démonstration dans les recherches" hint="Désactivez pour vérifier le rendu avec les seules données réelles." />
          )}
        </div>
      </Card>
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
