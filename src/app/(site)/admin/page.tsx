import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardCard, Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { AudiencePanel, PERIODS, type AudienceStats } from "@/components/admin/audience-panel";

export const metadata = { title: "Vue d'ensemble" };

type Stats = Record<string, number>;

function pct(a: number, b: number) {
  return b > 0 ? `${Math.round((a / b) * 100)} %` : "—";
}

export default async function AdminHome(props: PageProps<"/admin">) {
  await requireStaff();
  const sp = await props.searchParams;
  const supabase = await createClient();
  const period = PERIODS.find((p) => String(p) === sp.periode) ?? 30;
  const [{ data }, { data: audience }] = await Promise.all([
    supabase.rpc("admin_stats"),
    supabase.rpc("admin_audience_stats", { p_days: period }),
  ]);
  const s = (data ?? {}) as Stats;
  return (
    <div className="space-y-8">
      {sp.refus === "admin" && <Notice tone="error">Cette page est réservée aux administrateurs.</Notice>}
      <div>
        <h1 className="text-2xl font-bold">Vue d&apos;ensemble</h1>
        <p className="mt-1 text-slate-600">Indicateurs calculés en temps réel sur la base de données — aucune valeur estimée.</p>
      </div>
      {s.demo_records > 0 && (
        <Notice tone="warning">
          {s.demo_records} enregistrement(s) de démonstration sont présents et inclus dans ces chiffres. Supprimez-les avant le lancement réel (
          <code>npm run seed:clean</code>).
        </Notice>
      )}
      {(s.opportunities_pending > 0 || s.reports_open > 0) && (
        <Notice tone="info" title="À traiter">
          {s.opportunities_pending > 0 && (
            <Link href="/admin/moderation" className="mr-4 font-semibold underline">
              {s.opportunities_pending} publication(s) en attente
            </Link>
          )}
          {s.reports_open > 0 && (
            <Link href="/admin/signalements" className="font-semibold underline">
              {s.reports_open} signalement(s) ouvert(s)
            </Link>
          )}
        </Notice>
      )}
      {audience ? (
        <AudiencePanel stats={audience as unknown as AudienceStats} period={period} />
      ) : (
        <Notice tone="error">Mesure d&apos;audience indisponible.</Notice>
      )}
      <section>
        <h2 className="mb-3 text-lg font-bold">Utilisateurs et entreprises</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <DashboardCard label="Utilisateurs" value={s.users_total ?? 0} href="/admin/utilisateurs" />
          <DashboardCard label="Actifs (30 j)" value={s.users_active_30d ?? 0} />
          <DashboardCard label="Entreprises inscrites" value={s.companies_total ?? 0} href="/admin/entreprises" />
          <DashboardCard label="Profils complétés" value={s.companies_completed ?? 0} hint="Description, secteurs et compétences" />
          <DashboardCard label="Entreprises actives (30 j)" value={s.companies_active ?? 0} hint="Au moins une action" />
          <DashboardCard label="Entreprises vérifiées" value={s.companies_verified ?? 0} />
          <DashboardCard label="Comptes suspendus" value={s.users_suspended ?? 0} />
          <DashboardCard label="Messages de contact non traités" value={s.contact_messages_open ?? 0} href="/admin/signalements" />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-bold">Opportunités</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <DashboardCard label="Publiées (internes)" value={s.opportunities_published ?? 0} href="/admin/opportunites" />
          <DashboardCard label="Externes publiées" value={s.opportunities_external ?? 0} />
          <DashboardCard label="En attente de validation" value={s.opportunities_pending ?? 0} href="/admin/moderation" />
          <DashboardCard label="Expirées" value={s.opportunities_expired ?? 0} />
          <DashboardCard label="Consultations / devis / AO" value={s.consultations ?? 0} />
          <DashboardCard label="Manifestations d'intérêt" value={s.interests ?? 0} />
          <DashboardCard label="Réponses" value={s.proposals ?? 0} />
          <DashboardCard label="Conversations" value={s.conversations ?? 0} />
        </div>
      </section>
      <Card>
        <CardHeader title="Conversion (30 derniers jours)" description="Calculée à partir des événements analytiques (sans donnée personnelle)." />
        <dl className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Recherches", s.searches_30d ?? 0],
            ["Fiches consultées", s.views_30d ?? 0],
            ["Clics vers sources externes", s.outbound_clicks_30d ?? 0],
            ["Intérêts manifestés", s.interests_30d ?? 0],
            ["Conversion recherche → intérêt", pct(s.interests_30d ?? 0, s.searches_30d ?? 0)],
            ["Conversion fiche → intérêt", pct(s.interests_30d ?? 0, s.views_30d ?? 0)],
            ["Taux de retour (réponses / publiées)", pct(s.proposals ?? 0, s.opportunities_published ?? 0)],
            ["Sources approuvées", `${s.sources_approved ?? 0} / ${s.sources_total ?? 0}`],
          ].map(([label, value]) => (
            <div key={label as string} className="bg-white p-4">
              <dt className="text-sm text-slate-600">{label}</dt>
              <dd className="mt-1 font-heading text-2xl font-bold text-navy">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
