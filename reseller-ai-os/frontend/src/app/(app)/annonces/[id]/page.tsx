"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, Download, ExternalLink, XCircle } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { eur } from "@/lib/format";
import { LISTING_STATUS } from "@/lib/labels";
import { Badge, Button, Card, CardHeader, ErrorBox, Field, Input, PageHeader, Spinner, Textarea, useAction, useToast } from "@/components/ui";

type Listing = { id: number; title: string; description: string; price: number; keywords: string[]; tips: string[]; status: string; vinted_url: string | null; vinted_category: string | null; item_id: number; ai_generated: boolean;
  compliance: { ok: boolean; errors: string[]; warnings: string[] };
  pack: { open_url: string; steps: string[]; photos: { id: number; url: string; is_real_photo: boolean; kind: string }[] };
  item: { id: number; name: string; total_cost: number; sku: string } };

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: l, error, reload } = useApi<Listing>(`/listings/${id}`);
  const [f, setF] = useState({ title: "", description: "", price: "", vinted_category: "" });
  const [url, setUrl] = useState("");
  const { busy, run } = useAction();
  const toast = useToast();
  useEffect(() => { if (l) setF({ title: l.title, description: l.description, price: String(l.price), vinted_category: l.vinted_category ?? "" }); }, [l]);
  if (error) return <ErrorBox onRetry={reload}>{error}</ErrorBox>;
  if (!l) return <Spinner />;
  const locked = ["published", "sold", "removed"].includes(l.status);
  const dirty = f.title !== l.title || f.description !== l.description || Number(f.price.replace(",", ".")) !== l.price || (f.vinted_category || "") !== (l.vinted_category ?? "");
  const copy = async (t: string, what: string) => { try { await navigator.clipboard.writeText(t); toast.ok(`${what} copié`); } catch { toast.err("Copie impossible : sélectionnez le texte manuellement."); } };
  const save = () => run("save", async () => { await api(`/listings/${l.id}`, { method: "PUT", body: { title: f.title, description: f.description, price: Number(f.price.replace(",", ".")), vinted_category: f.vinted_category || null, keywords: l.keywords } }); reload(); }, "Annonce enregistrée");
  const margin = Number(f.price.replace(",", ".")) - l.item.total_cost;
  return (
    <div>
      <Link href="/annonces" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" />Annonces</Link>
      <PageHeader title="Préparation de l'annonce" sub={`${l.item.name} · ${l.item.sku}`} actions={<Badge tone={l.status === "published" ? "green" : "blue"} className="px-3 py-1 text-sm">{LISTING_STATUS[l.status]}</Badge>} />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="space-y-3 p-4">
          <Field label={`Titre (${f.title.length}/100)`}><div className="flex gap-2"><Input disabled={locked} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /><Button variant="secondary" size="sm" onClick={() => copy(f.title, "Titre")}><Copy className="size-3.5" /></Button></div></Field>
          <Field label={`Description (${f.description.length}/2000)`}><Textarea disabled={locked} className="min-h-56" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Prix (€)" hint={`Bénéfice brut vs coût complet : ${eur(margin)}`}><div className="flex gap-2"><Input disabled={locked} inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /><Button variant="secondary" size="sm" onClick={() => copy(f.price, "Prix")}><Copy className="size-3.5" /></Button></div></Field>
            <Field label="Catégorie Vinted (à choisir sur Vinted)"><Input disabled={locked} value={f.vinted_category} onChange={(e) => setF({ ...f, vinted_category: e.target.value })} /></Field>
          </div>
          <div className="flex flex-wrap gap-1">{l.keywords.map((k) => <Badge key={k}>{k}</Badge>)}</div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="secondary" onClick={() => copy(f.description, "Description")}><Copy className="size-4" />Copier la description</Button>
            {!locked && <Button disabled={!dirty} loading={busy === "save"} onClick={save}>Enregistrer</Button>}
            {!locked && <Button variant="secondary" disabled={dirty || !l.compliance.ok || l.status === "ready"} loading={busy === "rdy"} onClick={() => run("rdy", async () => { await api(`/listings/${l.id}/ready`, { body: {} }); reload(); }, "Annonce marquée prête")}>Marquer prête</Button>}
          </div>
          {l.tips.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted">{l.tips.map((t) => <li key={t}>{t}</li>)}</ul>}
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Contrôle de conformité Vinted" />
            <ul className="divide-y divide-line text-sm">
              {l.compliance.errors.map((e) => <li key={e} className="flex gap-2 px-4 py-2 text-danger"><XCircle className="mt-0.5 size-4 shrink-0" />{e}</li>)}
              {l.compliance.warnings.map((e) => <li key={e} className="flex gap-2 px-4 py-2 text-warn"><XCircle className="mt-0.5 size-4 shrink-0" />{e}</li>)}
              {l.compliance.ok && <li className="flex gap-2 px-4 py-2 text-accent"><CheckCircle2 className="mt-0.5 size-4" />Aucun blocage détecté</li>}
            </ul>
            {!l.compliance.ok && <div className="p-3 pt-0"><Link href={`/stock/${l.item_id}`} className="text-xs text-accent underline">Ajouter/modifier les photos de l'article</Link></div>}
          </Card>
          <Card>
            <CardHeader title="Publication (mode assisté)" sub="Vous publiez vous-même sur Vinted — aucun robot." />
            <div className="space-y-3 p-4 text-sm">
              <div className="grid grid-cols-4 gap-1.5">{l.pack.photos.map((p) => (  <img key={p.id} src={p.url} alt="" className={`aspect-square rounded border object-cover ${p.is_real_photo ? "border-line" : "border-warn"}`} />))}</div>
              {l.pack.photos.length > 0 && <a href={`/api/inventory/${l.item_id}/photos.zip`} className="inline-flex items-center gap-1 text-xs text-accent underline"><Download className="size-3.5" />Télécharger les photos (ZIP)</a>}
              <ol className="list-decimal space-y-0.5 pl-5 text-xs text-muted">{l.pack.steps.map((s) => <li key={s}>{s}</li>)}</ol>
              <a href={l.pack.open_url} target="_blank" rel="noreferrer noopener" className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface2"><ExternalLink className="size-4" />Ouvrir Vinted (nouvelle annonce)</a>
              {l.status === "published" ? <div className="rounded-lg bg-accentsoft p-2 text-xs text-accent">Publiée : <a className="underline" href={l.vinted_url ?? "#"} target="_blank" rel="noreferrer noopener">{l.vinted_url}</a></div> : !locked && (
                <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run("pub", async () => { await api(`/listings/${l.id}/published`, { body: { url } }); reload(); }, "Publication enregistrée"); }}>
                  <Field label="Lien de l'annonce publiée"><Input required type="url" placeholder="https://www.vinted.fr/items/…" value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
                  <Button type="submit" className="w-full" loading={busy === "pub"} disabled={dirty}>J'ai publié : enregistrer le lien</Button>
                  {dirty && <p className="text-xs text-muted">Enregistrez d'abord vos modifications.</p>}
                </form>)}
              {l.status === "published" && <Button variant="secondary" className="w-full" loading={busy === "rm"} onClick={() => confirm("Marquer l'annonce comme retirée ?") && run("rm", async () => { await api(`/listings/${l.id}/remove`, { body: {} }); reload(); }, "Annonce retirée")}>Marquer comme retirée</Button>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
