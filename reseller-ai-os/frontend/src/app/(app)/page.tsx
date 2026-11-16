"use client";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Info } from "lucide-react";
import { useApi } from "@/lib/api";
import { ago, eur, num } from "@/lib/format";
import { AreaSeries, CategoryPie, CompareBars, MarginLine, type Pt } from "@/components/charts";
import { Badge, Card, CardHeader, Empty, ErrorBox, PageHeader, Spinner, StatCard, cn } from "@/components/ui";

type Dash = {
  kpis: Record<string, number | string | Record<string, number>> & { orders_in_progress: { sales_open: number; sales_to_ship: number; purchase_orders: number } };
  series: Pt[]; by_category: { category: string; revenue: number }[]; has_data: boolean;
  alerts: { kind: string; severity: string; title: string; detail: string; link: string; count: number }[];
  timeline: { id: number; at: string; action: string; summary: string; actor: string; label: string | null }[];
};

const SEV = { danger: { tone: "red", Icon: AlertTriangle }, warning: { tone: "amber", Icon: AlertTriangle }, success: { tone: "green", Icon: CheckCircle2 }, info: { tone: "blue", Icon: Info } } as const;

export default function Dashboard() {
  const { data, error, loading, reload } = useApi<Dash>("/dashboard");
  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorBox onRetry={reload}>{error}</ErrorBox>;
  if (!data) return null;
  const k = data.kpis as Record<string, number>;
  const o = data.kpis.orders_in_progress;
  return (
    <div>
      <PageHeader title="Tableau de bord" sub={`Mois en cours : ${data.kpis.month_label}. Tous les chiffres proviennent de votre base de données.`} />
      {!data.has_data && (
        <Card className="mb-5 border-accent/30 bg-accentsoft p-4 text-sm">
          <strong>Bienvenue.</strong> Aucune donnée pour l'instant : les compteurs sont à zéro, c'est normal. Commencez par{" "}
          <Link href="/sources" className="font-medium underline">ajouter une source de produits</Link>, puis lancez une recherche d'opportunités.
          Renseignez aussi votre capital de départ dans <Link href="/parametres" className="font-medium underline">Paramètres</Link>.
        </Card>
      )}
      <section aria-label="Indicateurs financiers" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <StatCard label="CA aujourd'hui" value={eur(k.revenue_today)} />
        <StatCard label="CA cette semaine" value={eur(k.revenue_week)} />
        <StatCard label="CA ce mois" value={eur(k.revenue_month)} sub={`${num(k.sales_count_month)} vente(s)`} />
        <StatCard label="Bénéfice net du mois" value={eur(k.net_profit_month)} tone={k.net_profit_month >= 0 ? "good" : "bad"} hint="CA − coût des articles vendus − frais − charges d'exploitation" />
        <StatCard label="Bénéfice net cumulé" value={eur(k.net_profit_total)} tone={k.net_profit_total >= 0 ? "good" : "bad"} />
        <StatCard label="Dépenses totales" value={eur(k.total_expenses)} sub={`dont exploitation ${eur(k.operating_expenses_total)}`} hint="Toutes les sorties d'argent, y compris les achats de stock" />
        <StatCard label="Investi dans les achats" value={eur(k.invested_purchases)} />
        <StatCard label="Valeur du stock" value={eur(k.stock_value)} sub={k.in_transit_value ? `+ ${eur(k.in_transit_value)} en commande` : undefined} hint="Coût complet des articles détenus et invendus" />
        <StatCard label="En attente sur Vinted" value={eur(k.pending_payouts)} />
        <StatCard label="Réellement encaissé" value={eur(k.cashed_in)} />
        <StatCard label="Trésorerie disponible" value={eur(k.cash_available)} tone={k.cash_available >= 0 ? undefined : "bad"} sub={`Capital pour achats : ${eur(k.capital_for_purchases)}`} />
        <StatCard label="Ventes · commandes · stock" value={`${num(k.sales_count)} · ${num(o.sales_open + o.purchase_orders)} · ${num(k.items_in_stock)}`}
          sub={`${o.sales_to_ship} à expédier · ${o.purchase_orders} achat(s) en cours`} />
      </section>

      <section aria-label="Graphiques" className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <AreaSeries data={data.series} k="revenue" title="Chiffre d'affaires" sub="12 derniers mois" />
        <AreaSeries data={data.series} k="net_profit" title="Bénéfice net mensuel" sub="Ventes − coûts − charges d'exploitation" />
        <AreaSeries data={data.series} k="expenses" title="Dépenses" sub="Toutes sorties d'argent" color="var(--info)" />
        <CompareBars data={data.series} />
        <CategoryPie data={data.by_category} />
        <MarginLine data={data.series} />
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Alertes" sub="Calculées en direct" />
          {data.alerts.length === 0 ? <Empty title="Aucune alerte">Tout est à jour.</Empty> : (
            <ul className="divide-y divide-line">
              {data.alerts.map((a) => {
                const s = SEV[a.severity as keyof typeof SEV] ?? SEV.info;
                return (
                  <li key={a.kind}>
                    <Link href={a.link} className="flex items-start gap-3 px-4 py-3 hover:bg-surface2">
                      <Badge tone={s.tone}><s.Icon className="size-3" />{a.count}</Badge>
                      <div className="min-w-0 flex-1"><div className="text-sm font-medium">{a.title}</div><div className="truncate text-xs text-muted">{a.detail}</div></div>
                      <ArrowRight className="mt-1 size-4 text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Activité récente" />
          {data.timeline.length === 0 ? <Empty title="Aucune activité">Les événements (produit détecté, achat, vente…) apparaîtront ici.</Empty> : (
            <ol className="max-h-[420px] overflow-y-auto px-4 py-2">
              {data.timeline.map((t) => (
                <li key={t.id} className="relative flex gap-3 py-2 pl-4 before:absolute before:left-0 before:top-4 before:size-2 before:rounded-full before:bg-accent">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{t.summary}</div>
                    <div className={cn("text-xs text-muted")}>{t.label ? `${t.label} · ` : ""}{t.actor !== "user" && `${t.actor} · `}{ago(t.at)}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
