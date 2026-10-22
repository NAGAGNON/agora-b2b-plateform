import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProcessNeedsButton, RerunNeedButton } from "@/components/admin/need-actions";
import { needAlert, needMetrics, type NeedAnalysis } from "@/lib/needs";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Besoins et mise en relation" };
export const maxDuration = 120;

const STATUS: Record<string, string> = { RUNNING: "En cours", CLOSED: "Clôturée", FAILED: "En échec", ANALYZED: "Analysée", SKIPPED: "Ignorée" };

/**
 * Suivi de la mise en relation de chaque besoin publié par une entreprise inscrite : entreprises
 * identifiées et prévenues, e-mails de prospection, vues, clics, réponses. Chiffres réels uniquement
 * (« préparés » = prévus, « envoyés » = acceptés par le serveur d'envoi).
 */
export default async function AdminNeeds() {
  await requireAdmin();
  const db = createAdminClient();
  const { data: needs } = await db
    .from("opportunities")
    .select("id, title, status, published_at, response_deadline, is_demo, company:companies(name)")
    .eq("origin", "INTERNAL")
    .eq("visibility", "PUBLIC")
    .eq("is_demo", false)
    .in("status", ["PUBLISHED", "EXPIRED", "CLOSED"])
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(40);
  const rows = needs ?? [];
  const { data: campaigns } = rows.length ? await db.from("need_campaigns").select("opportunity_id, status, analysis, note, error, last_run_at, outreach_campaign_id").in("opportunity_id", rows.map((r) => r.id)) : { data: [] };
  const byId = new Map((campaigns ?? []).map((c) => [c.opportunity_id, c]));
  const metrics = await Promise.all(rows.map((r) => needMetrics(db, r.id)));
  const total = metrics.reduce(
    (a, m) => ({ notified: a.notified + m.membersNotified, sent: a.sent + m.emailsSent, views: a.views + m.views, clicks: a.clicks + m.messageClicks, answers: a.answers + m.interests + m.proposals }),
    { notified: 0, sent: 0, views: 0, clicks: 0, answers: 0 },
  );
  const n = (v: number) => new Intl.NumberFormat("fr-FR").format(v);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Besoins et mise en relation</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Chaque besoin publié par une entreprise inscrite est analysé dès sa validation : entreprises inscrites correspondantes prévenues (au plus 25, une relance
            après 5 jours), campagne de prospection dédiée dans l&apos;Outreach (au plus 30 entreprises, mêmes limites et exclusions), suivi des résultats. Les besoins
            manqués sont repris chaque jour.
          </p>
        </div>
        <ProcessNeedsButton />
      </div>

      <section aria-label="Totaux" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Entreprises inscrites prévenues", total.notified],
          ["E-mails de prospection envoyés", total.sent],
          ["Vues des besoins", total.views],
          ["Clics « Envoyer un message »", total.clicks],
          ["Intérêts et réponses", total.answers],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{l}</p>
            <p className="mt-1 text-2xl font-bold text-navy tabular-nums">{n(Number(v))}</p>
          </div>
        ))}
      </section>

      <Card>
        <CardHeader title={`${rows.length} besoin(s) publié(s)`} description="« Préparés » : e-mails prévus, en attente d'envoi (limites quotidiennes, validation). « Sans adresse » : recherche d'adresse générique en cours." />
        {!rows.length ? (
          <div className="p-5">
            <EmptyState title="Aucun besoin publié pour le moment" description="Dès qu'une entreprise publie un besoin, sa mise en relation apparaît ici." />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100" data-testid="needs-table">
            {rows.map((r, i) => {
              const m = metrics[i];
              const c = byId.get(r.id);
              const a = (c?.analysis ?? {}) as Partial<NeedAnalysis>;
              const alert = r.status === "PUBLISHED" ? needAlert(m, r.published_at) : null;
              const company = Array.isArray(r.company) ? r.company[0] : r.company;
              return (
                <li key={r.id} className="space-y-3 p-5" data-testid="need-row">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/opportunites/${r.id}`} className="font-semibold text-navy hover:underline">
                        {r.title}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {company?.name ?? "—"} · publié le {formatDate(r.published_at)}
                        {r.response_deadline ? ` · réponse avant le ${formatDate(r.response_deadline)}` : ""}
                      </p>
                      {c && (
                        <p className="mt-1 text-xs text-slate-600">
                          Analyse : {[a.sector_label, a.zone?.department_name ?? a.zone?.region, a.skills?.length ? `${a.skills.length} compétence(s)` : null, a.budget, a.target_size].filter(Boolean).join(" · ") || "données limitées"}
                          {a.profiles?.length ? ` — métiers ciblés : ${a.profiles.slice(0, 3).join(", ")}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {alert && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{alert}</span>}
                      <StatusBadge kind="opportunity" status={r.status} />
                      <span className="rounded-full bg-sky px-2 py-0.5 text-xs font-semibold text-navy">{c ? (STATUS[c.status] ?? c.status) : "Pas encore analysé"}</span>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:grid-cols-8">
                    {[
                      ["Inscrites identifiées", `${m.membersIdentified} (${m.membersRelevant} pertinentes)`],
                      ["Inscrites prévenues", `${m.membersNotified}${m.membersReminded ? ` + ${m.membersReminded} relance(s)` : ""}`],
                      ["Prospects retenus", `${m.prospectsRelevant} / ${m.prospectsIdentified}`],
                      ["E-mails", `${m.emailsSent} envoyé(s)${m.emailsPrepared ? `, ${m.emailsPrepared} préparé(s)` : ""}${m.emailsWaitingAddress ? `, ${m.emailsWaitingAddress} sans adresse` : ""}${m.emailsSimulated ? `, ${m.emailsSimulated} simulé(s)` : ""}`],
                      ["Ouverts / clics e-mail", `${m.emailsOpened} / ${m.emailsClicked}`],
                      ["Vues · « Envoyer un message »", `${m.views} · ${m.messageClicks}`],
                      ["Intérêts · réponses", `${m.interests} · ${m.proposals}`],
                      ["Échanges · retenue", `${m.conversations} · ${m.selected}${m.outcome === "AWARDED" ? " (attribué)" : ""}`],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-slate-50 p-2">
                        <dt className="text-xs text-slate-500">{k}</dt>
                        <dd className="font-semibold text-navy">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      {c?.error ? <span className="text-red-700">Erreur : {c.error} </span> : null}
                      {c?.note ?? ""}
                      {c?.last_run_at ? ` Dernier passage : ${formatDate(c.last_run_at)}.` : ""}
                      {c?.outreach_campaign_id && (
                        <>
                          {" "}
                          <Link href={`/outreach/campagnes/${c.outreach_campaign_id}`} className="font-semibold text-teal-700 underline">
                            Campagne de prospection
                          </Link>
                        </>
                      )}
                    </p>
                    {r.status === "PUBLISHED" && <RerunNeedButton id={r.id} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Notice tone="info">
        Les e-mails de prospection partent dans la limite quotidienne et le rythme fixés dans l&apos;Outreach, uniquement vers des adresses génériques d&apos;entreprise,
        avec désinscription en un clic. Si l&apos;Outreach exige une validation, chaque campagne dédiée attend votre accord dans Outreach → Campagnes.
      </Notice>
    </div>
  );
}
