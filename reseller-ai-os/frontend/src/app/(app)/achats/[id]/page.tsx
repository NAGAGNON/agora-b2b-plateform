"use client";
import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { dateTimeFr, eur } from "@/lib/format";
import { Badge, Button, Card, CardHeader, ErrorBox, Field, Input, PageHeader, Spinner, TableWrap, tdCls, thCls, useAction } from "@/components/ui";

type Line = { id: number; name: string; unit_price: number; quantity: number; line_total: number; supplier_url: string | null; planned_resale_price: number | null };
type PO = { id: number; reference: string | null; supplier_name: string | null; status: string; status_label: string; shipping_cost: number; other_fees: number; lines_total: number; total: number; lines: Line[]; tracking_number: string | null;
  supplier_url: string | null; notes: string | null; approved_at: string | null; ordered_at: string | null; shipped_at: string | null; received_at: string | null; next_statuses: string[]; editable: boolean; auto_prepared: boolean; budget_problems: string[]; documents: { id: number; filename: string }[] };

const ACTIONS: Record<string, { label: string; help: string; variant?: "primary" | "secondary" | "danger" }> = {
  recommended: { label: "Marquer « recommandé »", help: "", variant: "secondary" },
  awaiting_validation: { label: "Soumettre à validation", help: "", variant: "secondary" },
  validated: { label: "Je valide cet achat", help: "Votre accord explicite. Aucun paiement n'est effectué par l'application." },
  ordered: { label: "J'ai passé la commande", help: "Enregistre la dépense et crée les articles « commandés » dans le stock." },
  shipped: { label: "Expédiée par le fournisseur", help: "", variant: "secondary" },
  received: { label: "Réceptionner la commande", help: "Les articles passent en stock (reçu)." },
  cancelled: { label: "Annuler", help: "", variant: "danger" },
  to_study: { label: "Remettre « à étudier »", help: "", variant: "secondary" },
};

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: o, error, reload } = useApi<PO>(`/purchases/${id}`);
  const { busy, run } = useAction();
  const [tracking, setTracking] = useState("");
  const [ref, setRef] = useState("");
  if (error) return <ErrorBox onRetry={reload}>{error}</ErrorBox>;
  if (!o) return <Spinner />;
  const go = (status: string, extra: Record<string, unknown> = {}) => run(status, async () => { await api(`/purchases/${o.id}/status`, { body: { status, ...extra } }); reload(); }, `Statut : ${ACTIONS[status]?.label ?? status}`);
  const timeline: [string, string | null][] = [["Validée", o.approved_at], ["Commandée", o.ordered_at], ["Expédiée par le fournisseur", o.shipped_at], ["Reçue", o.received_at]];
  return (
    <div>
      <Link href="/achats" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" />Achats</Link>
      <PageHeader title={`Commande #${o.id}`} sub={[o.supplier_name, o.reference].filter(Boolean).join(" · ") || undefined} actions={<Badge tone="blue" className="px-3 py-1 text-sm">{o.status_label}</Badge>} />
      {o.auto_prepared && o.status === "awaiting_validation" && <Card className="mb-4 border-accent/30 bg-accentsoft p-3 text-sm">Panier préparé automatiquement par l'agent dans votre budget. Vérifiez-le, puis validez ou annulez.</Card>}
      {o.budget_problems.length > 0 && <div className="mb-4"><ErrorBox>Budget : {o.budget_problems.join(" ; ")}. La validation sera refusée sauf si vous la forcez explicitement.</ErrorBox></div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader title="Lignes" />
          <TableWrap><thead><tr className="border-b border-line">{["Produit", "Prix unit.", "Qté", "Total", "Revente prévue"].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
            <tbody>{o.lines.map((l) => <tr key={l.id} className="border-b border-line"><td className={tdCls}>{l.name}{l.supplier_url && <a href={l.supplier_url} target="_blank" rel="noreferrer noopener" aria-label="Lien fournisseur" className="ml-2 inline-block text-muted"><ExternalLink className="inline size-3.5" /></a>}</td>
              <td className={`${tdCls} tabular-nums`}>{eur(l.unit_price)}</td><td className={tdCls}>{l.quantity}</td><td className={`${tdCls} tabular-nums`}>{eur(l.line_total)}</td><td className={`${tdCls} tabular-nums`}>{l.planned_resale_price ? eur(l.planned_resale_price) : "—"}</td></tr>)}</tbody></TableWrap>
          <div className="space-y-1 border-t border-line p-4 text-sm">
            <div className="flex justify-between"><span className="text-muted">Sous-total</span><span className="tabular-nums">{eur(o.lines_total)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Livraison fournisseur</span><span className="tabular-nums">{eur(o.shipping_cost)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Autres frais</span><span className="tabular-nums">{eur(o.other_fees)}</span></div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><span>Coût total</span><span className="tabular-nums">{eur(o.total)}</span></div>
            <p className="pt-1 text-xs text-muted">Les frais de commande sont répartis sur les articles proportionnellement à leur valeur (au centime près) pour obtenir le coût complet de chaque article.</p>
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 text-sm font-semibold">Actions</div>
            <div className="space-y-2">
              {o.status === "ordered" && <div className="grid gap-2"><Field label="Référence de commande"><Input value={ref} placeholder={o.reference ?? ""} onChange={(e) => setRef(e.target.value)} /></Field></div>}
              {(o.status === "ordered" || o.status === "validated") && <Field label="N° de suivi fournisseur"><Input value={tracking} placeholder={o.tracking_number ?? ""} onChange={(e) => setTracking(e.target.value)} /></Field>}
              {o.next_statuses.map((s) => (
                <div key={s}>
                  <Button className="w-full" variant={ACTIONS[s]?.variant ?? "primary"} loading={busy === s}
                    onClick={() => { if (s === "cancelled" && !confirm("Annuler cette commande ? La dépense associée sera annulée.")) return;
                      if (s === "validated" && o.budget_problems.length && !confirm(`Budget dépassé :\n${o.budget_problems.join("\n")}\n\nForcer la validation ?`)) return;
                      go(s, { override_budget: s === "validated" && o.budget_problems.length > 0, tracking: tracking || undefined, reference: ref || undefined }); }}>{ACTIONS[s]?.label ?? s}</Button>
                  {ACTIONS[s]?.help && <p className="mt-1 text-xs text-muted">{ACTIONS[s].help}</p>}
                </div>))}
              {o.next_statuses.length === 0 && <p className="text-sm text-muted">Aucune action : commande terminée.</p>}
              {o.status === "awaiting_validation" && !o.next_statuses.includes("validated") && null}
            </div>
          </Card>
          <Card className="p-4 text-sm">
            <div className="mb-2 font-semibold">Suivi</div>
            <ul className="space-y-1">{timeline.map(([k, v]) => <li key={k} className="flex justify-between"><span className={v ? "" : "text-muted"}>{k}</span><span className="text-xs text-muted">{dateTimeFr(v)}</span></li>)}</ul>
            {o.tracking_number && <p className="mt-2 text-xs">Suivi : <span className="font-mono">{o.tracking_number}</span></p>}
            {o.supplier_url && <a href={o.supplier_url} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 text-xs text-accent underline"><ExternalLink className="size-3" />Page fournisseur</a>}
            {o.documents.length > 0 && <p className="mt-2 text-xs text-muted">Documents : {o.documents.map((d) => d.filename).join(", ")}</p>}
            {o.notes && <p className="mt-2 text-xs text-muted">{o.notes}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
