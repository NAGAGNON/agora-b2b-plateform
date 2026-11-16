"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, useApi } from "@/lib/api";
import { dateFr, eur, monthLong, pct } from "@/lib/format";
import { EXP_CAT } from "@/lib/labels";
import { AreaSeries, Box, C, MarginLine, type Pt } from "@/components/charts";
import { Badge, Button, Card, CardHeader, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, StatCard, TableWrap, Tabs, tdCls, thCls, useAction } from "@/components/ui";

type Pnl = { sales_count: number; revenue: number; cogs: number; gross_profit: number; seller_fees: number; shipping_costs: number; packaging_costs: number; operating_expenses: number; net_profit: number; margin_pct: number | null };
type Overview = {
  cash: { initial_capital: number; cash_available: number; cashed_in: number; pending_payouts: number; total_out: number; invested_purchases: number; stock_value: number; in_transit_value: number; upcoming_expenses: number; capital_for_purchases: number };
  budget: { monthly_budget: number; monthly_spent: number; committed: number; monthly_remaining: number | null; daily_budget: number; daily_remaining: number | null };
  pnl: Record<"day" | "week" | "month" | "year", Pnl>; expenses_month: { category: string; label: string; amount: number }[]; expenses_year: { category: string; label: string; amount: number }[];
  series: Pt[]; by_product: { sale_id: number; name: string; sold_at: string; revenue: number; cost: number; profit: number; margin_pct: number | null }[]; categories: { key: string; label: string }[];
};
type Month = { year: number; month: number; revenue: number; purchases: number; other_expenses: number; estimated_profit: number; stock_value_now: number; pending_payouts_month: number; cash_result: number; note: string };
type Expense = { id: number; date: string; category: string; amount: number; description: string | null; vendor: string | null; auto: boolean; purchase_order_id: number | null; sale_id: number | null };

export default function Page() {
  const [tab, setTab] = useState("tresorerie");
  const ov = useApi<Overview>("/finance/overview");
  const months = useApi<Month[]>(tab === "bilans" ? "/finance/months?count=12" : null);
  const exp = useApi<Expense[]>(tab === "depenses" ? "/expenses?limit=300" : null);
  const [adding, setAdding] = useState(false);
  const { busy, run } = useAction();
  if (ov.error) return <ErrorBox onRetry={ov.reload}>{ov.error}</ErrorBox>;
  if (!ov.data) return <Spinner />;
  const o = ov.data, c = o.cash;
  const periods: [string, Pnl][] = [["Aujourd'hui", o.pnl.day], ["Semaine", o.pnl.week], ["Mois", o.pnl.month], ["Année", o.pnl.year]];
  return (
    <div>
      <PageHeader title="Finance" sub="Le chiffre d'affaires n'est jamais le bénéfice : achats de stock capitalisés, charges d'exploitation et coûts de vente sont séparés." actions={<Button onClick={() => setAdding(true)}><Plus className="size-4" />Dépense</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: "tresorerie", label: "Trésorerie" }, { key: "revenus", label: "Revenus & bénéfices" }, { key: "depenses", label: "Dépenses" }, { key: "bilans", label: "Bilans mensuels" }]} />
      <div className="pt-5">
        {tab === "tresorerie" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Argent disponible" value={eur(c.cash_available)} tone={c.cash_available >= 0 ? undefined : "bad"} hint="Capital initial + argent encaissé − toutes les dépenses" />
              <StatCard label="Argent investi (achats)" value={eur(c.invested_purchases)} /><StatCard label="Immobilisé en stock" value={eur(c.stock_value)} sub={c.in_transit_value ? `+ ${eur(c.in_transit_value)} en commande` : undefined} />
              <StatCard label="En attente de versement" value={eur(c.pending_payouts)} /><StatCard label="Argent encaissé" value={eur(c.cashed_in)} /><StatCard label="Dépenses à venir (achats validés)" value={eur(c.upcoming_expenses)} />
              <StatCard label="Capital disponible pour achats" value={eur(c.capital_for_purchases)} tone="good" hint="Argent disponible − achats validés non commandés" />
              <StatCard label="Capital initial" value={eur(c.initial_capital)} sub="modifiable dans Paramètres" />
            </div>
            <Card>
              <CardHeader title="Budgets d'achat" sub="Définis dans Paramètres" />
              <div className="grid gap-3 p-4 text-sm sm:grid-cols-3">
                <div>Mensuel : <strong>{o.budget.monthly_budget > 0 ? `${eur(o.budget.monthly_spent + o.budget.committed)} / ${eur(o.budget.monthly_budget)}` : "illimité"}</strong>{o.budget.monthly_budget > 0 && <div className="mt-1 h-1.5 rounded-full bg-surface2"><div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.min(100, ((o.budget.monthly_spent + o.budget.committed) / o.budget.monthly_budget) * 100)}%` }} /></div>}</div>
                <div>Quotidien restant : <strong>{o.budget.daily_budget > 0 ? eur(o.budget.daily_remaining) : "illimité"}</strong></div>
                <div>Engagé non commandé : <strong>{eur(o.budget.committed)}</strong></div>
              </div>
            </Card>
          </div>
        )}
        {tab === "revenus" && (
          <div className="space-y-4">
            <Card><TableWrap><thead><tr className="border-b border-line">{["Période", "Ventes", "CA", "Coût des articles", "Frais & expéd.", "Charges", "Bénéfice net", "Marge"].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
              <tbody>{periods.map(([l, p]) => <tr key={l} className="border-b border-line last:border-0"><td className={`${tdCls} font-medium`}>{l}</td><td className={tdCls}>{p.sales_count}</td><td className={`${tdCls} tabular-nums`}>{eur(p.revenue)}</td><td className={`${tdCls} tabular-nums`}>{eur(p.cogs)}</td>
                <td className={`${tdCls} tabular-nums`}>{eur(p.seller_fees + p.shipping_costs + p.packaging_costs)}</td><td className={`${tdCls} tabular-nums`}>{eur(p.operating_expenses)}</td><td className={`${tdCls} tabular-nums font-semibold ${p.net_profit < 0 ? "text-danger" : "text-accent"}`}>{eur(p.net_profit)}</td><td className={`${tdCls} tabular-nums`}>{pct(p.margin_pct)}</td></tr>)}</tbody></TableWrap></Card>
            <div className="grid gap-4 lg:grid-cols-2"><AreaSeries data={o.series} k="revenue" title="Ventes mensuelles" /><AreaSeries data={o.series} k="net_profit" title="Bénéfice mensuel" /><MarginLine data={o.series} />
              <Box title="Dépenses par catégorie (année)" empty={o.expenses_year.length === 0}><ResponsiveContainer><BarChart data={o.expenses_year} layout="vertical" margin={{ left: 30 }}><CartesianGrid stroke={C.line} horizontal={false} /><XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted)" }} /><YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11, fill: "var(--muted)" }} /><Tooltip formatter={(v) => eur(Number(v))} contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10 }} /><Bar dataKey="amount" fill="var(--accent)" radius={4} /></BarChart></ResponsiveContainer></Box></div>
            <Card><CardHeader title="Bénéfice par vente / produit" />{o.by_product.length === 0 ? <Empty title="Aucune vente" /> : <TableWrap><thead><tr className="border-b border-line">{["Produit", "Date", "CA", "Coût", "Bénéfice", "Marge"].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
              <tbody>{o.by_product.map((p) => <tr key={p.sale_id} className="border-b border-line last:border-0"><td className={tdCls}>{p.name}</td><td className={tdCls}>{dateFr(p.sold_at)}</td><td className={`${tdCls} tabular-nums`}>{eur(p.revenue)}</td><td className={`${tdCls} tabular-nums`}>{eur(p.cost)}</td><td className={`${tdCls} tabular-nums ${p.profit < 0 ? "text-danger" : ""}`}>{eur(p.profit)}</td><td className={`${tdCls} tabular-nums`}>{pct(p.margin_pct)}</td></tr>)}</tbody></TableWrap>}</Card>
          </div>
        )}
        {tab === "depenses" && (
          <Card>
            <CardHeader title="Journal des dépenses" sub="Achats fournisseurs, expédition et emballage sont créés automatiquement ; les autres se saisissent ici." />
            {exp.loading && !exp.data ? <Spinner /> : exp.data?.length === 0 ? <Empty title="Aucune dépense" /> : (
              <TableWrap><thead><tr className="border-b border-line">{["Date", "Catégorie", "Description", "Montant", ""].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
                <tbody>{exp.data?.map((e) => <tr key={e.id} className="border-b border-line last:border-0"><td className={tdCls}>{dateFr(e.date)}</td><td className={tdCls}><Badge>{EXP_CAT[e.category] ?? e.category}</Badge>{e.auto && <Badge tone="blue" className="ml-1">auto</Badge>}</td><td className={tdCls}>{e.description}</td><td className={`${tdCls} tabular-nums`}>{eur(e.amount)}</td>
                  <td className={tdCls}>{!e.auto && <Button size="sm" variant="ghost" loading={busy === `v${e.id}`} onClick={() => confirm("Annuler cette dépense ? (elle reste visible dans le journal d'audit)") && run(`v${e.id}`, async () => { await api(`/expenses/${e.id}/void`, { body: {} }); exp.reload(); ov.reload(); }, "Dépense annulée")}>Annuler</Button>}</td></tr>)}</tbody></TableWrap>)}
          </Card>
        )}
        {tab === "bilans" && (
          months.loading && !months.data ? <Spinner /> : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{months.data?.map((m) => (
              <Card key={`${m.year}-${m.month}`} className="p-4">
                <div className="mb-2 text-sm font-semibold capitalize">{monthLong(m.year, m.month)}</div>
                {[["Chiffre d'affaires", m.revenue], ["Achats", m.purchases], ["Autres dépenses", m.other_expenses]].map(([k, v]) => <div key={k as string} className="flex justify-between py-0.5 text-sm"><span className="text-muted">{k}</span><span className="tabular-nums">{eur(v as number)}</span></div>)}
                <div className="my-1 flex justify-between border-y border-line py-1.5 font-semibold"><span>Bénéfice estimé</span><span className={`tabular-nums ${m.estimated_profit < 0 ? "text-danger" : "text-accent"}`}>{eur(m.estimated_profit)}</span></div>
                {[["Produits encore en stock", m.stock_value_now], ["Argent en attente", m.pending_payouts_month], ["Résultat de caisse", m.cash_result]].map(([k, v]) => <div key={k as string} className="flex justify-between py-0.5 text-sm"><span className="text-muted">{k}</span><span className="tabular-nums">{eur(v as number)}</span></div>)}
                <p className="mt-2 text-[11px] leading-snug text-muted">{m.note}</p>
              </Card>))}</div>)
        )}
      </div>
      {adding && <ExpenseModal cats={o.categories.filter((k) => k.key !== "achats_fournisseurs")} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); exp.reload(); ov.reload(); }} />}
    </div>
  );
}

function ExpenseModal({ cats, onClose, onSaved }: { cats: { key: string; label: string }[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ category: "frais_operationnels", amount: "", description: "", vendor: "", date: new Date().toISOString().slice(0, 10) });
  const { busy, run } = useAction();
  return (
    <Modal open onClose={onClose} title="Nouvelle dépense">
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run("e", async () => { await api("/expenses", { body: { category: f.category, amount: Number(f.amount.replace(",", ".")), description: f.description || null, vendor: f.vendor || null, date: new Date(f.date + "T12:00:00").toISOString() } }); onSaved(); }, "Dépense enregistrée"); }}>
        <Field label="Catégorie"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{cats.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</Select></Field>
        <Field label="Montant (€)"><Input required inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field><Field label="Fournisseur / tiers"><Input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} /></Field>
        <Field label="Description" className="sm:col-span-2"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <p className="text-xs text-muted sm:col-span-2">Les achats de stock se saisissent via une commande fournisseur (pour alimenter le stock).</p>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={onClose}>Annuler</Button><Button type="submit" loading={busy === "e"}>Enregistrer</Button></div>
      </form>
    </Modal>
  );
}
