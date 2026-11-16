"use client";
import Link from "next/link";
import { useState } from "react";
import { Tag } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { eur } from "@/lib/format";
import { LISTING_STATUS } from "@/lib/labels";
import { Badge, Button, Card, Empty, ErrorBox, PageHeader, Spinner, TableWrap, Tabs, tdCls, thCls, useAction } from "@/components/ui";

type L = { id: number; title: string; price: number; status: string; item_name: string; sku: string; cover: string | null; vinted_url: string | null; ai_generated: boolean; compliance: { ok: boolean; errors: string[]; warnings: string[] } };
type Item = { id: number; name: string; status: string };

export default function Page() {
  const [status, setStatus] = useState("");
  const { data, error, loading, reload } = useApi<L[]>(`/listings${status ? `?status=${status}` : ""}`);
  const toPub = useApi<{ items: Item[] }>("/inventory?in_stock=true&limit=500");
  const { busy, run } = useAction();
  const withListing = new Set(data?.filter((l) => ["draft", "ready", "published"].includes(l.status)).map((l) => l.sku));
  void withListing;
  const received = (toPub.data?.items ?? []).filter((i) => ["received", "to_photograph", "ready"].includes(i.status));
  return (
    <div>
      <PageHeader title="Annonces" sub="Générées sans IA (titre, description, prix, mots-clés) et contrôlées selon les règles Vinted ; l'IA peut reformuler à la demande, dans votre budget."
        actions={<Button variant="secondary" loading={busy === "all"} onClick={() => run("all", async () => { const r = await api<{ result?: { drafts_created: number } }>("/automation/jobs/listing_prepare/run", { body: {} }); reload(); toPub.reload(); return r; }, "Brouillons préparés pour les articles reçus")}>Préparer les articles reçus</Button>} />
      {received.length > 0 && <Card className="mb-4 border-warn/30 bg-warnsoft p-3 text-sm text-warn">{received.length} article(s) reçu(s) en attente de publication : <Link className="underline" href="/stock?status=received">voir le stock</Link></Card>}
      <Card>
        <Tabs value={status} onChange={setStatus} tabs={[{ key: "", label: "Toutes" }, ...Object.entries(LISTING_STATUS).map(([k, v]) => ({ key: k, label: v }))]} />
        {error && <div className="p-3"><ErrorBox onRetry={reload}>{error}</ErrorBox></div>}
        {loading && !data ? <Spinner /> : data?.length === 0 ? <Empty title="Aucune annonce" icon={<Tag className="size-6" />}>Ouvrez un article du stock puis « Préparer l'annonce ».</Empty> : (
          <TableWrap><thead><tr className="border-b border-line">{["", "Titre", "Prix", "Statut", "Conformité"].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
            <tbody>{data?.map((l) => (
              <tr key={l.id} className="border-b border-line last:border-0 hover:bg-surface2">
                <td className={tdCls}>{l.cover ?   <img src={l.cover} alt="" className="size-10 rounded-md border border-line object-cover" loading="lazy" /> : <div className="size-10 rounded-md bg-surface2" />}</td>
                <td className={tdCls}><Link href={`/annonces/${l.id}`} className="font-medium text-accent underline">{l.title}</Link><div className="text-xs text-muted">{l.sku}{l.ai_generated && " · reformulée par IA"}</div></td>
                <td className={`${tdCls} tabular-nums`}>{eur(l.price)}</td><td className={tdCls}><Badge tone={l.status === "published" ? "green" : l.status === "ready" ? "blue" : "neutral"}>{LISTING_STATUS[l.status]}</Badge></td>
                <td className={tdCls}>{["sold", "removed"].includes(l.status) ? "—" : l.compliance.ok ? <Badge tone="green">Conforme</Badge> : <Badge tone="red" className="max-w-[260px] truncate" >{l.compliance.errors[0]}</Badge>}</td></tr>))}</tbody></TableWrap>
        )}
      </Card>
    </div>
  );
}
