"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { eur, pct } from "@/lib/format";
import { AVAIL, COMPLIANCE, LEVEL, OPP_STATUS } from "@/lib/labels";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, ScorePill, Select, Spinner, Textarea, TableWrap, Tabs, tdCls, thCls, useAction, useToast } from "@/components/ui";
import { SimulatorPanel } from "@/components/simulator";

type Opp = {
  id: number; name: string; image_url: string | null; brand: string | null; category: string | null; description: string | null; supplier_url: string | null;
  supplier_id: number | null; supplier_name: string | null; availability: string; purchase_price: number; shipping_cost: number; extra_costs: number;
  manual_resale_price: number | null; ai_resale_estimate: number | null; resale_price: number | null; resale_basis: string | null; est_profit: number | null; est_margin_pct: number | null;
  score: number | null; confidence: number | null; demand: string | null; competition: string | null; trend: string | null; risk: string | null; compliance: string;
  compliance_notes: string | null; notes: string | null; status: string; last_checked_at: string | null; total_cost: string | null;
  score_detail: { breakdown?: Record<string, number>; missing?: string[]; verdict?: string; ai?: { warning: string; reasoning: string; filled: string[] } } | null;
  references?: { id: number; price: number; kind: string; note: string | null; url: string | null }[];
};
type List = { total: number; items: Opp[]; categories: string[] };
type Supplier = { id: number; name: string };

const BREAK: Record<string, string> = { margin: "Marge", profit: "Bénéfice", demand: "Demande", competition: "Concurrence", risk: "Risque", evidence: "Preuves de prix" };
const MAXPTS: Record<string, number> = { margin: 40, profit: 20, demand: 15, competition: 10, risk: 10, evidence: 5 };
const statusTone = (s: string) => (s === "recommended" || s === "validated" ? "green" : s === "rejected" ? "red" : s === "purchased" ? "blue" : "neutral") as "green" | "red" | "blue" | "neutral";

function Page() {
  const router = useRouter();
  const sp = useSearchParams();
  const [f, setF] = useState({ q: "", category: "", supplier_id: "", min_margin: "", min_profit: "", min_score: sp.get("min_score") ?? "", min_price: "", max_price: "", availability: sp.get("availability") ?? "", status: "", scored: "", sort: "score" });
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
    return p.toString();
  }, [f]);
  const { data, error, loading, reload } = useApi<List>(`/opportunities?${qs}&limit=200`);
  const sup = useApi<Supplier[]>("/suppliers");
  const [open, setOpen] = useState<number | null>(sp.get("id") ? Number(sp.get("id")) : null);
  const [adding, setAdding] = useState(false);
  const [sel, setSel] = useState<number[]>([]);
  const { busy, run } = useAction();
  const toast = useToast();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const chip = (k: string, v: string, label: string) => (
    <button key={label} onClick={() => setF({ ...f, [k]: f[k as keyof typeof f] === v ? "" : v })}
      className={`rounded-full border px-2.5 py-1 text-xs transition ${f[k as keyof typeof f] === v ? "border-accent bg-accentsoft text-accent" : "border-line text-muted hover:text-ink"}`}>{label}</button>
  );

  async function makeOrder() {
    const r = await run("order", () => api<{ id: number }>("/purchases/from-opportunities?quantity=1", { body: sel }), "Commande créée (à étudier)");
    if (r) router.push(`/achats/${r.id}`);
  }

  return (
    <div>
      <PageHeader title="Opportunités" sub="Produits détectés, notés /100 de façon transparente. Sans prix de revente, un produit n'est pas noté : aucune donnée n'est inventée."
        actions={<>
          <Button variant="secondary" loading={busy === "analyze"} onClick={() => run("analyze", async () => { const r = await api<{ analyzed: number }>("/opportunities/analyze", { body: {} }); reload(); return r; }, "Analyse terminée")}><Wand2 className="size-4" />Analyser tout</Button>
          <Button variant="secondary" loading={busy === "baskets"} onClick={() => run("baskets", async () => { const r = await api<{ orders_created: number[]; skipped: unknown[] }>("/purchases/prepare-baskets", { body: {} }); toastBaskets(r); return r; })}>Préparer des paniers</Button>
          <Button onClick={() => setAdding(true)}><Plus className="size-4" />Ajouter un produit</Button>
        </>} />
      <Card className="mb-4 space-y-3 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Input placeholder="Rechercher…" value={f.q} onChange={set("q")} aria-label="Recherche" />
          <Select value={f.category} onChange={set("category")} aria-label="Catégorie"><option value="">Toutes catégories</option>{data?.categories.map((c) => <option key={c}>{c}</option>)}</Select>
          <Select value={f.supplier_id} onChange={set("supplier_id")} aria-label="Fournisseur"><option value="">Tous fournisseurs</option>{sup.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          <Select value={f.status} onChange={set("status")} aria-label="Statut"><option value="">Tous statuts</option>{Object.entries(OPP_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
          <Select value={f.sort} onChange={set("sort")} aria-label="Tri"><option value="score">Tri : score</option><option value="margin">Tri : marge</option><option value="profit">Tri : bénéfice</option><option value="price">Tri : prix d'achat</option><option value="recent">Tri : récents</option></Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Marge :</span>{chip("min_margin", "20", "> 20 %")}{chip("min_margin", "30", "> 30 %")}
          <span className="ml-2 text-xs text-muted">Bénéfice :</span>{chip("min_profit", "5", "> 5 €")}{chip("min_profit", "10", "> 10 €")}
          <span className="ml-2 text-xs text-muted">Score :</span>{chip("min_score", "60", "≥ 60")}{chip("min_score", "80", "≥ 80")}
          <span className="ml-2 text-xs text-muted">Données :</span>{chip("scored", "false", "non notés")}{chip("availability", "in_stock", "disponibles")}
          <div className="ml-auto flex items-center gap-2 text-xs text-muted">Prix d'achat
            <Input className="!w-20 !py-1" placeholder="min" inputMode="decimal" value={f.min_price} onChange={set("min_price")} aria-label="Prix min" />
            <Input className="!w-20 !py-1" placeholder="max" inputMode="decimal" value={f.max_price} onChange={set("max_price")} aria-label="Prix max" /></div>
        </div>
      </Card>
      {sel.length > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-accent/30 bg-accentsoft px-3 py-2 text-sm">
          {sel.length} sélectionné(s)
          <Button size="sm" loading={busy === "order"} onClick={makeOrder}>Créer une commande</Button>
          <button className="text-muted underline" onClick={() => setSel([])}>Vider</button>
        </div>
      )}
      <Card>
        {error && <div className="p-3"><ErrorBox onRetry={reload}>{error}</ErrorBox></div>}
        {loading && !data ? <Spinner /> : data && data.items.length === 0 ? (
          <Empty title="Aucune opportunité" icon={<Sparkles className="size-6" />}>
            Ajoutez un produit à la main, ou <Link href="/sources" className="underline">branchez une source de catalogue</Link> (CSV, JSON autorisé) pour en détecter automatiquement.
          </Empty>
        ) : data && (
          <>
            <TableWrap>
              <thead><tr className="border-b border-line">
                <th className={thCls} />{["Produit", "Fournisseur", "Achat", "Revente", "Bénéfice", "Marge", "Score", "Conf.", "Statut"].map((h) => <th key={h} className={thCls}>{h}</th>)}
              </tr></thead>
              <tbody>
                {data.items.map((o) => (
                  <tr key={o.id} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface2" onClick={() => setOpen(o.id)}>
                    <td className={tdCls} onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Sélectionner ${o.name}`} checked={sel.includes(o.id)} onChange={(e) => setSel(e.target.checked ? [...sel, o.id] : sel.filter((x) => x !== o.id))} /></td>
                    <td className={tdCls}>
                      <div className="flex items-center gap-3">
                        {o.image_url ?   <img src={o.image_url} alt="" className="size-10 rounded-md border border-line object-cover" loading="lazy" referrerPolicy="no-referrer" /> : <div className="size-10 rounded-md bg-surface2" />}
                        <div className="min-w-0"><div className="max-w-[260px] truncate font-medium">{o.name}</div><div className="text-xs text-muted">{[o.brand, o.category].filter(Boolean).join(" · ") || "—"}{o.availability === "out_of_stock" && <Badge tone="red" className="ml-1">Rupture</Badge>}</div></div>
                      </div>
                    </td>
                    <td className={tdCls}>{o.supplier_name ?? "—"}</td>
                    <td className={`${tdCls} tabular-nums`}>{eur(o.purchase_price)}</td>
                    <td className={`${tdCls} tabular-nums`}>{o.resale_price !== null ? <>{eur(o.resale_price)}<div className="text-[11px] text-muted">{o.resale_basis}</div></> : <span className="text-xs text-muted">manquant</span>}</td>
                    <td className={`${tdCls} tabular-nums ${o.est_profit !== null && o.est_profit < 0 ? "text-danger" : ""}`}>{o.est_profit !== null ? eur(o.est_profit) : "—"}</td>
                    <td className={`${tdCls} tabular-nums`}>{pct(o.est_margin_pct)}</td>
                    <td className={tdCls}><ScorePill score={o.score} /></td>
                    <td className={`${tdCls} tabular-nums text-xs text-muted`}>{o.confidence !== null && o.score !== null ? `${o.confidence} %` : "—"}</td>
                    <td className={tdCls}><Badge tone={statusTone(o.status)}>{OPP_STATUS[o.status]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <div className="border-t border-line px-4 py-2 text-xs text-muted">{data.items.length} affiché(s) sur {data.total}</div>
          </>
        )}
      </Card>
      {open !== null && <Detail id={open} onClose={() => { setOpen(null); reload(); }} />}
      {adding && <ProductForm suppliers={sup.data ?? []} onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); setOpen(id); reload(); }} />}
    </div>
  );

  function toastBaskets(r: { orders_created: number[]; skipped: unknown[] }) {
    const msg = r.orders_created.length ? `${r.orders_created.length} commande(s) préparée(s) : à valider dans « Achats ».` : r.skipped.length ? "Aucun panier créé : budget dépassé (voir Achats / Finance)." : "Aucun produit éligible (score, marge, disponibilité, fournisseur autorisé).";
    r.orders_created.length ? toast.ok(msg) : toast.err(msg);
    reload();
  }
}

export default function Wrapper() { return <Suspense fallback={<Spinner />}><Page /></Suspense>; }

function Detail({ id, onClose }: { id: number; onClose: () => void }) {
  const { data: o, error, reload } = useApi<Opp>(`/opportunities/${id}`);
  const [tab, setTab] = useState("analyse");
  const { busy, run } = useAction();
  const [ref, setRef] = useState({ price: "", kind: "sold", note: "" });
  const [edit, setEdit] = useState<Partial<Opp> | null>(null);
  const router = useRouter();
  useEffect(() => { if (o) setEdit(null); }, [o]);
  if (error) return <Modal open onClose={onClose} title="Opportunité"><ErrorBox>{error}</ErrorBox></Modal>;
  if (!o) return <Modal open onClose={onClose} title="Opportunité"><Spinner /></Modal>;
  const b = o.score_detail?.breakdown ?? {};
  const setStatus = (s: string, msg: string) => run("st", async () => { await api(`/opportunities/${o.id}/status`, { body: { status: s } }); reload(); }, msg);
  async function save() {
    if (!edit) return;
    const body = { name: o!.name, supplier_id: o!.supplier_id, purchase_price: o!.purchase_price, shipping_cost: o!.shipping_cost, extra_costs: o!.extra_costs, brand: o!.brand, category: o!.category, description: o!.description,
      image_url: o!.image_url, supplier_url: o!.supplier_url, availability: o!.availability, manual_resale_price: o!.manual_resale_price, demand: o!.demand, competition: o!.competition, trend: o!.trend, risk: o!.risk,
      compliance: o!.compliance, compliance_notes: o!.compliance_notes, notes: o!.notes, ...edit };
    await run("save", async () => { await api(`/opportunities/${o!.id}`, { method: "PUT", body }); reload(); }, "Enregistré et ré-analysé");
  }
  const lvl = (k: "demand" | "competition" | "risk" | "trend", label: string) => (
    <Field label={label}><Select value={(edit?.[k] ?? o[k]) ?? ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value || null })}><option value="">Inconnu</option>{["low", "medium", "high"].map((x) => <option key={x} value={x}>{LEVEL[x]}</option>)}</Select></Field>
  );
  return (
    <Modal open onClose={onClose} wide title={o.name} footer={<>
      <Button variant="secondary" loading={busy === "st"} onClick={() => setStatus("rejected", "Produit écarté")}>Écarter</Button>
      <Button variant="secondary" loading={busy === "st"} onClick={() => setStatus("validated", "Opportunité validée")}>Valider l'opportunité</Button>
      <Button loading={busy === "order"} onClick={() => run("order", async () => { const r = await api<{ id: number }>("/purchases/from-opportunities?quantity=1", { body: [o.id] }); router.push(`/achats/${r.id}`); })}>Créer une commande</Button>
    </>}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ScorePill score={o.score} /><Badge tone={statusTone(o.status)}>{OPP_STATUS[o.status]}</Badge><Badge>{AVAIL[o.availability]}</Badge><Badge tone={o.compliance === "forbidden" ? "red" : o.compliance === "ok" ? "green" : "amber"}>{COMPLIANCE[o.compliance]}</Badge>
        {o.supplier_url && <a href={o.supplier_url} target="_blank" rel="noreferrer noopener" className="ml-auto inline-flex items-center gap-1 text-sm text-accent underline"><ExternalLink className="size-3.5" />Lien fournisseur</a>}
      </div>
      <Tabs tabs={[{ key: "analyse", label: "Analyse" }, { key: "prix", label: "Prix observés", count: o.references?.length }, { key: "donnees", label: "Données & conformité" }, { key: "sim", label: "Simulateur" }]} value={tab} onChange={setTab} />
      <div className="pt-4">
        {tab === "analyse" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 text-sm">
              {[["Prix d'achat", eur(o.purchase_price)], ["Livraison fournisseur", eur(o.shipping_cost)], ["Coût total estimé", o.total_cost ? eur(o.total_cost) : "—"],
                ["Prix de revente retenu", o.resale_price !== null ? `${eur(o.resale_price)} (${o.resale_basis})` : "manquant"], ["Bénéfice estimé", o.est_profit !== null ? eur(o.est_profit) : "—"],
                ["Marge sur prix de vente", pct(o.est_margin_pct)], ["Niveau de confiance", o.score !== null ? `${o.confidence} %` : "—"]].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-line py-1.5"><span className="text-muted">{k}</span><span className="font-medium tabular-nums">{v}</span></div>))}
              {o.ai_resale_estimate !== null && <p className="rounded-md bg-warnsoft p-2 text-xs text-warn">Estimation IA du prix de revente : {eur(o.ai_resale_estimate)} — non vérifiée, non utilisée dans le score. Ajoutez des prix observés pour l'étayer.</p>}
            </div>
            <div>
              {o.score === null ? (
                <div className="rounded-lg border border-dashed border-line p-4 text-sm"><strong>Donnée manquante :</strong> {o.score_detail?.missing?.join(", ") || "prix de revente"}.<br />Renseignez un prix de revente estimé ou ajoutez des prix observés (onglet « Prix observés ») pour obtenir un score.</div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(b).map(([k, v]) => (
                    <div key={k}><div className="flex justify-between text-xs"><span>{BREAK[k]}</span><span className="tabular-nums text-muted">{v} / {MAXPTS[k]}</span></div>
                      <div className="h-1.5 rounded-full bg-surface2"><div className="h-1.5 rounded-full bg-accent transition-all" style={{ width: `${(v / MAXPTS[k]) * 100}%` }} /></div></div>))}
                  {!!o.score_detail?.missing?.length && <p className="text-xs text-muted">Données inconnues (note neutre) : {o.score_detail.missing.join(", ")}.</p>}
                </div>
              )}
              <div className="mt-4"><Button variant="secondary" size="sm" loading={busy === "ai"} onClick={() => run("ai", async () => { await api(`/opportunities/${o.id}/ai-enrich`, { body: {} }); reload(); }, "Enrichissement IA effectué (étiqueté « estimation »)")}><Sparkles className="size-4" />Compléter avec l'IA (demande, concurrence, risque)</Button>
                <p className="mt-1 text-xs text-muted">Utilise le budget IA. Résultat mis en cache. Les valeurs IA restent des estimations.</p></div>
              {o.score_detail?.ai && <p className="mt-2 text-xs text-muted">IA : {o.score_detail.ai.reasoning}</p>}
            </div>
          </div>
        )}
        {tab === "prix" && (
          <div className="space-y-3">
            <p className="text-sm text-muted">Saisissez des prix réellement observés (ventes terminées ou annonces comparables). Le prix de revente retenu est la <strong>médiane</strong> des ventes observées. Rien n'est collecté automatiquement sur Vinted.</p>
            <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); run("ref", async () => { await api(`/opportunities/${o.id}/references`, { body: { price: Number(ref.price.replace(",", ".")), kind: ref.kind, note: ref.note || null } }); setRef({ ...ref, price: "", note: "" }); reload(); }, "Prix ajouté"); }}>
              <Field label="Prix (€)"><Input required inputMode="decimal" className="!w-28" value={ref.price} onChange={(e) => setRef({ ...ref, price: e.target.value })} /></Field>
              <Field label="Type"><Select value={ref.kind} onChange={(e) => setRef({ ...ref, kind: e.target.value })}><option value="sold">Vendu</option><option value="listed">En vente</option></Select></Field>
              <Field label="Note"><Input value={ref.note} onChange={(e) => setRef({ ...ref, note: e.target.value })} placeholder="état, taille…" /></Field>
              <Button type="submit" loading={busy === "ref"}>Ajouter</Button>
            </form>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {o.references?.length ? o.references.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm"><Badge tone={r.kind === "sold" ? "green" : "neutral"}>{r.kind === "sold" ? "Vendu" : "En vente"}</Badge><span className="font-medium tabular-nums">{eur(r.price)}</span><span className="flex-1 truncate text-muted">{r.note}</span>
                  <button aria-label="Supprimer" className="text-muted hover:text-danger" onClick={() => run("ref", async () => { await api(`/opportunities/${o.id}/references/${r.id}`, { method: "DELETE" }); reload(); })}><Trash2 className="size-4" /></button></li>)) : <li className="px-3 py-4 text-sm text-muted">Aucun prix observé.</li>}
            </ul>
          </div>
        )}
        {tab === "donnees" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Prix de revente estimé (€)" hint="Utilisé seulement s'il n'y a aucun prix observé"><Input inputMode="decimal" defaultValue={o.manual_resale_price ?? ""} onChange={(e) => setEdit({ ...edit, manual_resale_price: e.target.value === "" ? null : Number(e.target.value.replace(",", ".")) })} /></Field>
            <Field label="Autres coûts (€)"><Input inputMode="decimal" defaultValue={o.extra_costs} onChange={(e) => setEdit({ ...edit, extra_costs: Number(e.target.value.replace(",", ".")) || 0 })} /></Field>
            {lvl("demand", "Demande")}{lvl("competition", "Concurrence")}{lvl("risk", "Risque commercial")}{lvl("trend", "Tendance")}
            <Field label="Compatibilité règles Vinted"><Select value={edit?.compliance ?? o.compliance} onChange={(e) => setEdit({ ...edit, compliance: e.target.value })}>{Object.entries(COMPLIANCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label="Disponibilité fournisseur"><Select value={edit?.availability ?? o.availability} onChange={(e) => setEdit({ ...edit, availability: e.target.value })}>{Object.entries(AVAIL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label="Notes de conformité" className="sm:col-span-2"><Textarea defaultValue={o.compliance_notes ?? ""} onChange={(e) => setEdit({ ...edit, compliance_notes: e.target.value })} /></Field>
            <Field label="Notes" className="sm:col-span-2"><Textarea defaultValue={o.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Button disabled={!edit} loading={busy === "save"} onClick={save}>Enregistrer et ré-analyser</Button></div>
          </div>
        )}
        {tab === "sim" && <SimulatorPanel initial={{ purchase_price: o.purchase_price, resale_price: o.resale_price ?? undefined }} />}
      </div>
    </Modal>
  );
}

function ProductForm({ suppliers, onClose, onSaved }: { suppliers: Supplier[]; onClose: () => void; onSaved: (id: number) => void }) {
  const [f, setF] = useState({ name: "", purchase_price: "", supplier_id: "", brand: "", category: "", shipping_cost: "0", manual_resale_price: "", supplier_url: "", image_url: "", availability: "in_stock" });
  const { busy, run } = useAction();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const n = (v: string) => Number(v.replace(",", "."));
  return (
    <Modal open onClose={onClose} title="Ajouter un produit à étudier">
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run("add", async () => {
        const r = await api<{ id: number }>("/opportunities", { body: { name: f.name, purchase_price: n(f.purchase_price), supplier_id: f.supplier_id ? Number(f.supplier_id) : null, brand: f.brand || null, category: f.category || null,
          shipping_cost: n(f.shipping_cost || "0"), manual_resale_price: f.manual_resale_price ? n(f.manual_resale_price) : null, supplier_url: f.supplier_url || null, image_url: f.image_url || null, availability: f.availability } });
        onSaved(r.id); }, "Produit ajouté"); }}>
        <Field label="Nom du produit" className="sm:col-span-2"><Input required value={f.name} onChange={set("name")} /></Field>
        <Field label="Prix d'achat (€)"><Input required inputMode="decimal" value={f.purchase_price} onChange={set("purchase_price")} /></Field>
        <Field label="Livraison fournisseur (€)"><Input inputMode="decimal" value={f.shipping_cost} onChange={set("shipping_cost")} /></Field>
        <Field label="Fournisseur"><Select value={f.supplier_id} onChange={set("supplier_id")}><option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label="Prix de revente estimé (€)" hint="Facultatif — sans lui, pas de score"><Input inputMode="decimal" value={f.manual_resale_price} onChange={set("manual_resale_price")} /></Field>
        <Field label="Marque"><Input value={f.brand} onChange={set("brand")} /></Field>
        <Field label="Catégorie"><Input value={f.category} onChange={set("category")} /></Field>
        <Field label="Lien fournisseur" className="sm:col-span-2"><Input type="url" value={f.supplier_url} onChange={set("supplier_url")} /></Field>
        <Field label="URL de la photo" className="sm:col-span-2"><Input type="url" value={f.image_url} onChange={set("image_url")} /></Field>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={onClose}>Annuler</Button><Button type="submit" loading={busy === "add"}>Ajouter</Button></div>
      </form>
    </Modal>
  );
}
