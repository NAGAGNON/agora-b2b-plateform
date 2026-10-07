import { createClient } from "@/lib/supabase/server";
import { formatDate, isUuid } from "@/lib/format";
import { OPP_STATE, PageHead, Panel, StatusBadge, fmtN } from "@/components/outreach/ui";
import { LinkTabs } from "@/components/ui/tabs";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/states";

export const metadata = { title: "Opportunités" };
const PER_PAGE = 50;
const TABS = [
  { key: "NEW", label: "Nouvelles" },
  { key: "PROCESSED", label: "Traitées" },
  { key: "MODIFIED", label: "Modifiées" },
  { key: "EXPIRED", label: "Expirées" },
  { key: "ALL", label: "Toutes" },
];

export default async function OutreachOpportunitiesPage(props: PageProps<"/outreach/opportunites">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const tab = TABS.find((t) => t.key === sp.etat)?.key ?? (q ? "ALL" : "PROCESSED");
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  let query = supabase
    .from("outreach_opportunity_states")
    .select("opportunity_id, status, first_seen_at, processed_at, matches_count, target_profiles, opportunity:opportunities!inner(id, title, sector_slug, department_code, region, response_deadline, external_buyer_name)", { count: "exact" });
  if (tab !== "ALL") query = query.eq("status", tab);
  if (q) query = isUuid(q) ? query.eq("opportunity_id", q) : query.ilike("opportunity.title", `%${q.replace(/[%_]/g, "")}%`);
  const [{ data, count }, counts, { data: sectors }] = await Promise.all([
    query.order("first_seen_at", { ascending: false }).range((page - 1) * PER_PAGE, page * PER_PAGE - 1),
    Promise.all(TABS.map((t) => (t.key === "ALL" ? supabase.from("outreach_opportunity_states").select("opportunity_id", { count: "exact", head: true }) : supabase.from("outreach_opportunity_states").select("opportunity_id", { count: "exact", head: true }).eq("status", t.key)))),
    supabase.from("sectors").select("slug, label"),
  ]);
  const ids = (data ?? []).map((d) => d.opportunity_id);
  const { data: ev } = ids.length ? await supabase.from("outreach_events").select("opportunity_id, type").in("opportunity_id", ids).in("type", ["OPPORTUNITY_VIEW"]).limit(20_000) : { data: [] };
  const { data: proposed } = ids.length ? await supabase.from("outreach_recipient_opportunities").select("opportunity_id, recipient:outreach_recipients!inner(status)").in("opportunity_id", ids).in("recipient.status", ["SENT", "SIMULATED"]).eq("excluded", false).limit(50_000) : { data: [] };
  const views = new Map<string, number>();
  for (const e of ev ?? []) views.set(e.opportunity_id!, (views.get(e.opportunity_id!) ?? 0) + 1);
  const sent = new Map<string, number>();
  for (const p of proposed ?? []) sent.set(p.opportunity_id, (sent.get(p.opportunity_id) ?? 0) + 1);
  const label = new Map((sectors ?? []).map((s) => [s.slug, s.label]));
  return (
    <>
      <PageHead
        title="Opportunités"
        description="Opportunités LinkProB2B suivies par Outreach. Une opportunité expirée (clôturée, retirée ou échéance trop proche) n'est jamais proposée ; une opportunité modifiée après envoi est signalée mais pas renvoyée."
      />
      <Panel title="Suivi des opportunités">
        <LinkTabs active={tab} tabs={TABS.map((t, i) => ({ key: t.key, label: t.label, count: counts[i].count ?? 0, href: `/outreach/opportunites?etat=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}` }))} />
        <form className="mb-4 flex gap-2" role="search">
          <input type="hidden" name="etat" value={tab} />
          <input name="q" defaultValue={q} placeholder="Titre de l'opportunité" aria-label="Rechercher une opportunité" className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm" />
          <button className="h-10 rounded-lg bg-navy px-4 text-sm font-semibold text-white">Rechercher</button>
        </form>
        {!data?.length ? (
          <EmptyState title="Aucune opportunité" description="Les opportunités publiées sur LinkProB2B sont synchronisées chaque matin, ou à la demande depuis la vue d'ensemble." />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="text-left text-xs text-slate-500 uppercase">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Opportunité</th>
                  <th className="py-2 pr-3 font-semibold">État</th>
                  <th className="py-2 pr-3 font-semibold">Profils ciblés</th>
                  <th className="py-2 pr-3 text-right font-semibold">Entreprises</th>
                  <th className="py-2 pr-3 text-right font-semibold">E-mails</th>
                  <th className="py-2 text-right font-semibold">Consultations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((s) => {
                  const o = s.opportunity as unknown as { id: string; title: string; sector_slug: string | null; department_code: string | null; region: string | null; response_deadline: string | null; external_buyer_name: string | null };
                  return (
                    <tr key={s.opportunity_id} className="align-top">
                      <td className="max-w-md py-3 pr-3">
                        <a href={`/opportunites/${o.id}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy hover:underline [overflow-wrap:anywhere]">
                          {o.title}
                        </a>
                        <p className="text-xs text-slate-500">
                          {[o.sector_slug && label.get(o.sector_slug), o.department_code ?? o.region, o.response_deadline && `échéance ${formatDate(o.response_deadline)}`].filter(Boolean).join(" · ")}
                        </p>
                        <p className="text-xs text-slate-400">Vue le {formatDate(s.first_seen_at)}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <StatusBadge map={OPP_STATE} status={s.status} />
                      </td>
                      <td className="py-3 pr-3 text-xs text-slate-600">{s.target_profiles.slice(0, 3).join(", ") || "—"}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">{fmtN(s.matches_count)}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">{fmtN(sent.get(s.opportunity_id) ?? 0)}</td>
                      <td className="py-3 text-right font-semibold tabular-nums">{fmtN(views.get(s.opportunity_id) ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageCount={Math.ceil((count ?? 0) / PER_PAGE)} basePath="/outreach/opportunites" params={sp} />
      </Panel>
    </>
  );
}
