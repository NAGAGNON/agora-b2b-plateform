"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { dateFr, eur } from "@/lib/format";
import { Badge, Button, Card, CardHeader, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, StatCard, Textarea, useAction } from "@/components/ui";

type Home = {
  account: { username: string | null; profile_url: string | null; mode: string; api_status: string; api_base_url: string | null; notes: string | null };
  connector: { available: boolean; effective_mode: string; message: string; token_configured: boolean; supported_when_granted: string[] };
  listing_counts: Record<string, number>; items_to_publish: number;
  incidents: { id: number; kind: string; description: string; status: string; created_at: string }[];
  published: { id: number; title: string; price: number; vinted_url: string | null; item_name: string; published_at: string | null }[];
};
const KIND: Record<string, string> = { litige: "Litige", retour: "Retour", colis_perdu: "Colis perdu", annonce_refusee: "Annonce refusée", autre: "Autre" };

export default function Page() {
  const { data, error, loading, reload } = useApi<Home>("/vinted");
  const hist = useApi<{ id: number; at: string; summary: string; actor: string }[]>("/activity?limit=40");
  const [acc, setAcc] = useState({ username: "", profile_url: "", mode: "assisted", api_status: "not_granted", api_base_url: "", notes: "" });
  const [inc, setInc] = useState(false);
  const { busy, run } = useAction();
  useEffect(() => { if (data) setAcc({ username: data.account.username ?? "", profile_url: data.account.profile_url ?? "", mode: data.account.mode, api_status: data.account.api_status, api_base_url: data.account.api_base_url ?? "", notes: data.account.notes ?? "" }); }, [data]);
  if (error) return <ErrorBox onRetry={reload}>{error}</ErrorBox>;
  if (loading || !data) return <Spinner />;
  const c = data.listing_counts;
  return (
    <div className="space-y-5">
      <PageHeader title="Vinted" sub="Centre de pilotage de votre compte vendeur. Aucun robot ni script ne contrôle Vinted : la publication est manuelle (mode assisté) ou passe par l'API officielle si elle vous est accordée." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Annonces publiées" value={c.published ?? 0} /><StatCard label="Prêtes à publier" value={c.ready ?? 0} /><StatCard label="Brouillons" value={c.draft ?? 0} />
        <StatCard label="Articles reçus à publier" value={data.items_to_publish} sub={<Link href="/stock?status=received" className="underline">voir le stock</Link>} />
      </div>
      <Card className={data.connector.available ? "border-accent/40" : "border-warn/40"}>
        <div className="flex flex-wrap items-start gap-3 p-4">
          <ShieldAlert className={`mt-0.5 size-5 ${data.connector.available ? "text-accent" : "text-warn"}`} />
          <div className="min-w-0 flex-1 text-sm"><div className="font-semibold">Mode actif : {data.connector.effective_mode === "api" ? "API officielle" : "Assisté"}</div><p className="mt-0.5 text-muted">{data.connector.message}</p>
            <p className="mt-1 text-xs text-muted">Quand l'accès à Vinted Pro Integrations sera accordé : {data.connector.supported_when_granted.join(", ").toLowerCase()}. Le jeton se saisit dans Paramètres → Clés API (« Jeton API Vinted »).</p></div>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Compte vendeur" />
          <form className="grid gap-3 p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run("acc", async () => { await api("/vinted/account", { method: "PUT", body: { ...acc, username: acc.username || null, profile_url: acc.profile_url || null, api_base_url: acc.api_base_url || null, notes: acc.notes || null } }); reload(); }, "Compte enregistré"); }}>
            <Field label="Nom d'utilisateur"><Input value={acc.username} onChange={(e) => setAcc({ ...acc, username: e.target.value })} /></Field>
            <Field label="Lien du profil"><Input type="url" value={acc.profile_url} onChange={(e) => setAcc({ ...acc, profile_url: e.target.value })} /></Field>
            <Field label="Statut de l'accès API"><Select value={acc.api_status} onChange={(e) => setAcc({ ...acc, api_status: e.target.value })}><option value="not_granted">Non accordé</option><option value="requested">Demandé</option><option value="granted">Accordé par Vinted</option></Select></Field>
            <Field label="Mode souhaité"><Select value={acc.mode} onChange={(e) => setAcc({ ...acc, mode: e.target.value })}><option value="assisted">Assisté</option><option value="api">API (si accordée)</option></Select></Field>
            <Field label="URL de base de l'API (fournie par Vinted)" className="sm:col-span-2"><Input type="url" value={acc.api_base_url} onChange={(e) => setAcc({ ...acc, api_base_url: e.target.value })} /></Field>
            <Field label="Notes" className="sm:col-span-2"><Textarea value={acc.notes} onChange={(e) => setAcc({ ...acc, notes: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Button type="submit" loading={busy === "acc"}>Enregistrer</Button></div>
          </form>
        </Card>
        <Card>
          <CardHeader title="Incidents" sub="Litiges, retours, colis perdus, annonces refusées" action={<Button size="sm" onClick={() => setInc(true)}>Déclarer</Button>} />
          {data.incidents.length === 0 ? <Empty title="Aucun incident" /> : <ul className="max-h-80 divide-y divide-line overflow-y-auto">{data.incidents.map((i) => (
            <li key={i.id} className="flex items-start gap-3 px-4 py-2.5 text-sm"><Badge tone={i.status === "open" ? "red" : "green"}>{KIND[i.kind]}</Badge><div className="min-w-0 flex-1"><div>{i.description}</div><div className="text-xs text-muted">{dateFr(i.created_at)}</div></div>
              {i.status === "open" && <Button size="sm" variant="secondary" onClick={() => run("res", async () => { await api(`/vinted/incidents/${i.id}/resolve`, { body: {} }); reload(); }, "Incident résolu")}>Résolu</Button>}</li>))}</ul>}
        </Card>
      </div>
      <Card>
        <CardHeader title="Annonces publiées" sub="Suivi des liens enregistrés" />
        {data.published.length === 0 ? <Empty title="Aucune annonce publiée">Préparez une annonce, publiez-la sur Vinted, puis collez son lien pour la suivre ici.</Empty> : (
          <ul className="divide-y divide-line">{data.published.map((p) => <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"><Link href={`/annonces/${p.id}`} className="truncate text-accent underline">{p.title}</Link>
            <span className="flex shrink-0 items-center gap-3"><span className="tabular-nums">{eur(p.price)}</span><span className="text-xs text-muted">{dateFr(p.published_at)}</span>{p.vinted_url && <a href={p.vinted_url} target="_blank" rel="noreferrer noopener" aria-label="Ouvrir sur Vinted"><ExternalLink className="size-4 text-muted" /></a>}</span></li>)}</ul>)}
      </Card>
      <Card>
        <CardHeader title="Historique des opérations" />
        <ul className="max-h-72 divide-y divide-line overflow-y-auto text-sm">{hist.data?.map((h) => <li key={h.id} className="flex justify-between gap-3 px-4 py-2"><span>{h.summary}</span><span className="shrink-0 text-xs text-muted">{dateFr(h.at)} · {h.actor}</span></li>)}{!hist.data?.length && <li className="p-4 text-muted">Aucune opération.</li>}</ul>
      </Card>
      {inc && <IncidentModal onClose={() => setInc(false)} onSaved={() => { setInc(false); reload(); }} />}
    </div>
  );
}

function IncidentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ kind: "litige", description: "", sale_id: "" });
  const { busy, run } = useAction();
  return (
    <Modal open onClose={onClose} title="Déclarer un incident">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run("i", async () => { await api("/vinted/incidents", { body: { kind: f.kind, description: f.description, sale_id: f.sale_id ? Number(f.sale_id) : null } }); onSaved(); }, "Incident enregistré"); }}>
        <Field label="Type"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Description"><Textarea required minLength={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="N° de vente concernée (optionnel)"><Input type="number" value={f.sale_id} onChange={(e) => setF({ ...f, sale_id: e.target.value })} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Annuler</Button><Button type="submit" loading={busy === "i"}>Enregistrer</Button></div>
      </form>
    </Modal>
  );
}
