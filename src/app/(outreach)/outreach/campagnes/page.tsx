import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CAMPAIGN_STATUS, PageHead, Panel, StatusBadge, fmtN, pct } from "@/components/outreach/ui";
import { LaunchManualButton, RunNowButton } from "@/components/outreach/run-button";
import { campaignLabel } from "@/lib/outreach/matching";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";

// « Lancer une campagne maintenant » : chaîne complète (jusqu'à 5 minutes)
export const maxDuration = 300;

export const metadata = { title: "Campagnes" };
const PER_PAGE = 30;
type Stats = Record<string, number>;

export default async function CampaignsPage(props: PageProps<"/outreach/campagnes">) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  const { data, count } = await supabase
    .from("outreach_campaigns")
    .select("id, campaign_date, kind, launched_by, created_at, status, dry_run, stats", { count: "exact" })
    .order("campaign_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  const live = await Promise.all((data ?? []).map(async (c) => ((await supabase.rpc("outreach_campaign_stats", { p_campaign_id: c.id })).data ?? {}) as Stats));
  return (
    <>
      <PageHead
        title="Campagnes"
        description="Une campagne automatique par jour, construite à partir des nouvelles opportunités, et autant de campagnes manuelles que vous le souhaitez."
        action={
          <div className="flex flex-wrap gap-2">
            <LaunchManualButton />
            <RunNowButton />
          </div>
        }
      />
      <Panel title={`${fmtN(count ?? 0)} campagne(s)`}>
        {!data?.length ? (
          <EmptyState title="Aucune campagne pour le moment" description="Préparez la campagne du jour pour voir les entreprises sélectionnées et leurs e-mails." />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="text-left text-xs text-slate-500 uppercase">
                <tr>
                  {["Campagne", "Statut", "Nouvelles opp.", "Entreprises analysées", "Correspondances", "Sélectionnées", "E-mails préparés", "Envoyés", "Clics", "Inscriptions"].map((h, i) => (
                    <th key={h} className={`py-2 pr-3 font-semibold ${i > 1 ? "text-right" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((c, i) => {
                  const s = (c.stats ?? {}) as Stats;
                  const l = live[i];
                  const sentish = (l.sent ?? 0) + (l.simulated ?? 0);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-3 pr-3">
                        <Link href={`/outreach/campagnes/${c.id}`} className="font-semibold text-navy hover:underline">
                          {campaignLabel(c)}
                        </Link>
                      </td>
                      <td className="py-3 pr-3">
                        <StatusBadge map={CAMPAIGN_STATUS} status={c.status} />
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums">{fmtN(s.opportunities_eligible ?? 0)}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">{fmtN(s.prospects_analyzed ?? 0)}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">{fmtN(s.matches ?? 0)}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">{fmtN(l.selected ?? 0)}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">{fmtN(l.prepared ?? 0)}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">
                        {fmtN(l.sent ?? 0)}
                        {l.simulated ? <span className="block text-xs text-violet-700">{fmtN(l.simulated)} simulé(s)</span> : null}
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums">
                        {fmtN(l.clicked ?? 0)}
                        {sentish > 0 && <span className="block text-xs text-slate-500">{pct(l.clicked ?? 0, sentish)}</span>}
                      </td>
                      <td className="py-3 text-right tabular-nums">{fmtN(l.signups ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageCount={Math.ceil((count ?? 0) / PER_PAGE)} basePath="/outreach/campagnes" params={sp} />
      </Panel>
    </>
  );
}
