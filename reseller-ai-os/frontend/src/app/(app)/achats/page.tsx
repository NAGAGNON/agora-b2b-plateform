"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { FileUp, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { eur, dateFr } from "@/lib/format";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, StatCard, TableWrap, Tabs, tdCls, thCls, useAction } from "@/components/ui";

type PO = { id: number; reference: string | null; supplier_name: string | null; status: string; status_label: string; total: number; created_at: string; auto_prepared: boolean; lines: { name: string; quantity: number }[] };
type Budget = { monthly_budget: number; monthly_spent: number; committed: number; monthly_remaining: number | null; daily_remaining: number | null; per_purchase_budget: number };
type List = { items: PO[]; budget: Budget; statuses: { key: string; label: string }[] };
type Supplier = { id: number; name: string };
const poTone = (s: string) => (s === "received" ? "green" : s === "cancelled" ? "red" : s === "awaiting_validation" ? "amber" : s === "validated" || s === "ordered" || s === "shipped" ? "blue" : "neutral") as "green" | "red" | "amber" | "blue" | "neutral";

function Inner() {
  const sp = useSearchParams();
  const [status, setStatus] = useState(sp.get("status") ?? "");
  const { data, error, loading, reload } = useApi<List>(`/purchases${status ? `?status=${status}` : ""}`);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  return (
    <div>
      <PageHeader title="Achats" sub="Aucun paiement n'est effectué par l'application : vous passez la commande chez le fournisseur, puis la marquez « Commandée » après avoir validé."
        actions={<><Button variant="secondary" onClick={() => setImporting(true)}><FileUp className="size-4" />Importer une facture / commande</Button><Button onClick={() => setCreating(true)}><Plus className="size-4" />Nouvelle commande</Button></>} />
      {data && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Dépensé ce mois (achats)" value={eur(data.budget.monthly_spent)} />
          <StatCard label="Engagé (validé, non commandé)" value={eur(data.budget.committed)} />
          <StatCard label="Budget mensuel restant" value={data.budget.monthly_budget > 0 ? eur(data.budget.monthly_remaining) : "illimité"} sub={data.budget.monthly_budget > 0 ? `sur ${eur(data.budget.monthly_budget)}` : "à définir dans Paramètres"} />
          <StatCard label="Budget par achat" value={data.budget.per_purchase_budget > 0 ? eur(data.budget.per_purchase_budget) : "illimité"} />
        </div>
      )}
      <Card>
        <Tabs value={status} onChange={setStatus} tabs={[{ key: "", label: "Toutes" }, ...(data?.statuses ?? []).filter((s) => s.key !== "cancelled").map((s) => ({ key: s.key, label: s.label })), { key: "cancelled", label: "Annulées" }]} />
        {error && <div className="p-3"><ErrorBox onRetry={reload}>{error}</ErrorBox></div>}
        {loading && !data ? <Spinner /> : data?.items.length === 0 ? (
          <Empty title="Aucune commande" icon={<ShoppingCart className="size-6" />}>Créez une commande depuis une opportunité, ou laissez l'agent préparer des paniers (« Préparer des paniers » dans Opportunités).</Empty>
        ) : (
          <TableWrap><thead><tr className="border-b border-line">{["#", "Fournisseur", "Contenu", "Total", "Statut", "Date"].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
            <tbody>{data?.items.map((o) => (
              <tr key={o.id} className="border-b border-line last:border-0 hover:bg-surface2">
                <td className={tdCls}><Link className="font-medium text-accent underline" href={`/achats/${o.id}`}>#{o.id}</Link>{o.reference && <div className="text-xs text-muted">{o.reference}</div>}</td>
                <td className={tdCls}>{o.supplier_name ?? "—"}</td>
                <td className={tdCls}><div className="max-w-[320px] truncate">{o.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ")}</div>{o.auto_prepared && <Badge tone="blue">préparée par l'agent</Badge>}</td>
                <td className={`${tdCls} tabular-nums font-medium`}>{eur(o.total)}</td><td className={tdCls}><Badge tone={poTone(o.status)}>{o.status_label}</Badge></td><td className={tdCls}>{dateFr(o.created_at)}</td></tr>))}</tbody></TableWrap>
        )}
      </Card>
      {creating && <CreateModal onClose={() => setCreating(false)} />}
      {importing && <ImportModal onClose={() => { setImporting(false); reload(); }} />}
    </div>
  );
}
export default function Page() { return <Suspense fallback={<Spinner />}><Inner /></Suspense>; }

function CreateModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const sup = useApi<Supplier[]>("/suppliers");
  const [f, setF] = useState({ supplier_id: "", shipping_cost: "0", other_fees: "0", reference: "", supplier_url: "", notes: "" });
  const [lines, setLines] = useState([{ name: "", unit_price: "", quantity: "1" }]);
  const { busy, run } = useAction();
  const n = (v: string) => Number(v.replace(",", ".")) || 0;
  return (
    <Modal open wide onClose={onClose} title="Nouvelle commande fournisseur">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run("c", async () => {
        const r = await api<{ id: number }>("/purchases", { body: { supplier_id: f.supplier_id ? Number(f.supplier_id) : null, shipping_cost: n(f.shipping_cost), other_fees: n(f.other_fees), reference: f.reference || null, supplier_url: f.supplier_url || null, notes: f.notes || null,
          lines: lines.map((l) => ({ name: l.name, unit_price: n(l.unit_price), quantity: Number(l.quantity) || 1 })) } });
        router.push(`/achats/${r.id}`); }, "Commande créée"); }}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Fournisseur"><Select value={f.supplier_id} onChange={(e) => setF({ ...f, supplier_id: e.target.value })}><option value="">—</option>{sup.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label="Livraison fournisseur (€)"><Input inputMode="decimal" value={f.shipping_cost} onChange={(e) => setF({ ...f, shipping_cost: e.target.value })} /></Field>
          <Field label="Autres frais (€)"><Input inputMode="decimal" value={f.other_fees} onChange={(e) => setF({ ...f, other_fees: e.target.value })} /></Field>
          <Field label="Référence de commande"><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
          <Field label="Lien fournisseur" className="sm:col-span-2"><Input type="url" value={f.supplier_url} onChange={(e) => setF({ ...f, supplier_url: e.target.value })} /></Field>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted">Lignes</div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_90px_70px_32px] gap-2">
              <Input required placeholder="Produit" aria-label="Produit" value={l.name} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <Input required placeholder="Prix €" aria-label="Prix unitaire" inputMode="decimal" value={l.unit_price} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unit_price: e.target.value } : x)))} />
              <Input type="number" min={1} aria-label="Quantité" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
              <button type="button" aria-label="Retirer la ligne" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-muted hover:text-danger disabled:opacity-30"><Trash2 className="size-4" /></button>
            </div>))}
          <Button type="button" variant="secondary" size="sm" onClick={() => setLines([...lines, { name: "", unit_price: "", quantity: "1" }])}><Plus className="size-3.5" />Ligne</Button>
        </div>
        <div className="flex items-center justify-between border-t border-line pt-3">
          <div className="text-sm">Total : <strong className="tabular-nums">{eur(lines.reduce((a, l) => a + n(l.unit_price) * (Number(l.quantity) || 1), 0) + n(f.shipping_cost) + n(f.other_fees))}</strong></div>
          <div className="flex gap-2"><Button type="button" variant="ghost" onClick={onClose}>Annuler</Button><Button type="submit" loading={busy === "c"}>Créer</Button></div>
        </div>
      </form>
    </Modal>
  );
}

type Parsed = { id: number; kind: string; parsed: { fields: Record<string, string>; lines?: { name: string; unit_price: string; quantity: number }[]; note: string }; text_preview: string };
function ImportModal({ onClose }: { onClose: () => void }) {
  const [doc, setDoc] = useState<Parsed | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const sup = useApi<Supplier[]>("/suppliers");
  const [f, setF] = useState({ action: "expense", amount: "", category: "autre", description: "", supplier_id: "", shipping_cost: "0", reference: "" });
  const { busy, run } = useAction();
  const router = useRouter();
  return (
    <Modal open wide onClose={onClose} title="Importer une facture ou une confirmation de commande">
      <div className="space-y-4">
        <p className="text-sm text-muted">PDF, e-mail (.eml), texte ou CSV (colonnes : nom, prix, quantité). L'extraction est indicative : <strong>rien n'est enregistré avant votre confirmation</strong>.</p>
        <Field label="Fichier"><Input type="file" accept=".pdf,.eml,.txt,.csv,.tsv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setDoc(null); }} /></Field>
        {file && !doc && <Button loading={busy === "a"} onClick={() => run("a", async () => { const fd = new FormData(); fd.append("file", file); const d = await api<Parsed>("/documents/analyze", { form: fd }); setDoc(d);
          setF((s) => ({ ...s, action: d.parsed.lines?.length ? "order" : "expense", amount: d.parsed.fields.total ?? "", reference: d.parsed.fields.reference ?? "" })); })}>Analyser</Button>}
        {doc && (
          <div className="space-y-3">
            <div className="rounded-lg bg-surface2 p-3 text-xs"><div className="mb-1 font-medium">Champs détectés ({doc.kind})</div>{Object.keys(doc.parsed.fields).length ? Object.entries(doc.parsed.fields).map(([k, v]) => <div key={k}>{k} : {v}</div>) : "Aucun champ reconnu — saisissez les montants."}
              {doc.parsed.lines && <div className="mt-1">{doc.parsed.lines.length} ligne(s) de commande reconnue(s)</div>}</div>
            {doc.text_preview && <details className="text-xs"><summary className="cursor-pointer text-muted">Texte extrait</summary><pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-surface2 p-2">{doc.text_preview}</pre></details>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Enregistrer comme"><Select value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })}><option value="expense">Dépense (abonnement, frais…)</option><option value="order" disabled={!doc.parsed.lines?.length}>Commande fournisseur déjà passée (stock)</option></Select></Field>
              {f.action === "expense" ? <>
                <Field label="Montant (€)"><Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
                <Field label="Catégorie"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{[["expedition", "Frais d'expédition"], ["emballage", "Emballages"], ["frais_operationnels", "Frais opérationnels"], ["abonnement", "Abonnements"], ["retour", "Retours"], ["autre", "Autres"]].map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                <Field label="Description"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field></> : <>
                <Field label="Fournisseur"><Select value={f.supplier_id} onChange={(e) => setF({ ...f, supplier_id: e.target.value })}><option value="">—</option>{sup.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
                <Field label="Livraison (€)"><Input inputMode="decimal" value={f.shipping_cost} onChange={(e) => setF({ ...f, shipping_cost: e.target.value })} /></Field>
                <Field label="Référence"><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field></>}
            </div>
            <div className="flex justify-end"><Button loading={busy === "ok"} onClick={() => run("ok", async () => {
              const body = f.action === "expense" ? { action: "expense", amount: Number(f.amount.replace(",", ".")), category: f.category, description: f.description || null } :
                { action: "order", supplier_id: f.supplier_id ? Number(f.supplier_id) : null, shipping_cost: Number(f.shipping_cost.replace(",", ".")) || 0, reference: f.reference || null };
              const r = await api<{ id?: number }>(`/documents/${doc.id}/confirm`, { body }); if (f.action === "order" && r.id) router.push(`/achats/${r.id}`); else onClose(); }, "Enregistré")}>Confirmer l'enregistrement</Button></div>
          </div>
        )}
      </div>
    </Modal>
  );
}
