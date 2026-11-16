"use client";
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { eur, pct } from "@/lib/format";
import { Badge, Button, Card, CardHeader, ErrorBox, Field, Input, PageHeader, StatCard } from "@/components/ui";

export type SimResult = {
  unit: { purchase_price: number; total_cost: number; seller_fees: number; gross_profit: number; net_profit: number; margin_pct: number | null; roi_pct: number | null; break_even_price: number };
  total: { quantity: number; capital_required: number; revenue: number; net_profit: number };
  checks: { key: string; ok: boolean; label: string }[];
  verdict: "go" | "no_go";
};

export function SimulatorPanel({ initial }: { initial?: { purchase_price?: number; resale_price?: number } }) {
  const [f, setF] = useState({
    purchase_price: initial?.purchase_price ? String(initial.purchase_price) : "", resale_price: initial?.resale_price ? String(initial.resale_price) : "",
    quantity: "1", supplier_shipping: "", packaging: "", operating: "", other: "0", refund_loss: "0",
  });
  const [res, setRes] = useState<SimResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const n = (v: string) => Number(v.replace(",", "."));
  const opt = (v: string) => (v === "" ? null : n(v));
  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      setRes(await api<SimResult>("/simulate", { body: {
        purchase_price: n(f.purchase_price), resale_price: n(f.resale_price), quantity: Number(f.quantity),
        supplier_shipping: opt(f.supplier_shipping), packaging: opt(f.packaging), operating: opt(f.operating), other: n(f.other || "0"), refund_loss: n(f.refund_loss || "0"),
      } }));
    } catch (e2) { setErr((e2 as Error).message); setRes(null); } finally { setBusy(false); }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader title="Paramètres de l'achat" sub="Champs vides = valeurs par défaut des paramètres" />
        <form onSubmit={go} className="grid grid-cols-2 gap-3 p-4">
          <Field label="Prix d'achat (€)"><Input required inputMode="decimal" value={f.purchase_price} onChange={set("purchase_price")} /></Field>
          <Field label="Prix de revente (€)"><Input required inputMode="decimal" value={f.resale_price} onChange={set("resale_price")} /></Field>
          <Field label="Quantité"><Input type="number" min={1} value={f.quantity} onChange={set("quantity")} /></Field>
          <Field label="Livraison fournisseur"><Input inputMode="decimal" placeholder="0" value={f.supplier_shipping} onChange={set("supplier_shipping")} /></Field>
          <Field label="Emballage"><Input inputMode="decimal" placeholder="défaut" value={f.packaging} onChange={set("packaging")} /></Field>
          <Field label="Frais opérationnels"><Input inputMode="decimal" placeholder="défaut" value={f.operating} onChange={set("operating")} /></Field>
          <Field label="Autres coûts"><Input inputMode="decimal" value={f.other} onChange={set("other")} /></Field>
          <Field label="Pertes / remb. prévus"><Input inputMode="decimal" value={f.refund_loss} onChange={set("refund_loss")} /></Field>
          <Button type="submit" loading={busy} className="col-span-2">Simuler</Button>
        </form>
      </Card>
      <div className="space-y-3">
        {err && <ErrorBox>{err}</ErrorBox>}
        {!res && !err && <Card className="grid h-48 place-items-center p-6 text-sm text-muted">Renseignez prix d'achat et de revente pour voir la rentabilité.</Card>}
        {res && (
          <>
            <Badge tone={res.verdict === "go" ? "green" : "red"} className="px-3 py-1 text-sm">{res.verdict === "go" ? "Achat rentable" : "Achat déconseillé"}</Badge>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard label="Coût total / unité" value={eur(res.unit.total_cost)} />
              <StatCard label="Bénéfice net / unité" value={eur(res.unit.net_profit)} tone={res.unit.net_profit > 0 ? "good" : "bad"} />
              <StatCard label="Marge sur prix de vente" value={pct(res.unit.margin_pct)} />
              <StatCard label="ROI" value={pct(res.unit.roi_pct)} hint="Bénéfice / coût total" />
              <StatCard label="Bénéfice brut / unité" value={eur(res.unit.gross_profit)} hint="Vente − (achat + livraison fournisseur)" />
              <StatCard label="Seuil de rentabilité" value={eur(res.unit.break_even_price)} sub="prix de vente minimal" />
              <StatCard label={`Capital à engager (×${res.total.quantity})`} value={eur(res.total.capital_required)} />
              <StatCard label="Bénéfice total" value={eur(res.total.net_profit)} tone={res.total.net_profit > 0 ? "good" : "bad"} />
            </div>
            <Card>
              <ul className="divide-y divide-line">
                {res.checks.map((c) => (
                  <li key={c.key} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                    {c.ok ? <CheckCircle2 className="size-4 text-accent" /> : <XCircle className="size-4 text-danger" />}{c.label}
                  </li>
                ))}
                {res.checks.length === 0 && <li className="px-4 py-3 text-sm text-muted">Aucun seuil défini (Paramètres).</li>}
              </ul>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

