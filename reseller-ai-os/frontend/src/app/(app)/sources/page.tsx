"use client";
import { useState } from "react";
import { Database, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { dateTimeFr, eur } from "@/lib/format";
import { SOURCE_KIND } from "@/lib/labels";
import { Badge, Button, Card, CardHeader, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, TableWrap, Textarea, tdCls, thCls, useAction } from "@/components/ui";

type Supplier = { id: number; name: string; website: string | null; contact: string | null; kind: string; default_shipping: number; lead_time_days: number | null; notes: string | null; allowed: boolean; opportunities: number; total_spent: number; orders: number; sources: number };
type Source = { id: number; name: string; supplier_id: number | null; supplier: string | null; kind: string; url: string | null; enabled: boolean; last_sync_at: string | null; last_status: string | null; products: number; mapping: Record<string, string>; json_path: string | null; currency_rate: number; secret_name: string | null; header_name: string | null };
type Preview = { columns: string[]; suggested_mapping: Record<string, string>; sample: Record<string, string>[]; total_rows: number };

const FIELDS: [string, string, boolean][] = [["name", "Nom du produit", true], ["purchase_price", "Prix d'achat", true], ["external_ref", "Référence", false], ["image_url", "Photo", false], ["brand", "Marque", false], ["category", "Catégorie", false],
  ["description", "Description", false], ["supplier_url", "Lien produit", false], ["availability", "Disponibilité", false], ["shipping_cost", "Frais de livraison", false], ["manual_resale_price", "Prix de revente connu", false]];

export default function Page() {
  const sup = useApi<Supplier[]>("/suppliers");
  const src = useApi<Source[]>("/sources");
  const [supForm, setSupForm] = useState<Partial<Supplier> | null>(null);
  const [srcForm, setSrcForm] = useState<Partial<Source> | null>(null);
  const [upload, setUpload] = useState<Source | null>(null);
  const { busy, run } = useAction();
  return (
    <div className="space-y-8">
      <PageHeader title="Sources & fournisseurs" sub="Seules des sources autorisées sont utilisées : fichiers CSV de fournisseurs, flux CSV/JSON ou API dont vous avez les droits. Aucun scraping de Vinted ni de sites qui l'interdisent." />
      <section>
        <Card>
          <CardHeader title="Sources de catalogue" sub="Alimentent la détection d'opportunités (tâche quotidienne ou manuelle)" action={<Button size="sm" onClick={() => setSrcForm({ kind: "csv_file", enabled: true, currency_rate: 1 })}><Plus className="size-4" />Source</Button>} />
          {src.error && <div className="p-3"><ErrorBox onRetry={src.reload}>{src.error}</ErrorBox></div>}
          {src.loading && !src.data ? <Spinner /> : src.data?.length === 0 ? (
            <Empty title="Aucune source" icon={<Database className="size-6" />}>Créez une source « Fichier CSV » puis importez le catalogue de votre fournisseur (les colonnes sont reconnues automatiquement). Pour un catalogue SHEIN ou autre marketplace : n'utilisez que des exports/flux affiliés ou partenaires autorisés.</Empty>
          ) : (
            <TableWrap><thead><tr className="border-b border-line">{["Source", "Type", "Fournisseur", "Produits", "Dernière synchro", ""].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
              <tbody>{src.data?.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className={tdCls}><div className="font-medium">{s.name}</div>{s.url && <div className="max-w-[260px] truncate text-xs text-muted">{s.url}</div>}</td>
                  <td className={tdCls}><Badge>{SOURCE_KIND[s.kind]}</Badge>{!s.enabled && <Badge tone="amber" className="ml-1">Désactivée</Badge>}</td>
                  <td className={tdCls}>{s.supplier ?? "—"}</td><td className={`${tdCls} tabular-nums`}>{s.products}</td>
                  <td className={tdCls}><div className="text-xs">{dateTimeFr(s.last_sync_at)}</div><div className={`max-w-[260px] truncate text-xs ${s.last_status?.startsWith("Échec") ? "text-danger" : "text-muted"}`}>{s.last_status}</div></td>
                  <td className={`${tdCls} text-right whitespace-nowrap`}>
                    {s.kind === "csv_file" ? <Button size="sm" variant="secondary" onClick={() => setUpload(s)}><Upload className="size-3.5" />Importer</Button>
                      : <Button size="sm" variant="secondary" loading={busy === `s${s.id}`} onClick={() => run(`s${s.id}`, async () => { const r = await api<{ created: number; updated: number }>(`/sources/${s.id}/sync`, { body: {} }); src.reload(); return r; }, "Synchronisation terminée")}><RefreshCw className="size-3.5" />Synchroniser</Button>}
                    <Button size="sm" variant="ghost" onClick={() => setSrcForm(s)}>Modifier</Button>
                    <button aria-label="Supprimer la source" className="p-1.5 text-muted hover:text-danger" onClick={() => confirm(`Supprimer la source « ${s.name} » ? Les produits importés sont conservés.`) && run("del", async () => { await api(`/sources/${s.id}`, { method: "DELETE" }); src.reload(); }, "Source supprimée")}><Trash2 className="size-4" /></button>
                  </td></tr>))}</tbody></TableWrap>
          )}
        </Card>
      </section>
      <section>
        <Card>
          <CardHeader title="Fournisseurs" action={<Button size="sm" onClick={() => setSupForm({ kind: "grossiste", allowed: true, default_shipping: 0 })}><Plus className="size-4" />Fournisseur</Button>} />
          {sup.loading && !sup.data ? <Spinner /> : sup.data?.length === 0 ? <Empty title="Aucun fournisseur">Ajoutez vos fournisseurs pour rattacher sources, produits et commandes.</Empty> : (
            <TableWrap><thead><tr className="border-b border-line">{["Nom", "Type", "Livraison", "Produits", "Commandes", "Dépensé", "Autorisé", ""].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
              <tbody>{sup.data?.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0"><td className={tdCls}><div className="font-medium">{s.name}</div><div className="text-xs text-muted">{s.website}</div></td>
                  <td className={tdCls}>{s.kind}</td><td className={`${tdCls} tabular-nums`}>{eur(s.default_shipping)}</td><td className={tdCls}>{s.opportunities}</td><td className={tdCls}>{s.orders}</td>
                  <td className={`${tdCls} tabular-nums`}>{eur(s.total_spent)}</td><td className={tdCls}>{s.allowed ? <Badge tone="green">Oui</Badge> : <Badge tone="red">Non</Badge>}</td>
                  <td className={`${tdCls} text-right`}><Button size="sm" variant="ghost" onClick={() => setSupForm(s)}>Modifier</Button>
                    <button aria-label="Supprimer" className="p-1.5 text-muted hover:text-danger" onClick={() => confirm(`Supprimer « ${s.name} » ?`) && run("d", async () => { await api(`/suppliers/${s.id}`, { method: "DELETE" }); sup.reload(); }, "Fournisseur supprimé")}><Trash2 className="size-4" /></button></td></tr>))}</tbody></TableWrap>
          )}
        </Card>
      </section>
      {supForm && <SupplierModal init={supForm} onClose={() => setSupForm(null)} onSaved={() => { setSupForm(null); sup.reload(); }} />}
      {srcForm && <SourceModal init={srcForm} suppliers={sup.data ?? []} onClose={() => setSrcForm(null)} onSaved={() => { setSrcForm(null); src.reload(); }} />}
      {upload && <UploadModal src={upload} onClose={() => { setUpload(null); src.reload(); }} />}
    </div>
  );
}

function SupplierModal({ init, onClose, onSaved }: { init: Partial<Supplier>; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: init.name ?? "", website: init.website ?? "", contact: init.contact ?? "", kind: init.kind ?? "grossiste", default_shipping: String(init.default_shipping ?? 0), lead_time_days: init.lead_time_days ? String(init.lead_time_days) : "", notes: init.notes ?? "", allowed: init.allowed ?? true });
  const { busy, run } = useAction();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title={init.id ? "Modifier le fournisseur" : "Nouveau fournisseur"}>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run("s", async () => {
        const body = { ...f, website: f.website || null, contact: f.contact || null, notes: f.notes || null, default_shipping: Number(f.default_shipping.replace(",", ".")) || 0, lead_time_days: f.lead_time_days ? Number(f.lead_time_days) : null };
        await api(init.id ? `/suppliers/${init.id}` : "/suppliers", { method: init.id ? "PUT" : "POST", body }); onSaved(); }, "Fournisseur enregistré"); }}>
        <Field label="Nom" className="sm:col-span-2"><Input required value={f.name} onChange={set("name")} /></Field>
        <Field label="Site web"><Input type="url" value={f.website} onChange={set("website")} /></Field>
        <Field label="Contact"><Input value={f.contact} onChange={set("contact")} /></Field>
        <Field label="Type"><Select value={f.kind} onChange={set("kind")}><option value="grossiste">Grossiste</option><option value="seconde_main">Seconde main</option><option value="marketplace">Marketplace</option><option value="autre">Autre</option></Select></Field>
        <Field label="Livraison par défaut (€)"><Input inputMode="decimal" value={f.default_shipping} onChange={set("default_shipping")} /></Field>
        <Field label="Délai de livraison (jours)"><Input type="number" min={0} value={f.lead_time_days} onChange={set("lead_time_days")} /></Field>
        <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={f.allowed} onChange={(e) => setF({ ...f, allowed: e.target.checked })} />Fournisseur autorisé (achats automatiques)</label>
        <Field label="Notes" className="sm:col-span-2"><Textarea value={f.notes} onChange={set("notes")} /></Field>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={onClose}>Annuler</Button><Button type="submit" loading={busy === "s"}>Enregistrer</Button></div>
      </form>
    </Modal>
  );
}

function SourceModal({ init, suppliers, onClose, onSaved }: { init: Partial<Source>; suppliers: Supplier[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: init.name ?? "", supplier_id: init.supplier_id ? String(init.supplier_id) : "", kind: init.kind ?? "csv_file", url: init.url ?? "", json_path: init.json_path ?? "", currency_rate: String(init.currency_rate ?? 1), secret_name: init.secret_name ?? "", header_name: init.header_name ?? "", enabled: init.enabled ?? true, mapping: JSON.stringify(init.mapping ?? {}) });
  const { busy, run } = useAction();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const remote = f.kind !== "csv_file";
  return (
    <Modal open onClose={onClose} title={init.id ? "Modifier la source" : "Nouvelle source"}>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run("s", async () => {
        let mapping = {}; try { mapping = JSON.parse(f.mapping || "{}"); } catch { throw new Error("Correspondance de colonnes : JSON invalide."); }
        const body = { name: f.name, supplier_id: f.supplier_id ? Number(f.supplier_id) : null, kind: f.kind, url: remote ? f.url : null, json_path: f.json_path || null, currency_rate: Number(f.currency_rate.replace(",", ".")) || 1, secret_name: f.secret_name || null, header_name: f.header_name || null, enabled: f.enabled, mapping };
        await api(init.id ? `/sources/${init.id}` : "/sources", { method: init.id ? "PUT" : "POST", body }); onSaved(); }, "Source enregistrée"); }}>
        <Field label="Nom" className="sm:col-span-2"><Input required value={f.name} onChange={set("name")} /></Field>
        <Field label="Type"><Select value={f.kind} onChange={set("kind")}>{Object.entries(SOURCE_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Fournisseur"><Select value={f.supplier_id} onChange={set("supplier_id")}><option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        {remote && <Field label="URL du flux (https)" className="sm:col-span-2" hint="Les adresses privées/locales sont refusées (protection SSRF)."><Input required type="url" value={f.url} onChange={set("url")} /></Field>}
        {f.kind === "json_url" && <Field label="Chemin de la liste dans le JSON" hint="ex. data.products — vide si la racine est la liste"><Input value={f.json_path} onChange={set("json_path")} /></Field>}
        {remote && <><Field label="Clé API (nom du secret)" hint="Créée dans Paramètres → Clés API"><Input value={f.secret_name} onChange={set("secret_name")} /></Field>
          <Field label="En-tête HTTP de la clé" hint="ex. Authorization ou X-Api-Key"><Input value={f.header_name} onChange={set("header_name")} /></Field></>}
        <Field label="Taux de conversion vers EUR" hint="1 si les prix sont déjà en euros"><Input inputMode="decimal" value={f.currency_rate} onChange={set("currency_rate")} /></Field>
        <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />Source active</label>
        <Field label="Correspondance de colonnes (JSON, optionnel)" className="sm:col-span-2" hint='Vide = détection automatique. ex. {"name":"titre","purchase_price":"prix_ht"}'><Textarea className="font-mono text-xs" value={f.mapping} onChange={set("mapping")} /></Field>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={onClose}>Annuler</Button><Button type="submit" loading={busy === "s"}>Enregistrer</Button></div>
      </form>
    </Modal>
  );
}

function UploadModal({ src, onClose }: { src: Source; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [pv, setPv] = useState<Preview | null>(null);
  const [res, setRes] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null);
  const { busy, run } = useAction();
  const form = () => { const fd = new FormData(); fd.append("file", file!); return fd; };
  return (
    <Modal open onClose={onClose} wide title={`Importer un catalogue — ${src.name}`}>
      <div className="space-y-4">
        <Field label="Fichier CSV (séparateur , ; tab ou |)"><Input type="file" accept=".csv,.tsv,.txt" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPv(null); setRes(null); }} /></Field>
        {file && !pv && <Button loading={busy === "pv"} onClick={() => run("pv", async () => setPv(await api<Preview>(`/sources/${src.id}/upload?preview=true`, { form: form() })))}>Analyser le fichier</Button>}
        {pv && !res && (
          <>
            <p className="text-sm">{pv.total_rows} ligne(s). Colonnes reconnues :</p>
            <div className="grid gap-1 text-sm sm:grid-cols-2">{FIELDS.map(([k, label, req]) => (
              <div key={k} className="flex justify-between rounded-md bg-surface2 px-2 py-1"><span>{label}{req && " *"}</span>{pv.suggested_mapping[k] ? <Badge tone="green">{pv.suggested_mapping[k]}</Badge> : <Badge tone={req ? "red" : "neutral"}>{req ? "manquante" : "—"}</Badge>}</div>))}</div>
            {(!pv.suggested_mapping.name || !pv.suggested_mapping.purchase_price) && <ErrorBox>Colonnes obligatoires non reconnues. Colonnes du fichier : {pv.columns.join(", ")}. Renommez-les ou définissez la correspondance dans « Modifier » la source.</ErrorBox>}
            <div className="overflow-x-auto rounded-lg border border-line text-xs"><table className="w-full"><thead><tr>{pv.columns.map((c) => <th key={c} className="px-2 py-1 text-left text-muted">{c}</th>)}</tr></thead>
              <tbody>{pv.sample.map((r, i) => <tr key={i} className="border-t border-line">{pv.columns.map((c) => <td key={c} className="max-w-[160px] truncate px-2 py-1">{r[c]}</td>)}</tr>)}</tbody></table></div>
            <Button loading={busy === "imp"} disabled={!pv.suggested_mapping.name || !pv.suggested_mapping.purchase_price} onClick={() => run("imp", async () => setRes(await api(`/sources/${src.id}/upload`, { form: form() })), "Import terminé")}>Importer {pv.total_rows} ligne(s)</Button>
          </>
        )}
        {res && (
          <div className="space-y-2 text-sm"><div className="flex gap-2"><Badge tone="green">{res.created} créé(s)</Badge><Badge>{res.updated} mis à jour</Badge><Badge>{res.skipped} ignoré(s)</Badge>{res.errors.length > 0 && <Badge tone="red">{res.errors.length} erreur(s)</Badge>}</div>
            {res.errors.map((e) => <div key={e} className="text-xs text-danger">{e}</div>)}
            <p className="text-muted">Lancez « Analyser tout » dans Opportunités. Les produits sans prix de revente connu resteront non notés tant que vous n'en saisissez pas.</p></div>
        )}
      </div>
    </Modal>
  );
}
