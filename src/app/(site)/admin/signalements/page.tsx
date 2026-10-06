import Link from "next/link";
import { Flag } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { ContactHandledButton, ReportResolver } from "@/components/admin/admin-actions";
import { REPORT_REASONS, REPORT_TARGET_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Signalements" };

export default async function ReportsPage(props: PageProps<"/admin/signalements">) {
  await requireStaff();
  const sp = await props.searchParams;
  const all = sp.tous === "1";
  const supabase = await createClient();
  let rq = supabase.from("reports").select("*, reporter:users!reports_reporter_user_id_fkey(email)").order("created_at", { ascending: false }).limit(100);
  if (!all) rq = rq.in("status", ["OPEN", "REVIEWING"]);
  const [{ data: reports }, { data: contacts }] = await Promise.all([
    rq,
    supabase.from("contact_messages").select("*").eq("handled", false).order("created_at", { ascending: false }).limit(50),
  ]);
  const messageReports = (reports ?? []).filter((r) => r.target_type === "MESSAGE");
  const reported = await Promise.all(
    messageReports.map(async (r) => [r.id, (await supabase.rpc("admin_get_reported_message", { p_report_id: r.id })).data?.[0]] as const),
  );
  const msgBy = new Map(reported);
  const link = (t: string, id: string) =>
    t === "OPPORTUNITY" ? `/opportunites/${id}` : t === "COMPANY" ? `/admin/entreprises` : t === "USER" ? `/admin/utilisateurs` : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">Signalements</h1>
        <Link href={all ? "/admin/signalements" : "/admin/signalements?tous=1"} className="text-sm font-semibold text-teal-700 underline">
          {all ? "Afficher les signalements ouverts" : "Afficher tout l'historique"}
        </Link>
      </div>
      {!reports?.length ? (
        <EmptyState icon={<Flag className="size-6" aria-hidden />} title="Aucun signalement ouvert" />
      ) : (
        <ul className="space-y-4">
          {reports.map((r) => {
            const href = link(r.target_type, r.target_id);
            const msg = msgBy.get(r.id);
            const reporter = Array.isArray(r.reporter) ? r.reporter[0] : r.reporter;
            return (
              <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge kind="report" status={r.status} />
                  <Badge tone="slate">{REPORT_TARGET_LABELS[r.target_type]}</Badge>
                  <Badge tone="amber">{REPORT_REASONS[r.reason] ?? r.reason}</Badge>
                  <span className="text-xs text-slate-500">
                    {formatDateTime(r.created_at)} · par {reporter?.email ?? "compte supprimé"}
                  </span>
                </div>
                {r.details && <p className="mt-2 text-sm text-slate-700">{r.details}</p>}
                {href && (
                  <Link href={href} className="mt-2 inline-block text-sm font-semibold text-teal-700 underline">
                    Voir l&apos;élément signalé
                  </Link>
                )}
                {msg && (
                  <blockquote className="mt-2 rounded-lg border-l-4 border-amber-300 bg-amber-50 p-3 text-sm">
                    <p className="text-xs text-slate-500">
                      Message de {msg.sender_company} · {formatDateTime(msg.created_at)}
                    </p>
                    <p className="mt-1 whitespace-pre-line">{msg.body}</p>
                  </blockquote>
                )}
                {r.resolution_note && <p className="mt-2 text-xs text-slate-500">Traitement : {r.resolution_note}</p>}
                <div className="mt-4">
                  <ReportResolver id={r.id} status={r.status} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Card>
        <CardHeader title="Messages reçus via le formulaire de contact" description="Non traités" />
        {!contacts?.length ? (
          <p className="px-5 py-6 text-sm text-slate-500">Aucun message en attente.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {contacts.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-navy">{c.subject}</p>
                  <p className="text-xs text-slate-500">
                    {c.name} · <a href={`mailto:${c.email}`} className="underline">{c.email}</a>
                    {c.company ? ` · ${c.company}` : ""} · {formatDateTime(c.created_at)}
                  </p>
                  <p className="mt-1 text-sm whitespace-pre-line text-slate-700">{c.message}</p>
                </div>
                <ContactHandledButton id={c.id} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
