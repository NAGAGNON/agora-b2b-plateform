import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, isUuid } from "@/lib/format";
import { buildEmail, loadRecipientBundles, loadReferentials } from "@/lib/outreach/data";
import { fillTemplate } from "@/lib/outreach/email";
import { templateVars } from "@/lib/outreach/data";
import { PageHead, Panel, RECIPIENT_STATUS, ScoreBadge, StatusBadge } from "@/components/outreach/ui";
import { OpportunityToggle, RecipientTextEditor, RecipientToggle } from "@/components/outreach/campaign-controls";
import { Notice } from "@/components/ui/notice";

export const metadata = { title: "Aperçu de l'e-mail" };

export default async function RecipientPage(props: PageProps<"/outreach/campagnes/[id]/destinataires/[rid]">) {
  const { id, rid } = await props.params;
  if (!isUuid(id) || !isUuid(rid)) notFound();
  // Lecture sous la session administrateur (RLS) : un non-administrateur ne voit rien.
  const supabase = await createClient();
  const [bundle] = await loadRecipientBundles(supabase, [rid]);
  if (!bundle || bundle.recipient.campaign_id !== id) notFound();
  const { data: campaign } = await supabase.from("outreach_campaigns").select("status").eq("id", id).single();
  const { data: events } = await supabase.from("outreach_events").select("type, created_at, opportunity_id").eq("recipient_id", rid).order("created_at");
  const ref = await loadReferentials(supabase);
  const email = buildEmail(bundle, ref, { withPixel: false });
  const editable = campaign?.status === "READY";
  const kept = bundle.opportunities.filter((o) => !o.excluded);
  const vars = templateVars(bundle, ref, kept);
  const p = bundle.prospect;

  return (
    <>
      <Link href={`/outreach/campagnes/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-navy">
        <ArrowLeft className="size-4" aria-hidden /> Campagne
      </Link>
      <PageHead
        title={p.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ScoreBadge score={bundle.recipient.score} />
            <StatusBadge map={RECIPIENT_STATUS} status={bundle.recipient.status} />
            <span className="text-sm">{bundle.recipient.email ?? "Aucune adresse e-mail"}</span>
          </span>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <a href={`${email.urls.landing}?apercu=1`} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-navy hover:bg-sky">
              Landing page <ExternalLink className="size-4" aria-hidden />
            </a>
            {editable && ["PENDING", "NO_EMAIL", "EXCLUDED"].includes(bundle.recipient.status) && <RecipientToggle recipientId={rid} excluded={bundle.recipient.status === "EXCLUDED"} />}
          </div>
        }
      />
      {!bundle.recipient.email && (
        <Notice tone="warning" className="mb-6" title="Cette entreprise n'a pas d'adresse e-mail">
          Elle a été sélectionnée pour sa pertinence, mais ne peut pas être contactée tant qu&apos;une adresse professionnelle d&apos;origine autorisée n&apos;est pas
          renseignée.{" "}
          <Link href={`/outreach/prospects/${p.id}`} className="font-semibold underline">
            Compléter la fiche
          </Link>
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <Panel title="Aperçu de l'e-mail" description={<>Objet : <strong className="text-navy">{email.subject}</strong></>}>
          <iframe title="Aperçu de l'e-mail" srcDoc={email.html} sandbox="" className="h-[78rem] w-full rounded-lg border border-slate-200 bg-sky" />
        </Panel>
        <div className="space-y-6">
          <Panel title="Pourquoi cette entreprise ?">
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {bundle.recipient.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1 text-xs text-slate-500">
              <div>
                <dt className="inline font-semibold">Source des données : </dt>
                <dd className="inline">{p.source}</dd>
              </div>
              {p.email_source && (
                <div>
                  <dt className="inline font-semibold">Origine de l&apos;e-mail : </dt>
                  <dd className="inline">{p.email_source}</dd>
                </div>
              )}
              <div>
                <dt className="inline font-semibold">Contacts précédents : </dt>
                <dd className="inline">
                  {p.contacts_count}
                  {p.last_contacted_at ? ` (dernier le ${formatDate(p.last_contacted_at)})` : ""}
                </dd>
              </div>
            </dl>
            <Link href={`/outreach/prospects/${p.id}`} className="mt-3 inline-block text-sm font-semibold text-teal-700 hover:underline">
              Fiche de l&apos;entreprise
            </Link>
          </Panel>
          <Panel title={`Opportunités proposées (${kept.length})`}>
            <ul className="space-y-3 text-sm">
              {bundle.opportunities.map((o) => (
                <li key={o.id} className="border-b border-slate-100 pb-3 last:border-0">
                  <p className={`font-semibold [overflow-wrap:anywhere] ${o.excluded ? "text-slate-400 line-through" : "text-navy"}`}>{o.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    <ScoreBadge score={o.score} /> · {o.reasons.slice(0, 2).join(" · ")}
                  </p>
                  {editable && <OpportunityToggle opportunityId={o.id} recipientId={rid} excluded={o.excluded} />}
                </li>
              ))}
            </ul>
          </Panel>
          {editable && (
            <Panel title="Personnaliser l'e-mail">
              <RecipientTextEditor
                recipientId={rid}
                subject={bundle.recipient.subject ?? ""}
                intro={bundle.recipient.intro ?? ""}
                placeholderSubject={fillTemplate(bundle.campaign.subject_template, vars)}
                placeholderIntro={fillTemplate(bundle.campaign.intro_template, vars)}
              />
            </Panel>
          )}
          <Panel title="Parcours">
            {!events?.length ? (
              <p className="text-sm text-slate-500">Aucun événement.</p>
            ) : (
              <ol className="space-y-1.5 text-sm">
                {events.map((e, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="text-slate-700">{EVENT_LABELS[e.type] ?? e.type}</span>
                    <span className="text-xs text-slate-500 tabular-nums">{formatDateTime(e.created_at)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

const EVENT_LABELS: Record<string, string> = {
  PREPARED: "E-mail préparé",
  SENT: "E-mail envoyé",
  SIMULATED: "Envoi simulé",
  FAILED: "Échec d'envoi",
  OPEN: "Ouverture",
  CLICK: "Clic",
  LANDING_VIEW: "Sélection consultée",
  OPPORTUNITY_VIEW: "Opportunité consultée",
  SIGNUP: "Inscription LinkProB2B",
  CONVERSION: "Conversion (abonnement)",
  UNSUBSCRIBE: "Désinscription",
};
