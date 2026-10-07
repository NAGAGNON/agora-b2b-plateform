import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDate, isUuid } from "@/lib/format";
import { PageHead, Panel, PROSPECT_STATUS, RECIPIENT_STATUS, ScoreBadge, StatusBadge } from "@/components/outreach/ui";
import { ProspectForm, ProspectStatusButtons } from "@/components/outreach/prospect-forms";
import { Notice } from "@/components/ui/notice";

export const metadata = { title: "Fiche entreprise" };

export default async function ProspectPage(props: PageProps<"/outreach/prospects/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data: p } = await supabase.from("outreach_prospects").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const [{ data: sectors }, { data: departments }, { data: history }] = await Promise.all([
    supabase.from("sectors").select("slug, label").eq("is_active", true).order("sort_order"),
    supabase.from("departments").select("code, name").order("code"),
    supabase
      .from("outreach_recipients")
      .select("id, score, status, sent_at, clicked_at, signed_up_at, unsubscribed_at, campaign:outreach_campaigns(id, campaign_date), items:outreach_recipient_opportunities(opportunity_id)")
      .eq("prospect_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  return (
    <>
      <Link href="/outreach/prospects" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-navy">
        <ArrowLeft className="size-4" aria-hidden /> Entreprises
      </Link>
      <PageHead
        title={p.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge map={PROSPECT_STATUS} status={p.status} />
            {p.siren && <span className="text-sm">SIREN {p.siren}</span>}
            {p.size_range && <span className="text-sm">· {p.size_range}</span>}
          </span>
        }
        action={<ProspectStatusButtons id={p.id} status={p.status} />}
      />
      {p.excluded_reason && (
        <Notice tone="warning" className="mb-6">
          {p.excluded_reason}
        </Notice>
      )}
      {p.is_individual_entrepreneur && (
        <Notice tone="info" className="mb-6">
          Entrepreneur individuel : exclu des campagnes tant que l&apos;option correspondante n&apos;est pas activée dans les paramètres (données personnelles).
        </Notice>
      )}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Panel title="Informations" description={`Origine des données : ${p.source}${p.source_ref ? ` (${p.source_ref})` : ""} · base légale : ${p.legal_basis}`}>
          <ProspectForm prospect={p} sectors={sectors ?? []} departments={departments ?? []} />
        </Panel>
        <Panel title="Historique des sollicitations" description={`${p.contacts_count} e-mail(s) envoyé(s)`}>
          {!history?.length ? (
            <p className="text-sm text-slate-500">Jamais sélectionnée dans une campagne.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {history.map((h) => {
                const c = h.campaign as unknown as { id: string; campaign_date: string } | null;
                return (
                  <li key={h.id} className="border-b border-slate-100 pb-3 last:border-0">
                    <Link href={`/outreach/campagnes/${c?.id}/destinataires/${h.id}`} className="font-semibold text-navy hover:underline">
                      Campagne du {formatDate(c?.campaign_date)}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <StatusBadge map={RECIPIENT_STATUS} status={h.status} />
                      <ScoreBadge score={h.score} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {(h.items ?? []).length} opportunité(s)
                      {h.clicked_at ? ` · clic le ${formatDate(h.clicked_at)}` : ""}
                      {h.signed_up_at ? " · inscrite" : ""}
                      {h.unsubscribed_at ? " · désinscrite" : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
