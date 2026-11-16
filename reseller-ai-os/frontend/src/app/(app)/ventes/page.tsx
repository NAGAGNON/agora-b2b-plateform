"use client";
import Link from "next/link";
import { useState } from "react";
import { Receipt } from "lucide-react";
import { useApi } from "@/lib/api";
import { dateFr, eur, pct } from "@/lib/format";
import { PAYMENT } from "@/lib/labels";
import { Badge, Card, Empty, ErrorBox, PageHeader, Spinner, StatCard, TableWrap, Tabs, tdCls, thCls } from "@/components/ui";

type Sale = { id: number; item_name: string; sku: string; status: string; status_label: string; sale_price: number; sold_at: string; profit: number; margin_pct: number | null; payment_status: string; order_ref: string | null; listing_url: string | null; next_statuses: string[];
  item_cost: number; seller_fees: number; shipping_cost: number; packaging_cost: number; refund_amount: number; restocked: boolean; payout_received_at: string | null; delivery_status: string; item_id: number;
  figures: { revenue: number; item_cost: number; fees: number; profit: number; payout: number };
  shipment: { id: number; deadline: string | null; carrier: string | null; tracking_number: string | null; status: string; shipped_at: string | null; delivered_at: string | null; events: { id: number; at: string; status: string; note: string | null }[] } | null };
const saleTone = (s: string) => (s === "completed" || s === "delivered" ? "green" : s === "cancelled" || s === "refunded" ? "red" : s === "shipped" ? "blue" : "amber") as "green" | "red" | "blue" | "amber";

export default function Page() {
  const [status, setStatus] = useState("");
  const { data, error, loading, reload } = useApi<{ items: Sale[]; statuses: { key: string; label: string }[] }>(`/sales${status ? `?status=${status}` : ""}`);
  const valid = data?.items.filter((s) => !["cancelled"].includes(s.status)) ?? [];
  const revenue = valid.reduce((a, s) => a + s.figures.revenue, 0), profit = valid.reduce((a, s) => a + s.profit, 0);
  return (
    <div>
      <PageHeader title="Ventes" sub="Une vente se crée depuis la fiche d'un article en stock (bouton « Enregistrer une vente »)." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Ventes (liste)" value={valid.length} /><StatCard label="Chiffre d'affaires" value={eur(revenue)} /><StatCard label="Bénéfice net" value={eur(profit)} tone={profit >= 0 ? "good" : "bad"} /><StatCard label="Marge" value={pct(revenue > 0 ? (profit / revenue) * 100 : null)} />
      </div>
      <Card>
        <Tabs value={status} onChange={setStatus} tabs={[{ key: "", label: "Toutes" }, ...(data?.statuses ?? []).map((s) => ({ key: s.key, label: s.label }))]} />
        {error && <div className="p-3"><ErrorBox onRetry={reload}>{error}</ErrorBox></div>}
        {loading && !data ? <Spinner /> : data?.items.length === 0 ? <Empty title="Aucune vente" icon={<Receipt className="size-6" />}>Les ventes apparaîtront ici avec leur bénéfice réel.</Empty> : (
          <TableWrap><thead><tr className="border-b border-line">{["Article", "Date", "Prix", "Bénéfice", "Marge", "Paiement", "Statut"].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
            <tbody>{data?.items.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0 hover:bg-surface2">
                <td className={tdCls}><Link href={`/ventes/${s.id}`} className="font-medium text-accent underline">{s.item_name}</Link><div className="text-xs text-muted">{s.order_ref ?? s.sku}</div></td>
                <td className={tdCls}>{dateFr(s.sold_at)}</td><td className={`${tdCls} tabular-nums`}>{eur(s.sale_price)}</td>
                <td className={`${tdCls} tabular-nums ${s.profit < 0 ? "text-danger" : ""}`}>{eur(s.profit)}</td><td className={`${tdCls} tabular-nums`}>{pct(s.margin_pct)}</td>
                <td className={tdCls}>{PAYMENT[s.payment_status]}</td><td className={tdCls}><Badge tone={saleTone(s.status)}>{s.status_label}</Badge></td></tr>))}</tbody></TableWrap>
        )}
      </Card>
    </div>
  );
}
