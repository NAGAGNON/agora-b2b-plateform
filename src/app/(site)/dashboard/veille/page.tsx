import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { VeilleForm } from "@/components/dashboard/veille-form";
import { REGIONS } from "@/lib/geo";
import { OPPORTUNITY_TYPE_LABELS, SECTOR_LABELS } from "@/lib/constants";

export const metadata = { title: "Veille par e-mail" };

export default async function VeillePage(props: PageProps<"/dashboard/veille">) {
  const session = await requireSession("/dashboard/veille");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: pref }, { data: sectors }] = await Promise.all([
    supabase.from("veille_preferences").select("frequency, sectors, regions, types, keywords, consent_at").eq("user_id", session.userId).maybeSingle(),
    supabase.from("sectors").select("slug, label").eq("is_active", true).order("sort_order"),
  ]);
  const wantsDaily = sp.frequence === "quotidienne";
  const consented = Boolean(pref?.consent_at) || (!pref && session.profile.marketing_consent);
  const active = consented && (pref?.frequency ?? "TWICE_WEEKLY") !== "NONE";
  const sectorOptions = (sectors?.length ? sectors : Object.entries(SECTOR_LABELS).map(([slug, label]) => ({ slug, label }))).map((s) => ({ value: s.slug, label: s.label }));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Veille par e-mail</h1>
        <p className="mt-1 text-sm text-slate-600">
          Recevez des opportunités B2B réelles et encore ouvertes, choisies selon vos critères. Aucune annonce n&apos;est envoyée deux fois.
        </p>
      </div>
      {wantsDaily && (
        <Notice tone="info" title="Activer les alertes quotidiennes">
          Vérifiez vos critères ci-dessous puis cliquez sur « Enregistrer mes préférences » pour confirmer votre choix. Rien n&apos;est activé tant que vous n&apos;avez pas
          enregistré.
        </Notice>
      )}
      <Notice tone={active ? "success" : "info"}>
        {active
          ? pref?.frequency === "DAILY"
            ? "Statut actuel : alertes quotidiennes activées."
            : "Statut actuel : deux sélections par semaine (lundi et vendredi)."
          : "Statut actuel : vous ne recevez pas la veille par e-mail."}
      </Notice>
      <Card>
        <CardHeader title="Mes préférences" description="Ces critères servent uniquement à choisir les opportunités qui vous sont envoyées." />
        <div className="p-5">
          <VeilleForm
            v={{ frequency: pref?.frequency ?? (consented ? "TWICE_WEEKLY" : "NONE"), sectors: pref?.sectors ?? [], regions: pref?.regions ?? [], types: (pref?.types as string[]) ?? [], keywords: pref?.keywords ?? [], consented }}
            frequencyHint={wantsDaily ? "DAILY" : undefined}
            sectors={sectorOptions}
            regions={REGIONS.map((r) => ({ value: r.name, label: r.name }))}
            types={Object.entries(OPPORTUNITY_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </div>
      </Card>
    </div>
  );
}
