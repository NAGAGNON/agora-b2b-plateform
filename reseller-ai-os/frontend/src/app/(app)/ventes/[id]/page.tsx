"use client";
import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { dateTimeFr, eur, pct } from "@/lib/format";
import { PAYMENT, SHIP_STATUS } from "@/lib/labels";
import { Badge, Button, Card, CardHeader, ErrorBox, Field, Input, Modal, PageHeader, Spinner, useAction } from "@/components/ui";

type Sale = { id: number; item_id: number; item_name: string; sku: string; status: string; status_label: string; sale_price: number; sold_at: string; profit: number; margin_pct: number | null; payment_status: string; order_ref: string | null; listing_url: string | null; next_statuses: string[];
  item_cost: number; seller_fees: number; shipping_cost: number; packaging_cost: number; refund_amount: number; restocked: boolean; payout_received_at: string | null; delivery_status: string;
  figures: { revenue: number; item_cost: number; fees: number; profit: number; payout: number };
  shipment: { id: number; deadline: string | null; carrier: string | null; tracking_number: string | null; status: string; events: { id: number; at: string; status: string; note: string | null }[] } | null };
const ACT: Record<string, string> = { payment_pending: "Paiement en attente", payment_confirmed: "Paiement confirmé", to_ship: "À expédier", shipped: "Marquer expédié", delivered: "Marquer livré", completed: "Terminer la vente", cancelled: "Annuler la vente", refunded: "Rembourser" };

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: s, error, reload } = useApi<Sale>(`/sales/${id}`);
  const { busy, run } = useAction();
  const [refund, setRefund] = useState<{ amount: string; restock: boolean } | null>(null);
  const [ship, setShip] = useState<{ tracking: string; carrier: string } | null>(null);
  const [costs, setCosts] = useState<{ seller_fees: string; shipping_cost: string; packaging_cost: string } | null>(null);
  if (error) return <ErrorBox onRetry={reload}>{error}</ErrorBox>;
  if (!s) return <Spinner />;
  const to = (status: string, extra: Record<string, unknown> = {}) => run(status, async () => { await api(`/sales/${s.id}/status`, { body: { status, ...extra } }); reload(); }, ACT[status]);
  const n = (v: string) => Number(v.replace(",", "."));
  return (
    <div>
      <Link href="/ventes" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" />Ventes</Link>
      <PageHeader title={s.item_name} sub={`Vente #${s.id} · ${dateTimeFr(s.sold_at)}${s.order_ref ? ` · ${s.order_ref}` : ""}`} actions={<Badge tone="blue" className="px-3 py-1 text-sm">{s.status_label}</Badge>} />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Résultat de la vente" sub="Chiffre d'affaires ≠ bénéfice" action={<Button size="sm" variant="secondary" onClick={() => setCosts({ seller_fees: String(s.seller_fees), shipping_cost: String(s.shipping_cost), packaging_cost: String(s.packaging_cost) })}>Modifier les frais</Button>} />
            <div className="space-y-1 p-4 text-sm">
              {[["Prix de vente", eur(s.sale_price)], ["Remboursement", s.refund_amount ? `− ${eur(s.refund_amount)}` : "—"], ["Chiffre d'affaires net", eur(s.figures.revenue)],
                ["Coût de l'article (figé à la vente)", s.restocked && s.status === "refunded" ? "0 € (remis en stock)" : `− ${eur(s.figures.item_cost)}`], ["Frais vendeur", `− ${eur(s.seller_fees)}`], ["Expédition à votre charge", `− ${eur(s.shipping_cost)}`], ["Emballage", `− ${eur(s.packaging_cost)}`]].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-line py-1.5"><span className="text-muted">{k}</span><span className="tabular-nums">{v}</span></div>))}
              <div className="flex justify-between pt-2 text-base font-semibold"><span>Bénéfice net</span><span className={`tabular-nums ${s.profit < 0 ? "text-danger" : "text-accent"}`}>{eur(s.profit)} <span className="text-xs font-normal text-muted">({pct(s.margin_pct)})</span></span></div>
              <div className="flex justify-between pt-1 text-xs text-muted"><span>Versement attendu de Vinted</span><span>{eur(s.figures.payout)} · {PAYMENT[s.payment_status]}{s.payout_received_at ? ` le ${dateTimeFr(s.payout_received_at)}` : ""}</span></div>
            </div>
          </Card>
          {s.shipment && (
            <Card>
              <CardHeader title="Expédition" sub={`Date limite : ${dateTimeFr(s.shipment.deadline)}`} action={<Badge>{SHIP_STATUS[s.shipment.status]}</Badge>} />
              <div className="p-4 text-sm">{s.shipment.carrier && <p>Transporteur : {s.shipment.carrier}</p>}{s.shipment.tracking_number && <p>Suivi : <span className="font-mono">{s.shipment.tracking_number}</span></p>}
                <ol className="mt-2 space-y-1 border-l border-line pl-3">{s.shipment.events.map((e) => <li key={e.id} className="text-xs"><span className="text-muted">{dateTimeFr(e.at)}</span> — {e.note ?? SHIP_STATUS[e.status]}</li>)}</ol></div>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          <Card className="space-y-2 p-4">
            <div className="text-sm font-semibold">Actions</div>
            {s.next_statuses.filter((x) => x !== "payment_pending").map((st) => (
              <Button key={st} className="w-full" variant={st === "cancelled" || st === "refunded" ? "secondary" : "primary"} loading={busy === st}
                onClick={() => st === "refunded" ? setRefund({ amount: String(s.sale_price), restock: true }) : st === "shipped" ? setShip({ tracking: s.shipment?.tracking_number ?? "", carrier: s.shipment?.carrier ?? "" })
                  : st === "cancelled" ? confirm("Annuler cette vente ? L'article retourne en stock.") && to(st) : to(st)}>{ACT[st] ?? st}</Button>))}
            {s.delivery_status === "delivered" && !s.payout_received_at && !["cancelled", "refunded"].includes(s.status) && <Button className="w-full" loading={busy === "payout"} onClick={() => run("payout", async () => { await api(`/sales/${s.id}/payout`, { body: {} }); reload(); }, "Paiement enregistré")}>J'ai reçu le paiement</Button>}
            {s.next_statuses.length === 0 && !s.payout_received_at && <p className="text-xs text-muted">Aucune action disponible.</p>}
          </Card>
          <Card className="p-4 text-sm"><Link href={`/stock/${s.item_id}`} className="text-accent underline">Fiche de l'article ({s.sku})</Link>{s.listing_url && <a href={s.listing_url} target="_blank" rel="noreferrer noopener" className="mt-2 flex items-center gap-1 text-xs text-accent underline"><ExternalLink className="size-3" />Annonce Vinted</a>}</Card>
        </div>
      </div>
      {refund && <Modal open onClose={() => setRefund(null)} title="Rembourser la vente" footer={<><Button variant="ghost" onClick={() => setRefund(null)}>Annuler</Button><Button loading={busy === "refunded"} onClick={() => to("refunded", { refund_amount: n(refund.amount), restock: refund.restock }).then(() => setRefund(null))}>Confirmer</Button></>}>
        <div className="space-y-3"><Field label="Montant remboursé (€)"><Input inputMode="decimal" value={refund.amount} onChange={(e) => setRefund({ ...refund, amount: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={refund.restock} onChange={(e) => setRefund({ ...refund, restock: e.target.checked })} />L'article m'est retourné : le remettre en stock (statut « Retourné »)</label>
          <p className="text-xs text-muted">Sans retour, le coût de l'article est enregistré comme perte.</p></div></Modal>}
      {ship && <Modal open onClose={() => setShip(null)} title="Marquer comme expédié" footer={<><Button variant="ghost" onClick={() => setShip(null)}>Annuler</Button><Button loading={busy === "shipped"} onClick={() => to("shipped", { tracking: ship.tracking || undefined, carrier: ship.carrier || undefined }).then(() => setShip(null))}>Confirmer</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Transporteur"><Input value={ship.carrier} onChange={(e) => setShip({ ...ship, carrier: e.target.value })} placeholder="Mondial Relay, Colissimo…" /></Field><Field label="N° de suivi"><Input value={ship.tracking} onChange={(e) => setShip({ ...ship, tracking: e.target.value })} /></Field></div></Modal>}
      {costs && <Modal open onClose={() => setCosts(null)} title="Frais de la vente" footer={<><Button variant="ghost" onClick={() => setCosts(null)}>Annuler</Button><Button loading={busy === "costs"} onClick={() => run("costs", async () => { await api(`/sales/${s.id}`, { method: "PUT", body: { seller_fees: n(costs.seller_fees), shipping_cost: n(costs.shipping_cost), packaging_cost: n(costs.packaging_cost) } }); setCosts(null); reload(); }, "Frais mis à jour")}>Enregistrer</Button></>}>
        <div className="grid gap-3 sm:grid-cols-3"><Field label="Frais vendeur (€)"><Input inputMode="decimal" value={costs.seller_fees} onChange={(e) => setCosts({ ...costs, seller_fees: e.target.value })} /></Field>
          <Field label="Expédition (€)"><Input inputMode="decimal" value={costs.shipping_cost} onChange={(e) => setCosts({ ...costs, shipping_cost: e.target.value })} /></Field><Field label="Emballage (€)"><Input inputMode="decimal" value={costs.packaging_cost} onChange={(e) => setCosts({ ...costs, packaging_cost: e.target.value })} /></Field></div>
        <p className="mt-2 text-xs text-muted">Les coûts d'expédition et d'emballage sont aussi inscrits au journal des dépenses.</p></Modal>}
    </div>
  );
}
