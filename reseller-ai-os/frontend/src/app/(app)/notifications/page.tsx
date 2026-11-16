"use client";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { ago } from "@/lib/format";
import { Badge, Button, Card, Empty, ErrorBox, PageHeader, Spinner, useAction } from "@/components/ui";

type N = { id: number; kind: string; title: string; body: string | null; severity: string; link: string | null; read_at: string | null; created_at: string; emailed_at: string | null };
const TONE = { info: "blue", success: "green", warning: "amber", danger: "red" } as const;

export default function Page() {
  const { data, error, loading, reload } = useApi<{ unread: number; items: N[] }>("/notifications?limit=200");
  const { busy, run } = useAction();
  if (error) return <ErrorBox onRetry={reload}>{error}</ErrorBox>;
  if (loading && !data) return <Spinner />;
  return (
    <div>
      <PageHeader title="Notifications" sub="Dans l'application ; par e-mail si un service d'envoi (SMTP) est configuré et activé dans Paramètres." actions={<Button variant="secondary" disabled={!data?.unread} loading={busy === "all"} onClick={() => run("all", async () => { await api("/notifications/read-all", { body: {} }); reload(); })}><CheckCheck className="size-4" />Tout marquer comme lu</Button>} />
      <Card>
        {data?.items.length === 0 ? <Empty title="Aucune notification" icon={<Bell className="size-6" />}>Vous serez prévenu : opportunité, achat à valider, réception, vente, expédition, remboursement, budget.</Empty> : (
          <ul className="divide-y divide-line">{data?.items.map((n) => (
            <li key={n.id} className={`flex items-start gap-3 px-4 py-3 ${n.read_at ? "opacity-60" : ""}`}>
              <Badge tone={TONE[n.severity as keyof typeof TONE] ?? "neutral"}>{n.kind.replaceAll("_", " ")}</Badge>
              <div className="min-w-0 flex-1"><div className="text-sm font-medium">{n.title}</div>{n.body && <div className="text-sm text-muted">{n.body}</div>}<div className="mt-0.5 text-xs text-muted">{ago(n.created_at)}{n.emailed_at && " · envoyée par e-mail"}</div></div>
              {n.link && <Link href={n.link} onClick={() => api(`/notifications/${n.id}/read`, { body: {} })} className="text-sm text-accent underline">Ouvrir</Link>}
              {!n.read_at && <button className="text-xs text-muted underline" onClick={() => run("r", async () => { await api(`/notifications/${n.id}/read`, { body: {} }); reload(); })}>Lu</button>}
            </li>))}</ul>)}
      </Card>
    </div>
  );
}
