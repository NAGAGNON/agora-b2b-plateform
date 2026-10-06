import { BellRing } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDepartments } from "@/lib/queries/platform";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { AlertForm } from "@/components/dashboard/alert-form";
import { AlertControls } from "@/components/dashboard/small-actions";
import { ALERT_FREQUENCY_LABELS, OPPORTUNITY_TYPE_LABELS, SECTOR_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Alertes" };

export default async function AlertsPage(props: PageProps<"/dashboard/alertes">) {
  const session = await requireSession("/dashboard/alertes");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: alerts }, departments] = await Promise.all([
    supabase.from("alerts").select("*").eq("user_id", session.userId).order("created_at", { ascending: false }),
    getDepartments(),
  ]);
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Alertes</h1>
        <p className="mt-1 text-slate-600">
          Recevez une notification (et un e-mail si activé dans vos paramètres) lorsqu&apos;une opportunité correspond à vos critères.
          {!session.profile.notify_email && " Les e-mails sont actuellement désactivés dans vos paramètres."}
        </p>
      </div>
      <Card>
        <CardHeader title="Nouvelle alerte" />
        <div className="p-5">
          <AlertForm departments={departments} defaults={{ secteur: str(sp.secteur), departement: str(sp.departement), type: str(sp.type), motscles: str(sp.motscles) }} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Mes alertes" description={`${alerts?.length ?? 0} alerte(s)`} />
        {!alerts?.length ? (
          <div className="p-5">
            <EmptyState icon={<BellRing className="size-6" aria-hidden />} title="Aucune alerte" description="Créez votre première alerte ci-dessus." />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {alerts.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-navy">{a.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge tone="navy">{ALERT_FREQUENCY_LABELS[a.frequency]}</Badge>
                    {a.sector_slug && <Badge tone="sky">{SECTOR_LABELS[a.sector_slug]}</Badge>}
                    {a.department_code && <Badge tone="sky">Dép. {a.department_code}</Badge>}
                    {a.type && <Badge tone="sky">{OPPORTUNITY_TYPE_LABELS[a.type]}</Badge>}
                    {a.keywords && <Badge tone="slate">« {a.keywords} »</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Dernier envoi : {a.last_sent_at ? formatDateTime(a.last_sent_at) : "jamais"}</p>
                </div>
                <AlertControls id={a.id} active={a.is_active} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
