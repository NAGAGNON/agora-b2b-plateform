"use client";
import Link from "next/link";
import { useState } from "react";
import { Truck } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { dateTimeFr } from "@/lib/format";
import { SHIP_STATUS } from "@/lib/labels";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Tabs, useAction } from "@/components/ui";

type Sh = { id: number; sale_id: number; item_name: string; deadline: string | null; carrier: string | null; tracking_number: string | null; status: string; late: boolean; shipped_at: string | null; delivered_at: string | null; sale_status: string; order_ref: string | null; events: { id: number; at: string; status: string; note: string | null }[] };

export default function Page() {
  const [scope, setScope] = useState("open");
  const { data, error, loading, reload } = useApi<Sh[]>(`/shipments?scope=${scope}`);
  const [edit, setEdit] = useState<Sh | null>(null);
  const { busy, run } = useAction();
  return (
    <div>
      <PageHeader title="Expéditions" sub="Colis à préparer et à suivre. Les informations d'envoi suivent le parcours Vinted (étiquette fournie par la plateforme) ; vous saisissez transporteur et suivi." />
      <Card>
        <Tabs value={scope} onChange={setScope} tabs={[{ key: "open", label: "À traiter / en cours" }, { key: "all", label: "Historique" }]} />
        {error && <div className="p-3"><ErrorBox onRetry={reload}>{error}</ErrorBox></div>}
        {loading && !data ? <Spinner /> : data?.length === 0 ? <Empty title="Aucun colis" icon={<Truck className="size-6" />}>Une tâche d'expédition est créée automatiquement à chaque vente.</Empty> : (
          <ul className="divide-y divide-line">{data?.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1"><Link href={`/ventes/${s.sale_id}`} className="font-medium text-accent underline">{s.item_name}</Link>
                <div className="text-xs text-muted">Avant le {dateTimeFr(s.deadline)}{s.carrier && ` · ${s.carrier}`}{s.tracking_number && ` · ${s.tracking_number}`}</div></div>
              {s.late && <Badge tone="red">En retard</Badge>}<Badge tone={s.status === "delivered" ? "green" : s.status === "problem" ? "red" : "neutral"}>{SHIP_STATUS[s.status]}</Badge>
              <Button size="sm" variant="secondary" onClick={() => setEdit(s)}>Détails</Button>
              {["detected", "payment_pending"].includes(s.sale_status) && (
                <Button size="sm" variant="secondary" loading={busy === `p${s.id}`} onClick={() => run(`p${s.id}`, async () => { await api(`/sales/${s.sale_id}/status`, { body: { status: "payment_confirmed" } }); reload(); }, "Paiement confirmé")}>Confirmer le paiement</Button>)}
              {s.sale_status === "to_ship" && (
                <Button size="sm" loading={busy === `s${s.id}`} onClick={() => run(`s${s.id}`, async () => { await api(`/sales/${s.sale_id}/status`, { body: { status: "shipped", tracking: s.tracking_number ?? undefined, carrier: s.carrier ?? undefined } }); reload(); }, "Colis marqué expédié")}>Marquer expédié</Button>)}
              {s.status === "shipped" && s.sale_status === "shipped" && <Button size="sm" loading={busy === `d${s.id}`} onClick={() => run(`d${s.id}`, async () => { await api(`/sales/${s.sale_id}/status`, { body: { status: "delivered" } }); reload(); }, "Colis livré")}>Marquer livré</Button>}
            </li>))}</ul>
        )}
      </Card>
      {edit && <Edit sh={edit} onClose={() => { setEdit(null); reload(); }} />}
    </div>
  );
}

function Edit({ sh, onClose }: { sh: Sh; onClose: () => void }) {
  const [f, setF] = useState({ carrier: sh.carrier ?? "", tracking_number: sh.tracking_number ?? "", status: "", note: "" });
  const { busy, run } = useAction();
  return (
    <Modal open onClose={onClose} title={`Colis — ${sh.item_name}`}>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run("e", async () => { await api(`/shipments/${sh.id}`, { method: "PUT", body: { carrier: f.carrier, tracking_number: f.tracking_number, status: f.status || null, note: f.note || null } }); onClose(); }, "Expédition mise à jour"); }}>
        <Field label="Transporteur"><Input value={f.carrier} onChange={(e) => setF({ ...f, carrier: e.target.value })} /></Field><Field label="N° de suivi"><Input value={f.tracking_number} onChange={(e) => setF({ ...f, tracking_number: e.target.value })} /></Field>
        <Field label="Statut du colis"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Inchangé</option><option value="label_ready">Étiquette prête</option><option value="in_transit">En transit</option><option value="problem">Problème</option></Select></Field>
        <Field label="Note d'historique"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <div className="sm:col-span-2"><div className="mb-1 text-xs font-medium text-muted">Historique</div><ol className="space-y-1 border-l border-line pl-3 text-xs">{sh.events.map((e) => <li key={e.id}><span className="text-muted">{dateTimeFr(e.at)}</span> — {e.note ?? SHIP_STATUS[e.status]}</li>)}</ol></div>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={onClose}>Fermer</Button><Button type="submit" loading={busy === "e"}>Enregistrer</Button></div>
      </form>
    </Modal>
  );
}
