import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FileText, Users, Inbox, Star, Scale } from "lucide-react";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, DashboardCard } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { LinkTabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/states";
import { DemoBadge } from "@/components/demo";
import { OpportunityTypeBadge } from "@/components/opportunities/opportunity-badge";
import { ContactSupplierButton, DecisionButtons, DeleteDocumentButton, EvaluationForm, LifecycleActions } from "@/components/dashboard/buyer-actions";
import { DocumentUploadForm } from "@/components/dashboard/document-upload";
import { OUTCOME_LABELS } from "@/lib/constants";
import { formatBytes, formatDate, formatDateTime, formatMoney, relativeTime } from "@/lib/format";

export const metadata = { title: "Gérer une consultation" };

export default async function ManageOpportunityPage(props: PageProps<"/dashboard/opportunites/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const session = await requireCompany(`/dashboard/opportunites/${id}`);
  const supabase = await createClient();
  const { data: o } = await supabase.from("opportunities").select("*, documents:opportunity_documents(id, file_name, size_bytes, created_at)").eq("id", id).maybeSingle();
  if (!o || !session.memberships.some((m) => m.company.id === o.company_id)) notFound();

  const [{ data: interests }, { data: proposals }, { data: evaluations }, { data: conversations }] = await Promise.all([
    supabase.from("interests").select("id, status, message, created_at, company:companies(id, slug, name, city, verified_at)").eq("opportunity_id", id).order("created_at"),
    supabase
      .from("proposals")
      .select("*, company:companies(id, slug, name, city, verified_at), documents:proposal_documents(id, file_name, size_bytes)")
      .eq("opportunity_id", id)
      .order("submitted_at"),
    supabase.from("proposal_evaluations").select("proposal_id, score, note"),
    supabase.from("conversations").select("id, supplier_company_id").eq("opportunity_id", id),
  ]);
  const evalBy = new Map((evaluations ?? []).map((e) => [e.proposal_id, e]));
  const convBy = new Map((conversations ?? []).map((c) => [c.supplier_company_id, c.id]));
  const activeProposals = (proposals ?? []).filter((p) => p.status !== "WITHDRAWN");
  const activeInterests = (interests ?? []).filter((i) => i.status !== "WITHDRAWN");
  // Shortlist : une entrée par entreprise (réponse prioritaire sur l'intérêt).
  const shortlistMap = new Map<string, { key: string; company: (typeof activeInterests)[number]["company"]; kind: string; status: string }>();
  for (const i of activeInterests.filter((x) => ["SHORTLISTED", "ACCEPTED"].includes(x.status))) {
    const c = Array.isArray(i.company) ? i.company[0] : i.company;
    if (c) shortlistMap.set(c.id, { key: `i-${i.id}`, company: i.company, kind: "Intérêt", status: i.status });
  }
  for (const p of activeProposals.filter((x) => ["SHORTLISTED", "SELECTED"].includes(x.status))) {
    const c = Array.isArray(p.company) ? p.company[0] : p.company;
    if (c) shortlistMap.set(c.id, { key: `p-${p.id}`, company: p.company, kind: "Réponse", status: p.status });
  }
  const shortlist = [...shortlistMap.values()];
  const deadlinePassed = o.response_deadline && new Date(o.response_deadline) < new Date();
  const effective = o.status === "PUBLISHED" && deadlinePassed ? "EXPIRED" : o.status;
  const decisionsOpen = ["PUBLISHED", "EXPIRED"].includes(o.status);
  const tab = typeof sp.onglet === "string" ? sp.onglet : "reponses";
  const base = `/dashboard/opportunites/${id}`;
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/opportunites" className="text-sm font-semibold text-teal-700 hover:underline">
        ← Mes opportunités
      </Link>
      {sp.cree === "submit" && <Notice tone="success" title="Publication envoyée en validation">Vous serez notifié dès qu&apos;elle sera publiée.</Notice>}
      {sp.cree === "draft" && <Notice tone="success">Brouillon enregistré. Vous pouvez le compléter puis le soumettre à validation.</Notice>}
      {sp.modifie && (
        <Notice tone="success">
          Modifications enregistrées.{o.status === "PENDING_REVIEW" ? " Le contenu modifié repasse en validation avant d'être republié." : ""}
        </Notice>
      )}
      {typeof sp.erreur === "string" && <Notice tone="error">{sp.erreur}</Notice>}
      {o.moderation_note && ["CHANGES_REQUESTED", "REJECTED", "SUSPENDED"].includes(o.status) && (
        <Notice tone={o.status === "CHANGES_REQUESTED" ? "warning" : "error"} title="Message de la modération">
          {o.moderation_note}
        </Notice>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge kind="opportunity" status={effective} />
          <OpportunityTypeBadge type={o.type} />
          {o.is_demo && <DemoBadge />}
        </div>
        <h1 className="mt-3 text-2xl font-bold">{o.title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {o.published_at ? `Publiée le ${formatDate(o.published_at)}` : `Créée le ${formatDate(o.created_at)}`}
          {o.response_deadline ? ` · Date limite : ${formatDateTime(o.response_deadline)}` : ""}
          {o.max_suppliers ? ` · ${o.max_suppliers} fournisseur(s) souhaité(s)` : ""}
        </p>
        {o.status === "CLOSED" && o.outcome && (
          <p className="mt-2 text-sm font-semibold text-navy">
            Clôturée le {formatDate(o.closed_at)} — {OUTCOME_LABELS[o.outcome]}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <LifecycleActions
            id={o.id}
            status={o.status}
            proposals={activeProposals.map((p) => ({ id: p.id, label: `${one(p.company)?.name ?? "Fournisseur"}${p.price_amount != null ? ` — ${formatMoney(p.price_amount)}` : ""}` }))}
          />
          <Link href={`/opportunites/${o.id}`} className="inline-flex items-center gap-1 px-2 text-sm font-semibold text-teal-700 hover:underline">
            Voir la fiche <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DashboardCard label="Fournisseurs intéressés" value={activeInterests.length} icon={<Users className="size-5" aria-hidden />} />
        <DashboardCard label="Réponses reçues" value={activeProposals.length} icon={<Inbox className="size-5" aria-hidden />} />
        <DashboardCard label="Shortlist" value={shortlist.length} icon={<Star className="size-5" aria-hidden />} />
        <DashboardCard label="Documents" value={o.documents.length} icon={<FileText className="size-5" aria-hidden />} />
      </div>

      <LinkTabs
        active={tab}
        tabs={[
          { key: "reponses", label: "Réponses", href: `${base}?onglet=reponses`, count: activeProposals.length },
          { key: "interesses", label: "Fournisseurs intéressés", href: `${base}?onglet=interesses`, count: activeInterests.length },
          { key: "comparer", label: "Comparer", href: `${base}?onglet=comparer` },
          { key: "shortlist", label: "Shortlist", href: `${base}?onglet=shortlist`, count: shortlist.length },
          { key: "documents", label: "Documents et critères", href: `${base}?onglet=documents` },
        ]}
      />

      {tab === "reponses" &&
        (activeProposals.length === 0 ? (
          <EmptyState title="Aucune réponse pour le moment" description="Les réponses des fournisseurs apparaîtront ici, avec leurs prix, délais et pièces jointes." />
        ) : (
          <ul className="space-y-4">
            {(proposals ?? []).map((p) => {
              const c = one(p.company);
              const ev = evalBy.get(p.id);
              return (
                <li key={p.id}>
                  <Card className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link href={`/entreprises/${c?.slug}`} className="text-lg font-bold text-navy hover:text-teal-700">
                          {c?.name}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {c?.city} · reçue {relativeTime(p.submitted_at)}
                        </p>
                      </div>
                      <StatusBadge kind="proposal" status={p.status} />
                    </div>
                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-xs font-semibold text-slate-500 uppercase">Prix</dt>
                        <dd className="font-semibold text-navy">{p.price_amount != null ? `${formatMoney(p.price_amount)} HT` : "Non chiffré"}</dd>
                        {p.price_details && <dd className="text-xs text-slate-500">{p.price_details}</dd>}
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-slate-500 uppercase">Délai</dt>
                        <dd className="text-navy">{p.lead_time ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-slate-500 uppercase">Validité</dt>
                        <dd className="text-navy">{formatDate(p.valid_until)}</dd>
                      </div>
                    </dl>
                    <p className="mt-4 text-sm whitespace-pre-line text-slate-700">{p.message}</p>
                    {p.proposal_text && (
                      <details className="mt-3 text-sm">
                        <summary className="cursor-pointer font-semibold text-teal-700">Proposition détaillée</summary>
                        <p className="mt-2 whitespace-pre-line text-slate-700">{p.proposal_text}</p>
                      </details>
                    )}
                    {p.additional_info && <p className="mt-3 text-sm text-slate-600">Informations complémentaires : {p.additional_info}</p>}
                    {p.documents.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {p.documents.map((d) => (
                          <li key={d.id}>
                            <a href={`/api/fichiers/reponse/${d.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-navy hover:border-teal">
                              <FileText className="size-3.5" aria-hidden /> {d.file_name} ({formatBytes(d.size_bytes)})
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                    {p.status !== "WITHDRAWN" && (
                      <>
                        <EvaluationForm proposalId={p.id} opportunityId={o.id} score={ev?.score ?? null} note={ev?.note ?? null} />
                        <div className="mt-4 flex flex-wrap gap-2">
                          <DecisionButtons kind="proposal" targetId={p.id} opportunityId={o.id} current={p.status} disabled={!decisionsOpen} />
                          {c && <ContactSupplierButton opportunityId={o.id} supplierCompanyId={c.id} existingConversationId={convBy.get(c.id)} />}
                        </div>
                      </>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        ))}

      {tab === "interesses" &&
        (activeInterests.length === 0 ? (
          <EmptyState title="Aucun fournisseur intéressé pour le moment" description="Les manifestations d'intérêt apparaîtront ici." />
        ) : (
          <ul className="space-y-3">
            {(interests ?? []).map((i) => {
              const c = one(i.company);
              return (
                <li key={i.id}>
                  <Card className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link href={`/entreprises/${c?.slug}`} className="font-bold text-navy hover:text-teal-700">
                          {c?.name}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {c?.city} · {relativeTime(i.created_at)}
                        </p>
                      </div>
                      <StatusBadge kind="interest" status={i.status} />
                    </div>
                    {i.message && <p className="mt-3 text-sm whitespace-pre-line text-slate-700">{i.message}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <DecisionButtons kind="interest" targetId={i.id} opportunityId={o.id} current={i.status} disabled={!decisionsOpen} />
                      {c && i.status !== "WITHDRAWN" && <ContactSupplierButton opportunityId={o.id} supplierCompanyId={c.id} existingConversationId={convBy.get(c.id)} />}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        ))}

      {tab === "comparer" &&
        (activeProposals.length < 1 ? (
          <EmptyState icon={<Scale className="size-6" aria-hidden />} title="Rien à comparer pour le moment" description="Le tableau comparatif se remplit au fil des réponses reçues." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <caption className="sr-only">Comparaison des réponses</caption>
              <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">Fournisseur</th>
                  <th scope="col" className="px-4 py-3">Prix HT</th>
                  <th scope="col" className="px-4 py-3">Délai</th>
                  <th scope="col" className="px-4 py-3">Validité</th>
                  <th scope="col" className="px-4 py-3">Votre note</th>
                  <th scope="col" className="px-4 py-3">Pièces</th>
                  <th scope="col" className="px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...activeProposals]
                  .sort((a, b) => (a.price_amount ?? Infinity) - (b.price_amount ?? Infinity))
                  .map((p) => (
                    <tr key={p.id}>
                      <th scope="row" className="px-4 py-3 text-left font-semibold text-navy">
                        {one(p.company)?.name}
                      </th>
                      <td className="px-4 py-3 tabular-nums">{formatMoney(p.price_amount)}</td>
                      <td className="px-4 py-3">{p.lead_time ?? "—"}</td>
                      <td className="px-4 py-3">{formatDate(p.valid_until)}</td>
                      <td className="px-4 py-3">{evalBy.get(p.id)?.score ?? "—"}</td>
                      <td className="px-4 py-3">{p.documents.length}</td>
                      <td className="px-4 py-3">
                        <StatusBadge kind="proposal" status={p.status} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {o.criteria && <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Vos critères : {o.criteria}</p>}
          </div>
        ))}

      {tab === "shortlist" &&
        (shortlist.length === 0 ? (
          <EmptyState icon={<Star className="size-6" aria-hidden />} title="Shortlist vide" description="Présélectionnez des fournisseurs depuis les onglets « Réponses » ou « Fournisseurs intéressés »." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {shortlist.map((s) => {
              const c = one(s.company);
              return (
                <li key={s.key} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                  <span>
                    <span className="block font-semibold text-navy">{c?.name}</span>
                    <span className="text-xs text-slate-500">{s.kind}</span>
                  </span>
                  {s.kind === "Intérêt" ? <StatusBadge kind="interest" status={s.status as never} /> : <StatusBadge kind="proposal" status={s.status as never} />}
                </li>
              );
            })}
          </ul>
        ))}

      {tab === "documents" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Documents de la consultation" description="Accessibles aux membres connectés qui consultent l'opportunité." />
            <div className="p-5">
              {o.documents.length === 0 ? (
                <p className="text-sm text-slate-500">Aucun document.</p>
              ) : (
                <ul className="space-y-2">
                  {o.documents.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <FileText className="size-4 text-teal-700" aria-hidden />
                      <a href={`/api/fichiers/opportunite/${d.id}`} className="min-w-0 flex-1 truncate font-medium text-navy hover:underline">
                        {d.file_name}
                      </a>
                      <span className="text-xs text-slate-500">{formatBytes(d.size_bytes)}</span>
                      {!["ARCHIVED", "SUSPENDED"].includes(o.status) && <DeleteDocumentButton docId={d.id} opportunityId={o.id} />}
                    </li>
                  ))}
                </ul>
              )}
              {!["ARCHIVED", "SUSPENDED", "CLOSED"].includes(o.status) && <DocumentUploadForm opportunityId={o.id} />}
            </div>
          </Card>
          <Card>
            <CardHeader title="Critères et conditions" />
            <dl className="space-y-3 p-5 text-sm">
              <div>
                <dt className="font-semibold text-navy">Critères de sélection</dt>
                <dd className="whitespace-pre-line text-slate-700">{o.criteria ?? "Non précisés"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-navy">Contraintes</dt>
                <dd className="whitespace-pre-line text-slate-700">{o.constraints ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-navy">Confidentialité</dt>
                <dd className="text-slate-700">{o.visibility === "PUBLIC" ? "Publique" : "Réservée aux membres connectés"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-navy">Attestation de publication</dt>
                <dd className="text-slate-700">{o.publisher_attested_at ? `Confirmée le ${formatDateTime(o.publisher_attested_at)}` : "Non confirmée"}</dd>
              </div>
            </dl>
          </Card>
        </div>
      )}
    </div>
  );
}
