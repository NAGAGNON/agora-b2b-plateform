import { BellRing } from "lucide-react";
import { BellRing as PageIcon } from "lucide-react";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDepartments, getPlaces, getSectors, getSectorLabels } from "@/lib/queries/platform";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { AlertForm } from "@/components/dashboard/alert-form";
import { AlertControls } from "@/components/dashboard/small-actions";
import { ALERT_FREQUENCY_LABELS, COMPANY_SIZE_LABELS, OPPORTUNITY_TYPE_LABELS, sectorLabel } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Alertes" };

export default async function AlertsPage(props: PageProps<"/dashboard/alertes">) {
  const sectorLabels = await getSectorLabels();
  const session = await requireSession("/dashboard/alertes");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: alerts }, departments, places] = await Promise.all([
    supabase.from("alerts").select("*").eq("user_id", session.userId).order("created_at", { ascending: false }),
    getDepartments(),
    getPlaces(),
  ]);
  const placeName = new Map(places.map((p) => [p.slug, p.name]));
  // Offres ouvertes qui correspondent aujourd'hui à chaque alerte : critères trop larges ou trop stricts ?
  const counts = new Map(
    await Promise.all(
      (alerts ?? []).map(async (a) => {
        const { data } = await supabase.rpc("alert_open_matches", { p_alert_id: a.id });
        return [a.id, Number(data ?? 0)] as const;
      }),
    ),
  );
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  return (
    <div className="space-y-6">
      <DashboardPageHeader
        icon={<PageIcon />}
        image="/images/illustrations/tableau-de-bord.webp"
        title="Alertes"
        description={
          <>
            Recevez une notification (et un e-mail si activé dans vos paramètres) lorsqu&apos;une opportunité correspond à vos critères.
            {!session.profile.notify_email && " Les e-mails sont actuellement désactivés dans vos paramètres."}
          </>
        }
      />
      <Card>
        <CardHeader title="Nouvelle alerte" description="Une alerte simple suffit pour commencer. Pour un ciblage très fin, ouvrez « Alerte précise » et combinez plusieurs critères." />
        <div className="p-5">
          <AlertForm departments={departments} places={places} sectors={await getSectors()} defaults={{ secteur: str(sp.secteur), region: str(sp.region), departement: str(sp.departement), type: str(sp.type), motscles: str(sp.motscles), lieu: str(sp.lieu), rayon: str(sp.rayon) }} />
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
                    {a.sector_slug && <Badge tone="sky">{sectorLabel(a.sector_slug, sectorLabels)}</Badge>}
                    {a.region && <Badge tone="sky">{a.region}</Badge>}
                    {a.department_code && <Badge tone="sky">Dép. {a.department_code}</Badge>}
                    {a.type && <Badge tone="sky">{OPPORTUNITY_TYPE_LABELS[a.type]}</Badge>}
                    {a.place_slug && <Badge tone="sky">{placeName.get(a.place_slug) ?? a.place_slug} · {a.radius_km ?? 50} km</Badge>}
                    {a.skills?.map((sk) => (
                      <Badge key={sk} tone="slate">{sk}</Badge>
                    ))}
                    {a.company_size && <Badge tone="slate">{COMPANY_SIZE_LABELS[a.company_size]}</Badge>}
                    {!a.include_external && <Badge tone="amber">LinkProB2B uniquement</Badge>}
                    {a.keywords && <Badge tone="slate">« {a.keywords} »</Badge>}
                    {a.extra_sectors?.map((x) => (
                      <Badge key={x} tone="sky">
                        + {sectorLabel(x, sectorLabels)}
                      </Badge>
                    ))}
                    {a.extra_departments?.length > 0 && <Badge tone="sky">+ Dép. {a.extra_departments.join(", ")}</Badge>}
                    {a.exclude_keywords && <Badge tone="slate">Sans « {a.exclude_keywords} »</Badge>}
                    {a.buyer_terms?.length > 0 && <Badge tone="slate">Acheteurs : {a.buyer_terms.join(", ")}</Badge>}
                    {a.min_budget != null && <Badge tone="slate">Budget ≥ {Number(a.min_budget).toLocaleString("fr-FR")} €</Badge>}
                    {a.min_days_left != null && <Badge tone="slate">≥ {a.min_days_left} jours pour répondre</Badge>}
                    {a.cpv_prefixes?.length > 0 && <Badge tone="slate">CPV {a.cpv_prefixes.join(", ")}</Badge>}
                  </div>
                  <p className="mt-1 text-sm font-medium text-teal-800">
                    {(counts.get(a.id) ?? 0).toLocaleString("fr-FR")} offre{(counts.get(a.id) ?? 0) > 1 ? "s" : ""} ouverte{(counts.get(a.id) ?? 0) > 1 ? "s" : ""} correspond{(counts.get(a.id) ?? 0) > 1 ? "ent" : ""} aujourd&apos;hui
                    {(counts.get(a.id) ?? 0) === 0 && <span className="font-normal text-slate-500"> · critères peut-être trop stricts</span>}
                    {(counts.get(a.id) ?? 0) > 300 && <span className="font-normal text-slate-500"> · ajoutez des critères pour un ciblage plus fin</span>}
                  </p>
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
