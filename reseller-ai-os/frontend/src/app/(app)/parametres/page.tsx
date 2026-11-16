"use client";
import { useEffect, useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { Badge, Button, Card, CardHeader, ErrorBox, Field, Input, PageHeader, Select, Spinner, useAction } from "@/components/ui";

type S = Record<string, unknown> & { ai_model_simple: string; ai_model_reasoning: string };
type Secret = { name: string; label: string; configured: boolean; last4: string; source: string | null };
const MODELS = ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"];
const NOTIF_KINDS: [string, string][] = [["excellent_opportunity", "Excellente opportunité détectée"], ["new_products", "Nouveaux produits détectés"], ["purchase_awaiting_validation", "Achat en attente de validation"],
  ["purchase_ordered", "Achat enregistré"], ["supplier_shipped", "Commande expédiée par le fournisseur"], ["item_received", "Produit réceptionné"], ["listing_ready", "Annonce prête"], ["listing_published", "Annonce publiée"],
  ["sale_made", "Vente réalisée"], ["ship_due", "Commande à expédier"], ["ship_late", "Retard d'expédition"], ["parcel_shipped", "Colis expédié"], ["payout", "Paiement reçu"], ["refund", "Remboursement"],
  ["budget_near", "Budget mensuel presque atteint"], ["unpublished", "Article reçu non publié"], ["incident", "Incident Vinted"], ["agent_error", "Erreur d'un agent"], ["ops_problem", "Problème détecté par l'Operations Manager"]];

export default function Page() {
  const { data, error, reload } = useApi<S>("/settings");
  const secrets = useApi<Secret[]>("/secrets");
  const usage = useApi<{ budget: { daily_spent: number; monthly_spent: number } }>("/ai/usage");
  const [f, setF] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState({ notify_email_enabled: false });
  const [disabled, setDisabled] = useState<string[]>([]);
  const [newSecret, setNewSecret] = useState<{ name: string; value: string }>({ name: "", value: "" });
  const { busy, run } = useAction();
  useEffect(() => {
    if (!data) return;
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) if (typeof v === "number" || typeof v === "string") o[k] = String(v);
    o.categories = ((data.categories as string[]) ?? []).join(", ");
    setF(o); setFlags({ notify_email_enabled: !!data.notify_email_enabled }); setDisabled((data.notify_kinds_disabled as string[]) ?? []);
  }, [data]);
  if (error) return <ErrorBox onRetry={reload}>{error}</ErrorBox>;
  if (!data) return <Spinner />;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const num = (k: string) => Number((f[k] ?? "0").replace(",", ".")) || 0;
  const fld = (k: string, label: string, hint?: string, step = "any") => <Field label={label} hint={hint}><Input type="number" min={0} step={step} value={f[k] ?? ""} onChange={set(k)} /></Field>;
  const save = (keys: string[], extra: Record<string, unknown> = {}) => run("save", async () => {
    const body: Record<string, unknown> = { ...extra };
    for (const k of keys) body[k] = k === "categories" ? (f.categories ?? "").split(",").map((x) => x.trim()).filter(Boolean) : k.startsWith("ai_model") || k.endsWith("_to") || k === "search_frequency" ? f[k] : num(k);
    await api("/settings", { method: "PUT", body }); reload();
  }, "Paramètres enregistrés");
  return (
    <div className="space-y-5">
      <PageHeader title="Paramètres" sub="Budgets, seuils de rentabilité, IA, notifications et clés API." />
      <Card>
        <CardHeader title="Budgets et seuils d'achat" sub="Les achats dépassant ces limites sont refusés à la validation (sauf forçage explicite) ; 0 = illimité" />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {fld("initial_capital", "Budget initial / capital de départ (€)", "Base de la trésorerie")}{fld("budget_monthly", "Budget d'achat mensuel (€)")}{fld("budget_daily", "Budget d'achat quotidien (€)")}{fld("budget_per_purchase", "Budget par achat (€)")}
          {fld("min_margin_pct", "Marge minimale (%)")}{fld("min_profit", "Bénéfice minimal par produit (€)")}{fld("excellent_score", "Score « excellente opportunité »", "Notification au-delà")}{fld("default_quantity", "Quantité par défaut des paniers", undefined, "1")}
          {fld("default_packaging", "Emballage par article (€)", "Simulateur et scores")}{fld("default_operating", "Frais opérationnels par article (€)")}{fld("seller_fee_rate_pct", "Frais vendeur (%)", "Vinted : à vérifier selon votre compte")}{fld("seller_fee_fixed", "Frais vendeur fixes (€)")}
          {fld("shipping_deadline_days", "Délai d'expédition (jours)", undefined, "1")}{fld("unpublished_alert_days", "Alerte « non publié » après (jours)", undefined, "1")}
          <Field label="Catégories recherchées" hint="Séparées par des virgules ; filtre les paniers automatiques (vide = toutes). Fréquence de recherche : page Automatisation."><Input value={f.categories ?? ""} onChange={set("categories")} /></Field>
        </div>
        <div className="border-t border-line p-4"><Button loading={busy === "save"} onClick={() => save(["initial_capital", "budget_monthly", "budget_daily", "budget_per_purchase", "min_margin_pct", "min_profit", "excellent_score", "default_quantity", "default_packaging", "default_operating", "seller_fee_rate_pct", "seller_fee_fixed", "shipping_deadline_days", "unpublished_alert_days", "categories"])}>Enregistrer</Button></div>
      </Card>
      <Card>
        <CardHeader title="Intelligence artificielle" sub="Claude n'est utilisé que pour le raisonnement : enrichissement, annonces, centre de contrôle. Marges, stocks et statistiques n'appellent jamais l'IA." />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Modèle économique (tâches simples)"><Select value={f.ai_model_simple ?? ""} onChange={set("ai_model_simple")}>{MODELS.map((m) => <option key={m}>{m}</option>)}</Select></Field>
          <Field label="Modèle de raisonnement"><Select value={f.ai_model_reasoning ?? ""} onChange={set("ai_model_reasoning")}>{MODELS.map((m) => <option key={m}>{m}</option>)}</Select></Field>
          {fld("ai_budget_daily", "Budget IA quotidien (€)", `Dépensé aujourd'hui : ${usage.data?.budget.daily_spent.toFixed(3) ?? "…"} €`)}{fld("ai_budget_monthly", "Budget IA mensuel (€)", `Dépensé ce mois : ${usage.data?.budget.monthly_spent.toFixed(3) ?? "…"} €`)}
          {fld("ai_eur_per_usd", "Taux EUR par USD", "Pour convertir le coût des tokens")}
        </div>
        <div className="border-t border-line p-4"><Button loading={busy === "save"} onClick={() => save(["ai_model_simple", "ai_model_reasoning", "ai_budget_daily", "ai_budget_monthly", "ai_eur_per_usd"])}>Enregistrer</Button><span className="ml-3 text-xs text-muted">Limites par agent : page Agents.</span></div>
      </Card>
      <Card>
        <CardHeader title="Notifications" sub="E-mail : nécessite SMTP_HOST / SMTP_FROM côté serveur (voir .env)" />
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="Adresse de réception"><Input type="email" value={f.notify_email_to ?? ""} onChange={set("notify_email_to")} /></Field>
          <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={flags.notify_email_enabled} onChange={(e) => setFlags({ notify_email_enabled: e.target.checked })} />Envoyer aussi par e-mail</label>
        </div>
        <div className="border-t border-line p-4">
          <div className="mb-2 text-xs font-medium text-muted">Types de notifications actifs</div>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">{NOTIF_KINDS.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!disabled.includes(k)} onChange={(e) => setDisabled(e.target.checked ? disabled.filter((x) => x !== k) : [...disabled, k])} />{l}</label>)}</div>
        </div>
        <div className="border-t border-line p-4"><Button loading={busy === "save"} onClick={() => save(["notify_email_to"], { notify_email_enabled: flags.notify_email_enabled, notify_kinds_disabled: disabled })}>Enregistrer</Button></div>
      </Card>
      <Card>
        <CardHeader title="Clés API" sub="Chiffrées en base (Fernet). La valeur n'est jamais ré-affichée ni renvoyée par l'API." />
        <ul className="divide-y divide-line">{secrets.data?.map((s) => (
          <li key={s.name} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"><KeyRound className="size-4 text-muted" />
            <div className="min-w-0 flex-1"><div className="font-medium">{s.label}</div><div className="font-mono text-xs text-muted">{s.name}</div></div>
            {s.configured ? <Badge tone="green">Configurée …{s.last4}{s.source ? ` · ${s.source}` : ""}</Badge> : <Badge tone="amber">Non configurée</Badge>}
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = new FormData(e.currentTarget).get("v") as string; run("k", async () => { await api(`/secrets/${s.name}`, { method: "PUT", body: { value: v } }); (e.target as HTMLFormElement).reset(); secrets.reload(); }, "Clé enregistrée"); }}>
              <Input name="v" type="password" autoComplete="off" placeholder={s.configured ? "Remplacer…" : "Coller la clé"} className="!w-52 !py-1.5" minLength={8} required aria-label={`Valeur de ${s.label}`} /><Button size="sm" type="submit">Enregistrer</Button></form>
            {s.source?.startsWith("base") && <button aria-label={`Supprimer ${s.label}`} className="text-muted hover:text-danger" onClick={() => confirm("Supprimer cette clé ?") && run("kd", async () => { await api(`/secrets/${s.name}`, { method: "DELETE" }); secrets.reload(); }, "Clé supprimée")}><Trash2 className="size-4" /></button>}
          </li>))}</ul>
        <form className="grid gap-2 border-t border-line p-4 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); run("k", async () => { await api(`/secrets/${newSecret.name}`, { method: "PUT", body: { value: newSecret.value } }); setNewSecret({ name: "", value: "" }); secrets.reload(); }, "Clé enregistrée"); }}>
          <Input placeholder="nom_du_secret (ex. fournisseur_x_key)" pattern="[A-Za-z0-9_]+" required value={newSecret.name} onChange={(e) => setNewSecret({ ...newSecret, name: e.target.value })} aria-label="Nom du secret" />
          <Input type="password" autoComplete="off" placeholder="Valeur" required minLength={8} value={newSecret.value} onChange={(e) => setNewSecret({ ...newSecret, value: e.target.value })} aria-label="Valeur" /><Button type="submit">Ajouter</Button></form>
      </Card>
    </div>
  );
}
