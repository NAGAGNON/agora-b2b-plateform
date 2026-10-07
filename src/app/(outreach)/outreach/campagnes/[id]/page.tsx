import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, isUuid } from "@/lib/format";
import { realSendBlockers, type OutreachSettings } from "@/lib/outreach/data";
import { CAMPAIGN_STATUS, PageHead, Panel, RECIPIENT_STATUS, ScoreBadge, Stat, StatusBadge, fmtN, pct } from "@/components/outreach/ui";
import { CampaignActions, OpportunityToggle, RecipientToggle, TemplateEditor } from "@/components/outreach/campaign-controls";
import { RunNowButton } from "@/components/outreach/run-button";
import { LinkTabs } from "@/components/ui/tabs";
import { Notice } from "@/components/ui/notice";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/states";

export const metadata = { title: "Campagne" };
const PER_PAGE = 50;
type Stats = Record<string, number>;

const FILTERS: { key: string; label: string; statuses: string[] | null }[] = [
  { key: "a-envoyer", label: "À envoyer", statuses: ["PENDING", "QUEUED"] },
  { key: "envoyes", label: "Envoyés", statuses: ["SENT", "SIMULATED", "FAILED"] },
  { key: "sans-email", label: "Sans e-mail", statuses: ["NO_EMAIL"] },
  { key: "exclus", label: "Exclus", statuses: ["EXCLUDED", "SUPPRESSED", "FREQUENCY"] },
  { key: "tous", label: "Tous", statuses: null },
];

export default async function CampaignPage(props: PageProps<"/outreach/campagnes/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { data: c } = await supabase.from("outreach_campaigns").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const filter = FILTERS.find((f) => f.key === sp.statut) ?? FILTERS[0];
  const page = Math.max(1, Number(sp.page) || 1);
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";

  let rq = supabase
    .from("outreach_recipients")
    .select("id, score, reasons, status, email, error, sent_at, clicked_at, signed_up_at, prospect:outreach_prospects!inner(id, name, city, department_code, naf_code), items:outreach_recipient_opportunities(opportunity_id, excluded)", { count: "exact" })
    .eq("campaign_id", id);
  if (filter.statuses) rq = rq.in("status", filter.statuses);
  if (q) rq = rq.ilike("prospect.name", `%${q.replace(/[%_]/g, "")}%`);
  const [{ data: recipients, count }, { data: live }, { data: settings }, counts, { data: oppLinks }] = await Promise.all([
    rq.order("score", { ascending: false }).range((page - 1) * PER_PAGE, page * PER_PAGE - 1),
    supabase.rpc("outreach_campaign_stats", { p_campaign_id: id }),
    supabase.from("outreach_settings").select("*").eq("id", true).maybeSingle(),
    Promise.all(FILTERS.map((f) => (f.statuses ? supabase.from("outreach_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", id).in("status", f.statuses) : supabase.from("outreach_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", id)))),
    supabase.from("outreach_opportunity_states").select("opportunity_id, matches_count, target_profiles, opportunity:opportunities(id, title, sector_slug, department_code, response_deadline)").eq("last_campaign_id", id).order("matches_count", { ascending: false }).limit(200),
  ]);
  const s = (c.stats ?? {}) as Stats;
  const l = (live ?? {}) as Stats;
  const blockers = settings ? realSendBlockers(settings as OutreachSettings) : [];
  const sendable = l.prepared ? (counts[0].count ?? 0) : 0;
  const sentish = (l.sent ?? 0) + (l.simulated ?? 0);
  // Exclusion globale d'une opportunité = retirée pour tous les destinataires
  const { data: excludedRows } = await supabase
    .from("outreach_recipient_opportunities")
    .select("opportunity_id, recipient:outreach_recipients!inner(campaign_id)")
    .eq("recipient.campaign_id", id)
    .eq("excluded", true)
    .limit(5000);
  const excludedCount = new Map<string, number>();
  for (const r of excludedRows ?? []) excludedCount.set(r.opportunity_id, (excludedCount.get(r.opportunity_id) ?? 0) + 1);

  return (
    <>
      <Link href="/outreach/campagnes" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-navy">
        <ArrowLeft className="size-4" aria-hidden /> Campagnes
      </Link>
      <PageHead
        title={`Campagne du ${formatDate(c.campaign_date)}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge map={CAMPAIGN_STATUS} status={c.status} />
            {c.status === "READY" ? "Prévisualisation : vérifiez les entreprises, les opportunités et l'e-mail avant de valider." : null}
            {c.validated_at && <span className="text-sm">Validée le {formatDateTime(c.validated_at)}{c.dry_run ? " (simulation)" : ""}</span>}
          </span>
        }
        action={
          <div className="flex flex-wrap gap-2">
            {c.status === "READY" && <RunNowButton force label="Reconstruire" />}
            <CampaignActions campaignId={c.id} status={c.status} blockers={blockers} sendable={sendable} />
          </div>
        }
      />
      {c.status === "READY" && blockers.length > 0 && (
        <Notice tone="info" className="mb-6" title="Envoi réel indisponible — la simulation reste possible">
          {blockers.join(" ")}
        </Notice>
      )}
      {c.error && (
        <Notice tone="error" className="mb-6" title="La préparation a échoué">
          {c.error}
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
        <Stat label="Nouvelles opp." value={s.opportunities_eligible ?? 0} />
        <Stat label="Entreprises analysées" value={s.prospects_analyzed ?? 0} />
        <Stat label="Correspondances" value={s.matches ?? 0} hint={`score ≥ ${c.min_score}`} />
        <Stat label="Sélectionnées" value={l.selected ?? 0} />
        <Stat label="E-mails préparés" value={l.prepared ?? 0} hint={l.no_email ? `${fmtN(l.no_email)} sans e-mail` : undefined} />
        <Stat label="Envoyés" value={l.sent ?? 0} hint={l.simulated ? `${fmtN(l.simulated)} simulé(s)` : undefined} tone="accent" />
        <Stat label="Clics" value={l.clicked ?? 0} hint={sentish ? pct(l.clicked ?? 0, sentish) : undefined} />
        <Stat label="Inscriptions" value={l.signups ?? 0} hint={l.conversions ? `${fmtN(l.conversions)} conversion(s)` : undefined} />
      </div>

      {c.report && (
        <Panel title="Rapport de la campagne" className="mt-6">
          <p className="text-sm whitespace-pre-line text-slate-700">{c.report}</p>
        </Panel>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Panel title="Entreprises ciblées" description="Une entreprise = un seul e-mail regroupant ses opportunités pertinentes.">
          <LinkTabs
            active={filter.key}
            tabs={FILTERS.map((f, i) => ({ key: f.key, label: f.label, count: counts[i].count ?? 0, href: `/outreach/campagnes/${id}?statut=${f.key}` }))}
          />
          <form className="mb-4 flex gap-2" role="search">
            <input type="hidden" name="statut" value={filter.key} />
            <input name="q" defaultValue={q} placeholder="Rechercher une entreprise" aria-label="Rechercher une entreprise" className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm" />
            <button className="h-10 rounded-lg bg-navy px-4 text-sm font-semibold text-white">Rechercher</button>
          </form>
          {!recipients?.length ? (
            <EmptyState title="Aucune entreprise dans cette catégorie" description={filter.key === "a-envoyer" ? "Les entreprises sans e-mail apparaissent dans l'onglet « Sans e-mail » : ajoutez une adresse professionnelle d'origine autorisée pour pouvoir les contacter." : undefined} />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="text-left text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="py-2 pr-3 font-semibold">Entreprise</th>
                    <th className="py-2 pr-3 font-semibold">Score</th>
                    <th className="py-2 pr-3 text-right font-semibold">Opp.</th>
                    <th className="py-2 pr-3 font-semibold">Statut</th>
                    <th className="py-2 font-semibold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recipients.map((r) => {
                    const p = r.prospect as unknown as { id: string; name: string; city: string | null; department_code: string | null; naf_code: string | null };
                    const items = (r.items ?? []) as { opportunity_id: string; excluded: boolean }[];
                    const kept = items.filter((i) => !i.excluded).length;
                    return (
                      <tr key={r.id} className="align-top">
                        <td className="py-3 pr-3">
                          <Link href={`/outreach/campagnes/${id}/destinataires/${r.id}`} className="font-semibold text-navy hover:underline">
                            {p.name}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {[p.city, p.department_code && `(${p.department_code})`, p.naf_code && `NAF ${p.naf_code}`].filter(Boolean).join(" ")}
                            {r.email ? ` · ${r.email}` : ""}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-600" title={r.reasons.join(" · ")}>{r.reasons.slice(0, 3).join(" · ")}</p>
                        </td>
                        <td className="py-3 pr-3">
                          <ScoreBadge score={r.score} />
                        </td>
                        <td className="py-3 pr-3 text-right tabular-nums">{kept}</td>
                        <td className="py-3 pr-3">
                          <StatusBadge map={RECIPIENT_STATUS} status={r.status} />
                          {r.clicked_at && <span className="mt-1 block text-xs text-teal-700">a cliqué</span>}
                          {r.signed_up_at && <span className="block text-xs font-semibold text-teal-700">inscrite</span>}
                          {r.error && <span className="mt-1 block text-xs text-slate-500">{r.error}</span>}
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1">
                            <Link href={`/outreach/campagnes/${id}/destinataires/${r.id}`} className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-navy hover:bg-sky">
                              Aperçu
                            </Link>
                            {c.status === "READY" && ["PENDING", "NO_EMAIL", "EXCLUDED"].includes(r.status) && <RecipientToggle recipientId={r.id} excluded={r.status === "EXCLUDED"} />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} pageCount={Math.ceil((count ?? 0) / PER_PAGE)} basePath={`/outreach/campagnes/${id}`} params={sp} />
        </Panel>

        <div className="space-y-6">
          {c.status === "READY" && (
            <Panel title="Modèle de l'e-mail" description="S'applique à toutes les entreprises de cette campagne.">
              <TemplateEditor campaignId={c.id} subject={c.subject_template} intro={c.intro_template} />
            </Panel>
          )}
          <Panel title="Opportunités de la campagne" description="Nombre d'entreprises correspondantes par opportunité.">
            {!oppLinks?.length ? (
              <p className="text-sm text-slate-500">Aucune opportunité traitée.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {oppLinks.map((o) => {
                  const opp = o.opportunity as unknown as { id: string; title: string; response_deadline: string | null } | null;
                  if (!opp) return null;
                  const excluded = (excludedCount.get(opp.id) ?? 0) > 0 && (excludedCount.get(opp.id) ?? 0) >= o.matches_count && o.matches_count > 0;
                  return (
                    <li key={o.opportunity_id} className="border-b border-slate-100 pb-3 last:border-0">
                      <a href={`/opportunites/${opp.id}`} target="_blank" rel="noopener noreferrer" className={`font-semibold hover:underline [overflow-wrap:anywhere] ${excluded ? "text-slate-400 line-through" : "text-navy"}`}>
                        {opp.title}
                      </a>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {fmtN(o.matches_count)} entreprise(s) · échéance {formatDate(opp.response_deadline)}
                        {o.target_profiles.length > 0 && <span className="block">Profils : {o.target_profiles.slice(0, 3).join(", ")}</span>}
                      </p>
                      {c.status === "READY" && o.matches_count > 0 && <OpportunityToggle opportunityId={opp.id} campaignId={c.id} excluded={excluded} label={excluded ? "Remettre pour tous" : "Retirer pour tous"} />}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
