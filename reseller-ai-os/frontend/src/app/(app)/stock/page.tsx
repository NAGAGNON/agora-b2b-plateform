"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Package, Plus } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { eur } from "@/lib/format";
import { CONDITION } from "@/lib/labels";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, TableWrap, Tabs, tdCls, thCls, useAction } from "@/components/ui";

export type Item = { id: number; sku: string; name: string; status: string; status_label: string; total_cost: number; in_stock: boolean; supplier_name: string | null; potential_profit: number | null;
  cover: string | null; photo_count: number; listing_price: number | null; planned_price: number | null; location: string | null; received_at: string | null; condition: string; category: string | null; brand: string | null };
type List = { total: number; items: Item[]; counts: Record<string, number>; statuses: { key: string; label: string }[] };
const tone = (s: string) => (["received", "to_photograph", "ready"].includes(s) ? "amber" : s === "published" ? "green" : s === "ordered" || s === "in_transit" ? "blue" : s === "returned" ? "red" : "neutral") as "amber" | "green" | "blue" | "red" | "neutral";

function Inner() {
  const sp = useSearchParams();
  const [status, setStatus] = useState(sp.get("status") ?? "");
  const [q, setQ] = useState("");
  const { data, error, loading, reload } = useApi<List>(`/inventory?${new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}) })}`);
  const [adding, setAdding] = useState(false);
  const stockCount = data ? ["received", "to_photograph", "ready", "published", "reserved", "returned"].reduce((a, k) => a + (data.counts[k] ?? 0), 0) : 0;
  return (
    <div>
      <PageHeader title="Stock" sub="Un article n'est « en stock » que lorsqu'il est réceptionné et invendu. Les articles commandés ou en transit sont suivis à part."
        actions={<Button onClick={() => setAdding(true)}><Plus className="size-4" />Ajouter un article détenu</Button>} />
      <Card>
        <Tabs value={status} onChange={setStatus} tabs={[{ key: "", label: "Tous" }, ...(data?.statuses ?? []).map((s) => ({ key: s.key, label: s.label, count: data?.counts[s.key] }))]} />
        <div className="flex items-center justify-between gap-3 border-b border-line p-3"><Input className="max-w-xs" placeholder="Nom ou référence…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Recherche" />
          <span className="text-xs text-muted">{stockCount} article(s) physiquement en stock</span></div>
        {error && <div className="p-3"><ErrorBox onRetry={reload}>{error}</ErrorBox></div>}
        {loading && !data ? <Spinner /> : data?.items.length === 0 ? (
          <Empty title="Aucun article" icon={<Package className="size-6" />}>Les articles apparaissent quand une commande est passée, ou ajoutez à la main un article que vous détenez déjà.</Empty>
        ) : (
          <TableWrap><thead><tr className="border-b border-line">{["", "Article", "Statut", "Coût complet", "Prix de vente", "Bénéfice potentiel", "Emplacement"].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
            <tbody>{data?.items.map((i) => (
              <tr key={i.id} className="border-b border-line last:border-0 hover:bg-surface2">
                <td className={tdCls}>{i.cover ?   <img src={i.cover} alt="" className="size-10 rounded-md border border-line object-cover" loading="lazy" /> : <div className="size-10 rounded-md bg-surface2" />}</td>
                <td className={tdCls}><Link href={`/stock/${i.id}`} className="font-medium text-accent underline">{i.name}</Link><div className="text-xs text-muted">{i.sku} · {i.supplier_name ?? "—"}</div></td>
                <td className={tdCls}><Badge tone={tone(i.status)}>{i.status_label}</Badge>{!i.in_stock && ["ordered", "in_transit"].includes(i.status) && <div className="mt-0.5 text-[11px] text-muted">pas encore en stock</div>}</td>
                <td className={`${tdCls} tabular-nums`}>{eur(i.total_cost)}</td><td className={`${tdCls} tabular-nums`}>{i.listing_price ? eur(i.listing_price) : i.planned_price ? `${eur(i.planned_price)} (prévu)` : "—"}</td>
                <td className={`${tdCls} tabular-nums ${i.potential_profit !== null && i.potential_profit < 0 ? "text-danger" : ""}`}>{i.potential_profit !== null ? eur(i.potential_profit) : "—"}</td><td className={tdCls}>{i.location ?? "—"}</td></tr>))}</tbody></TableWrap>
        )}
      </Card>
      {adding && <AddModal onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} />}
    </div>
  );
}
export default function Page() { return <Suspense fallback={<Spinner />}><Inner /></Suspense>; }

function AddModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: "", brand: "", category: "", size: "", color: "", condition: "new_with_tags", purchase_price: "", location: "", planned_price: "" });
  const { busy, run } = useAction();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const n = (v: string) => Number(v.replace(",", "."));
  return (
    <Modal open onClose={onClose} title="Ajouter un article déjà détenu">
      <p className="mb-3 text-xs text-muted">Pour un article hors commande fournisseur (déjà acheté). Son coût d'achat sera la base du calcul de bénéfice ; il n'est pas ajouté aux dépenses du journal : saisissez-les séparément dans Finance si nécessaire.</p>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run("a", async () => { await api("/inventory", { body: { name: f.name, brand: f.brand || null, category: f.category || null, size: f.size || null, color: f.color || null, condition: f.condition, purchase_price: n(f.purchase_price || "0"), location: f.location || null, planned_price: f.planned_price ? n(f.planned_price) : null } }); onSaved(); }, "Article ajouté"); }}>
        <Field label="Nom" className="sm:col-span-2"><Input required value={f.name} onChange={set("name")} /></Field>
        <Field label="Marque"><Input value={f.brand} onChange={set("brand")} /></Field><Field label="Catégorie"><Input value={f.category} onChange={set("category")} /></Field>
        <Field label="Taille"><Input value={f.size} onChange={set("size")} /></Field><Field label="Couleur"><Input value={f.color} onChange={set("color")} /></Field>
        <Field label="État"><Select value={f.condition} onChange={set("condition")}>{Object.entries(CONDITION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Prix d'achat (€)"><Input inputMode="decimal" value={f.purchase_price} onChange={set("purchase_price")} /></Field>
        <Field label="Prix de vente prévu (€)"><Input inputMode="decimal" value={f.planned_price} onChange={set("planned_price")} /></Field><Field label="Emplacement"><Input value={f.location} onChange={set("location")} /></Field>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={onClose}>Annuler</Button><Button type="submit" loading={busy === "a"}>Ajouter</Button></div>
      </form>
    </Modal>
  );
}
