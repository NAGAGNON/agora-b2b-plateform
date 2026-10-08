import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/format";
import { realSendBlockers, windowStart, type OutreachSettings } from "@/lib/outreach/data";
import { BarChart, Funnel } from "@/components/outreach/charts";
import { CAMPAIGN_STATUS, PageHead, Panel, Stat, StatusBadge, fmtN, pct } from "@/components/outreach/ui";
import { LaunchManualButton, RunNowButton } from "@/components/outreach/run-button";
import { campaignLabel } from "@/lib/outreach/matching";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/states";

// « Lancer une campagne maintenant » : chaîne complète (jusqu'à 5 minutes)
export const maxDuration = 300;

export const metadata = { title: "Vue d'ensemble" };

const DAY = 86_400_000;
type Stats = Record<string, number>;

export default async function OutreachOverview() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const since = windowStart(30);
  const [{ data: settings }, { data: campaigns }, { data: sent }, { data: events }, prospects, withEmail, dnc, { data: cron }] = await Promise.all([
    supabase.from("outreach_settings").select("*").eq("id", true).maybeSingle(),
    supabase.from("outreach_campaigns").select("id, campaign_date, kind, launched_by, created_at, status, dry_run, stats").order("campaign_date", { ascending: false }).order("created_at", { ascending: false }).limit(8),
    supabase.from("outreach_recipients").select("sent_at, status").in("status", ["SENT", "SIMULATED"]).gte("sent_at", since.toISOString()).limit(50_000),
    supabase.from("outreach_events").select("type, created_at, opportunity_id, recipient_id").gte("created_at", since.toISOString()).in("type", ["PREPARED", "SENT", "SIMULATED", "OPEN", "CLICK", "LANDING_VIEW", "OPPORTUNITY_VIEW", "GATE_VIEW", "GATE_SIGNUP_CLICK", "SIGNUP", "LOGIN", "OFFER_ACCESS", "CONVERSION"]).limit(100_000),
    supabase.from("outreach_prospects").select("id", { count: "exact", head: true }),
    supabase.from("outreach_prospects").select("id", { count: "exact", head: true }).not("email", "is", null).eq("status", "ACTIVE"),
    supabase.from("outreach_suppressions").select("id", { count: "exact", head: true }),
    supabase.from("platform_settings").select("value").eq("key", "private.outreach_cron").maybeSingle(),
  ]);
  // Journée = campagne automatique + campagnes lancées à la main (chiffres additionnés)
  const { data: todayCampaigns } = await supabase.from("outreach_campaigns").select("id, kind, launched_by, status, stats").eq("campaign_date", today);
  const todayCampaign = todayCampaigns?.find((c) => c.kind === "AUTO") ?? null;
  const manualToday = (todayCampaigns ?? []).filter((c) => c.kind === "MANUAL");
  // Lancées par un administrateur / complémentaires automatiques (midi, après-midi)
  const extraLabel = [
    [manualToday.filter((c) => c.launched_by !== null).length, "manuelle"],
    [manualToday.filter((c) => c.launched_by === null).length, "complémentaire"],
  ]
    .filter(([n]) => Number(n) > 0)
    .map(([n, w]) => `${n} campagne${Number(n) > 1 ? "s" : ""} ${w}${Number(n) > 1 ? "s" : ""}`)
    .join(" et ");
  const lives = await Promise.all((todayCampaigns ?? []).map(async (c) => ((await supabase.rpc("outreach_campaign_stats", { p_campaign_id: c.id })).data ?? {}) as Stats));
  const live: Stats = {};
  for (const l of lives) for (const [k, v] of Object.entries(l)) live[k] = (live[k] ?? 0) + (Number(v) || 0);
  // Opportunités du jour : celles de la campagne automatique (les campagnes manuelles reprennent les mêmes)
  const st = (todayCampaign?.stats ?? manualToday[0]?.stats ?? {}) as Stats;
  const blockers = settings ? realSendBlockers(settings as OutreachSettings) : [];

  // Séries sur 30 jours (une série par graphique)
  const days = Array.from({ length: 30 }, (_, i) => new Date(since.getTime() + i * DAY).toISOString().slice(0, 10));
  const short = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
  const perDay = (rows: { at: string | null }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.at) m.set(r.at.slice(0, 10), (m.get(r.at.slice(0, 10)) ?? 0) + 1);
    return days.map((d) => ({ label: short(d), hint: formatDate(d), value: m.get(d) ?? 0 }));
  };
  const sentSeries = perDay((sent ?? []).map((r) => ({ at: r.sent_at })));
  const ev = events ?? [];
  const uniq = (type: string) => new Set(ev.filter((e) => e.type === type).map((e) => e.recipient_id)).size;
  const clickSeries = perDay(ev.filter((e) => e.type === "CLICK").map((e) => ({ at: e.created_at })));
  const funnel = [
    { label: "E-mails préparés", value: uniq("PREPARED") },
    { label: "Envoyés (ou simulés)", value: uniq("SENT") + uniq("SIMULATED") },
    { label: "Ouverts (indicatif)", value: uniq("OPEN") },
    { label: "Cliqués", value: uniq("CLICK") },
    { label: "Sélection consultée", value: uniq("LANDING_VIEW") },
    { label: "Page d'accès à l'offre", value: uniq("GATE_VIEW") },
    { label: "Clic « Créer mon compte »", value: uniq("GATE_SIGNUP_CLICK") },
    { label: "Inscriptions", value: uniq("SIGNUP") },
    { label: "Connexions (déjà inscrits)", value: uniq("LOGIN") },
    { label: "Accès à l'offre", value: uniq("OFFER_ACCESS") },
    { label: "Conversions", value: uniq("CONVERSION") },
  ];
  const step = (label: string) => funnel.find((f) => f.label === label)?.value ?? 0;
  // Opportunités qui suscitent le plus d'intérêt
  const views = new Map<string, number>();
  // Clic sur une offre depuis l'e-mail (ou, avant le parcours avec compte, consultation directe)
  for (const e of ev) if ((e.type === "CLICK" || e.type === "OPPORTUNITY_VIEW") && e.opportunity_id) views.set(e.opportunity_id, (views.get(e.opportunity_id) ?? 0) + 1);
  const topIds = [...views.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const { data: topOpps } = topIds.length ? await supabase.from("opportunities").select("id, title").in("id", topIds.map(([id]) => id)) : { data: [] };
  const sentTotal = funnel[1].value;
  const cronInfo = cron?.value as { last_run_at?: string; ok?: boolean; error?: string } | undefined;

  return (
    <>
      <PageHead
        title="Vue d'ensemble"
        description="Chaque jour : nouvelles opportunités LinkProB2B → entreprises réellement concernées → un e-mail personnalisé par entreprise → sélection personnalisée → inscription."
        action={
          <div className="flex flex-wrap gap-2">
            <LaunchManualButton />
            <RunNowButton />
          </div>
        }
      />
      {blockers.length > 0 && (
        <Notice tone="info" className="mb-6" title="Aucun e-mail réel ne peut partir pour le moment">
          <ul className="list-disc pl-5">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="mt-1">Les campagnes peuvent être préparées, prévisualisées et simulées sans aucun envoi.</p>
        </Notice>
      )}

      <Panel
        title={`Aujourd'hui — ${formatDate(today)}`}
        description={
          todayCampaign || manualToday.length ? (
            <>
              {todayCampaign && (
                <>
                  Campagne automatique <StatusBadge map={CAMPAIGN_STATUS} status={todayCampaign.status} /> ·{" "}
                  <Link href={`/outreach/campagnes/${todayCampaign.id}`} className="font-semibold text-teal-700 underline">
                    ouvrir la prévisualisation
                  </Link>
                </>
              )}
              {manualToday.length > 0 && (
                <>
                  {todayCampaign ? " · " : ""}
                  <Link href="/outreach/campagnes" className="font-semibold text-teal-700 underline">
                    {extraLabel}
                  </Link>{" "}
                  incluse{manualToday.length > 1 ? "s" : ""} dans les chiffres ci-dessous
                </>
              )}
            </>
          ) : (
            `Pas encore de campagne aujourd'hui. Préparation automatique chaque matin${cronInfo?.last_run_at ? ` — dernière exécution : ${formatDateTime(cronInfo.last_run_at)}` : ""}.`
          )
        }
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Stat label="Nouvelles opportunités" value={st.opportunities_eligible ?? 0} hint={st.opportunities_new ? `${fmtN(st.opportunities_new)} détectée(s)` : undefined} />
          <Stat label="Entreprises analysées" value={st.prospects_analyzed ?? 0} />
          <Stat label="Correspondances" value={st.matches ?? 0} hint={settings ? `score ≥ ${settings.min_score}/100` : undefined} />
          <Stat label="Entreprises sélectionnées" value={live.selected ?? 0} hint={live.no_email ? `dont ${fmtN(live.no_email)} sans e-mail` : undefined} />
          <Stat label="E-mails préparés" value={live.prepared ?? 0} />
          <Stat label="Envoyés" value={live.sent ?? 0} hint={live.simulated ? `+ ${fmtN(live.simulated)} simulé(s)` : undefined} tone="accent" />
          <Stat label="Clics" value={live.clicked ?? 0} />
          <Stat label="Inscriptions" value={live.signups ?? 0} />
          <Stat label="Conversions" value={live.conversions ?? 0} />
          <Stat label="Désinscriptions" value={live.unsubscribed ?? 0} />
        </div>
      </Panel>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="E-mails envoyés par jour" description="30 derniers jours · envois réels et simulations">
          <BarChart data={sentSeries} title="E-mails envoyés par jour" unit="e-mails" />
        </Panel>
        <Panel title="Clics par jour" description="30 derniers jours · liens des e-mails">
          <BarChart data={clickSeries} title="Clics par jour" unit="clics" />
        </Panel>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          title="Parcours de conversion"
          description={`30 derniers jours · taux de clic ${pct(step("Cliqués"), sentTotal)} · taux d'inscription ${pct(step("Inscriptions"), sentTotal)} · accès à l'offre ${pct(step("Accès à l'offre"), sentTotal)}`}
        >
          <Funnel steps={funnel} />
          <p className="mt-4 text-xs text-slate-500">Entreprises distinctes à chaque étape. Les ouvertures sont indicatives (images souvent bloquées par les messageries).</p>
        </Panel>
        <Panel title="Opportunités les plus consultées" description="Depuis les e-mails et sélections · 30 jours">
          {topIds.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune consultation pour le moment.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {topIds.map(([id, n]) => (
                <li key={id} className="flex items-start justify-between gap-3">
                  <Link href={`/outreach/opportunites?q=${id}`} className="min-w-0 text-navy hover:underline [overflow-wrap:anywhere]">
                    {topOpps?.find((o) => o.id === id)?.title ?? id}
                  </Link>
                  <span className="shrink-0 font-semibold tabular-nums">{fmtN(n)}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Dernières campagnes" action={<Link href="/outreach/campagnes" className="text-sm font-semibold text-teal-700 hover:underline">Toutes les campagnes</Link>}>
          {!campaigns?.length ? (
            <EmptyState title="Aucune campagne" description="La première campagne sera préparée automatiquement après la prochaine collecte d'opportunités, ou dès maintenant avec le bouton « Préparer la campagne du jour »." />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead className="text-left text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="py-2 pr-3 font-semibold">Date</th>
                    <th className="py-2 pr-3 font-semibold">Statut</th>
                    <th className="py-2 pr-3 text-right font-semibold">Opportunités</th>
                    <th className="py-2 pr-3 text-right font-semibold">Entreprises</th>
                    <th className="py-2 text-right font-semibold">E-mails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {campaigns.map((c) => {
                    const s = (c.stats ?? {}) as Stats;
                    return (
                      <tr key={c.id}>
                        <td className="py-2.5 pr-3">
                          <Link href={`/outreach/campagnes/${c.id}`} className="font-semibold text-navy hover:underline">
                            {campaignLabel(c).replace(/^Campagne (du )?/, "")}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-3">
                          <StatusBadge map={CAMPAIGN_STATUS} status={c.status} />
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{fmtN(s.opportunities_eligible ?? 0)}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{fmtN(s.companies_selected ?? 0)}</td>
                        <td className="py-2.5 text-right tabular-nums">{fmtN(s.emails_prepared ?? 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title="Base d'entreprises">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Entreprises" value={prospects.count ?? 0} href="/outreach/prospects" />
            <Stat label="Contactables" value={withEmail.count ?? 0} hint="actives avec e-mail" href="/outreach/prospects?email=1" />
            <Stat label="Ne plus contacter" value={dnc.count ?? 0} href="/outreach/exclusions" />
            <Stat label="Score minimum" value={settings ? `${settings.min_score}/100` : "—"} href="/outreach/parametres" />
          </div>
        </Panel>
      </div>
    </>
  );
}
