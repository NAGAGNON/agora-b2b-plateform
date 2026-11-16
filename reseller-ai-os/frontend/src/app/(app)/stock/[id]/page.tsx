"use client";
import Link from "next/link";
import { use, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, ImagePlus, Trash2, Wand2 } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { dateTimeFr, eur } from "@/lib/format";
import { CONDITION, LISTING_STATUS } from "@/lib/labels";
import { Badge, Button, Card, CardHeader, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, useAction } from "@/components/ui";
import type { Item } from "../page";

type Photo = { id: number; url: string; kind: string; is_real_photo: boolean; label: string | null; position: number };
type Detail = Item & { photos: Photo[]; description: string | null; size: string | null; color: string | null; purchase_price: number; unit_cost: number; extra_cost: number; next_statuses: string[];
  listings: { id: number; title: string; status: string; price: number; vinted_url: string | null }[]; sale: { id: number; sale_price: number; status: string } | null;
  photo_capabilities: Record<string, boolean>; order_id: number | null; purchase_date: string | null };
const STATUS_LABEL: Record<string, string> = { ordered: "Commandé", in_transit: "En transit", received: "Reçu", to_photograph: "À photographier", ready: "Prêt à publier", published: "Publié", reserved: "Réservé", sold: "Vendu", shipped: "Expédié", done: "Terminé", returned: "Retourné" };

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: i, error, reload } = useApi<Detail>(`/inventory/${id}`);
  const { busy, run } = useAction();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editPhoto, setEditPhoto] = useState<Photo | null>(null);
  const [sell, setSell] = useState(false);
  if (error) return <ErrorBox onRetry={reload}>{error}</ErrorBox>;
  if (!i) return <Spinner />;
  const upload = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) { const fd = new FormData(); fd.append("file", f); await run("up", () => api(`/inventory/${i.id}/photos`, { form: fd })); }
    reload();
  };
  const move = (pid: number, dir: -1 | 1) => {
    const ids = i.photos.map((p) => p.id); const k = ids.indexOf(pid); const t = k + dir;
    if (t < 0 || t >= ids.length) return;
    [ids[k], ids[t]] = [ids[t], ids[k]];
    run("re", async () => { await api(`/inventory/${i.id}/photos/reorder`, { body: ids }); reload(); });
  };
  const draft = (ai: boolean) => run("lst", async () => { const l = await api<{ id: number }>(`/inventory/${i.id}/listing?improve_with_ai=${ai}`, { body: {} }); router.push(`/annonces/${l.id}`); });
  const sellable = ["received", "to_photograph", "ready", "published", "reserved"].includes(i.status);
  return (
    <div>
      <Link href="/stock" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" />Stock</Link>
      <PageHeader title={i.name} sub={`${i.sku}${i.supplier_name ? ` · ${i.supplier_name}` : ""}`} actions={<Badge tone={i.in_stock ? "green" : "neutral"} className="px-3 py-1 text-sm">{i.status_label}{i.in_stock ? " · en stock" : ""}</Badge>} />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Photos" sub="Photographies réelles de l'article détenu. Les visuels de présentation sont identifiés comme tels et ne peuvent pas servir de couverture." action={<div className="flex gap-2">
              {i.photos.length > 0 && <a href={`/api/inventory/${i.id}/photos.zip`} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs hover:bg-surface2"><Download className="size-3.5" />ZIP</a>}
              <Button size="sm" loading={busy === "up"} onClick={() => fileRef.current?.click()}><ImagePlus className="size-4" />Ajouter</Button></div>} />
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
              {i.photos.map((p, k) => (
                <div key={p.id} className="group relative overflow-hidden rounded-lg border border-line">
                  { }
                  <img src={p.url} alt={p.label ?? `Photo ${k + 1}`} className="aspect-square w-full object-cover" loading="lazy" />
                  <div className="absolute left-1.5 top-1.5 flex gap-1">{k === 0 && <Badge tone="green">Couverture</Badge>}{!p.is_real_photo && <Badge tone="amber">Visuel de présentation</Badge>}{p.kind === "edited" && <Badge>Retouchée</Badge>}</div>
                  <div className="flex items-center justify-between gap-1 bg-surface px-1.5 py-1 text-xs">
                    <span className="flex gap-1"><button className="px-1 hover:text-accent" disabled={k === 0} onClick={() => move(p.id, -1)} aria-label="Avancer">←</button><button className="px-1 hover:text-accent" disabled={k === i.photos.length - 1} onClick={() => move(p.id, 1)} aria-label="Reculer">→</button></span>
                    <span className="flex gap-1"><button className="px-1 hover:text-accent" onClick={() => setEditPhoto(p)} aria-label="Retoucher"><Wand2 className="size-3.5" /></button>
                      <button className="px-1 hover:text-danger" aria-label="Supprimer la photo" onClick={() => confirm("Supprimer cette photo ?") && run("del", async () => { await api(`/photos/${p.id}`, { method: "DELETE" }); reload(); })}><Trash2 className="size-3.5" /></button></span>
                  </div>
                </div>))}
              {i.photos.length === 0 && <div className="col-span-full rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">Aucune photo. Ajoutez au moins une photo réelle pour pouvoir préparer l'annonce.</div>}
            </div>
            <p className="px-4 pb-3 text-xs text-muted">Outils : recadrage, rotation, luminosité, contraste, couleur, amélioration auto. {i.photo_capabilities.background_removal ? "" : "Détourage d'arrière-plan : non disponible (aucun service configuré) — photographiez sur fond uni."}</p>
          </Card>
          <Card>
            <CardHeader title="Annonces" action={<div className="flex gap-2"><Button size="sm" variant="secondary" disabled={!i.in_stock} loading={busy === "lst"} onClick={() => draft(false)}>Préparer l'annonce</Button><Button size="sm" variant="secondary" disabled={!i.in_stock} loading={busy === "lst"} onClick={() => draft(true)}>Avec l'IA</Button></div>} />
            <ul className="divide-y divide-line">
              {i.listings.length === 0 && <li className="p-4 text-sm text-muted">{i.in_stock ? "Aucune annonce." : "Article non disponible en stock : annonce impossible."}</li>}
              {i.listings.map((l) => <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"><Link href={`/annonces/${l.id}`} className="truncate text-accent underline">{l.title}</Link><span className="flex items-center gap-2 whitespace-nowrap"><span className="tabular-nums">{eur(l.price)}</span><Badge>{LISTING_STATUS[l.status]}</Badge></span></li>)}
            </ul>
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="p-4 text-sm">
            <div className="mb-2 font-semibold">Coûts & rentabilité</div>
            {[["Prix d'achat", eur(i.purchase_price)], ["Coût complet (frais répartis)", eur(i.unit_cost)], ["Frais propres", eur(i.extra_cost)], ["Coût total", eur(i.total_cost)],
              ["Prix de vente", i.listing_price ? eur(i.listing_price) : i.planned_price ? `${eur(i.planned_price)} (prévu)` : "—"], ["Bénéfice potentiel", i.potential_profit !== null ? eur(i.potential_profit) : "—"]].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-line py-1.5 last:border-0"><span className="text-muted">{k}</span><span className="font-medium tabular-nums">{v}</span></div>))}
          </Card>
          <Card className="p-4 text-sm">
            <div className="mb-2 font-semibold">Fiche</div>
            {[["État", CONDITION[i.condition]], ["Catégorie", i.category], ["Marque", i.brand], ["Taille", i.size], ["Couleur", i.color], ["Emplacement", i.location], ["Date d'achat", dateTimeFr(i.purchase_date)], ["Réception", dateTimeFr(i.received_at)]].map(([k, v]) => (
              <div key={k as string} className="flex justify-between py-1"><span className="text-muted">{k}</span><span>{v || "—"}</span></div>))}
            {i.order_id && <Link href={`/achats/${i.order_id}`} className="mt-1 inline-block text-xs text-accent underline">Commande #{i.order_id}</Link>}
          </Card>
          <Card className="p-4">
            <div className="mb-2 text-sm font-semibold">Statut</div>
            <Select value="" onChange={(e) => e.target.value && run("st", async () => { await api(`/inventory/${i.id}/status`, { body: { status: e.target.value } }); reload(); }, "Statut mis à jour")} aria-label="Changer le statut">
              <option value="">Changer le statut…</option>{i.next_statuses.filter((s) => !["sold", "shipped", "done"].includes(s)).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</Select>
            {i.sale ? <Link href={`/ventes/${i.sale.id}`} className="mt-3 block text-sm text-accent underline">Voir la vente ({eur(i.sale.sale_price)})</Link>
              : <Button className="mt-3 w-full" disabled={!sellable} onClick={() => setSell(true)}>Enregistrer une vente</Button>}
            {!sellable && !i.sale && <p className="mt-1 text-xs text-muted">Indisponible à la vente (non reçu ou déjà vendu).</p>}
          </Card>
        </div>
      </div>
      {editPhoto && <EditPhoto photo={editPhoto} onClose={() => { setEditPhoto(null); reload(); }} />}
      {sell && <SellModal item={i} onClose={() => setSell(false)} onSaved={(sid) => router.push(`/ventes/${sid}`)} />}
    </div>
  );
}

function EditPhoto({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const [v, setV] = useState({ rotate: 0, brightness: 1, contrast: 1, color: 1, auto: false, crop: [0, 0, 1, 1] as number[] });
  const { busy, run } = useAction();
  const filter = `brightness(${v.brightness}) contrast(${v.contrast}) saturate(${v.color})`;
  const slider = (k: "brightness" | "contrast" | "color", label: string) => (
    <label className="block text-xs"><span className="mb-1 flex justify-between"><span>{label}</span><span className="tabular-nums text-muted">{v[k].toFixed(2)}</span></span><input type="range" min={0.5} max={1.8} step={0.05} value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} className="w-full accent-[var(--accent)]" /></label>);
  const cropped = v.crop.join() !== "0,0,1,1";
  return (
    <Modal open wide onClose={onClose} title="Retoucher la photo" footer={<>
      <Button variant="ghost" onClick={onClose}>Fermer</Button>
      <Button variant="secondary" loading={busy === "pres"} onClick={() => run("pres", async () => { await api(`/photos/${photo.id}/presentation`, { body: {} }); onClose(); }, "Visuel de présentation créé (étiqueté)")}>Créer un visuel de présentation</Button>
      <Button loading={busy === "ed"} onClick={() => run("ed", async () => { await api(`/photos/${photo.id}/edit`, { body: { rotate: v.rotate, brightness: v.brightness, contrast: v.contrast, color: v.color, auto: v.auto, crop: cropped ? v.crop : null } }); onClose(); }, "Copie retouchée enregistrée")}>Enregistrer une copie retouchée</Button></>}>
      <div className="grid gap-4 md:grid-cols-[1fr_240px]">
        <div className="grid place-items-center overflow-hidden rounded-lg bg-surface2 p-2">
          { }
          <img src={photo.url} alt="Aperçu" style={{ filter, transform: `rotate(${v.rotate}deg)`, clipPath: `inset(${v.crop[1] * 100}% ${(1 - v.crop[2]) * 100}% ${(1 - v.crop[3]) * 100}% ${v.crop[0] * 100}%)` }} className="max-h-[50vh] transition" />
        </div>
        <div className="space-y-3">
          {slider("brightness", "Luminosité")}{slider("contrast", "Contraste")}{slider("color", "Couleurs")}
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={v.auto} onChange={(e) => setV({ ...v, auto: e.target.checked })} />Amélioration automatique</label>
          <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => setV({ ...v, rotate: (v.rotate + 270) % 360 })}>↺ 90°</Button><Button size="sm" variant="secondary" onClick={() => setV({ ...v, rotate: (v.rotate + 90) % 360 })}>↻ 90°</Button></div>
          <div className="text-xs">Recadrage (%)<div className="mt-1 grid grid-cols-2 gap-1">{["Gauche", "Haut", "Droite", "Bas"].map((l, k) => (
            <label key={l} className="flex items-center gap-1">{l}<input type="number" min={0} max={100} className="w-full rounded border border-line bg-surface px-1 py-0.5" value={Math.round(v.crop[k] * 100)}
              onChange={(e) => { const c = [...v.crop]; c[k] = Math.min(1, Math.max(0, Number(e.target.value) / 100)); setV({ ...v, crop: c }); }} /></label>))}</div></div>
          <p className="text-xs text-muted">L'original est conservé. Le visuel de présentation porte un bandeau explicite et n'est jamais compté comme photo réelle.</p>
        </div>
      </div>
    </Modal>
  );
}

function SellModal({ item, onClose, onSaved }: { item: Detail; onClose: () => void; onSaved: (id: number) => void }) {
  const [f, setF] = useState({ sale_price: String(item.listing_price ?? item.planned_price ?? ""), order_ref: "", shipping_cost: "0", paid: false });
  const { busy, run } = useAction();
  return (
    <Modal open onClose={onClose} title={`Vente — ${item.name}`}>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run("s", async () => { const s = await api<{ id: number }>("/sales", { body: { item_id: item.id, sale_price: Number(f.sale_price.replace(",", ".")), order_ref: f.order_ref || null, shipping_cost: Number(f.shipping_cost.replace(",", ".")) || 0, payment_confirmed: f.paid } }); onSaved(s.id); }, "Vente enregistrée"); }}>
        <Field label="Prix de vente (€)"><Input required inputMode="decimal" value={f.sale_price} onChange={(e) => setF({ ...f, sale_price: e.target.value })} /></Field>
        <Field label="Référence de commande Vinted"><Input value={f.order_ref} onChange={(e) => setF({ ...f, order_ref: e.target.value })} /></Field>
        <Field label="Frais d'expédition à votre charge (€)" hint="0 si l'acheteur paie le port"><Input inputMode="decimal" value={f.shipping_cost} onChange={(e) => setF({ ...f, shipping_cost: e.target.value })} /></Field>
        <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={f.paid} onChange={(e) => setF({ ...f, paid: e.target.checked })} />Paiement déjà confirmé par Vinted</label>
        <p className="text-xs text-muted sm:col-span-2">Cette action retire l'article du stock, enregistre le CA et le bénéfice prévisionnel, crée la tâche d'expédition et envoie une notification.</p>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={onClose}>Annuler</Button><Button type="submit" loading={busy === "s"}>Enregistrer la vente</Button></div>
      </form>
    </Modal>
  );
}
