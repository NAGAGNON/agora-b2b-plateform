import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { REGIONS } from "@/lib/geo";
import { growthEnabled, GROWTH_WINDOW_DAYS } from "@/lib/growth/engine";
import { FAMILY_LABEL, type Change, type GrowthMetrics, type GrowthStrategy } from "@/lib/growth/strategy";
import { GrowthEnableForm, GrowthRecomputeForm } from "@/components/admin/growth-actions";
import { EmptyState } from "@/components/ui/states";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata = { title: "Stratégie automatique" };

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)} %` : "—");

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-lg font-bold text-navy">{title}</h2>
      {children}
    </section>
  );
}

export default async function GrowthStrategyPage() {
  await requireAdmin();
  const db = createAdminClient();
  const [enabled, { data: snapshots }, { data: sectors }] = await Promise.all([
    growthEnabled(db),
    db.from("growth_snapshots").select("day, computed_at, metrics, strategy, changes").order("day", { ascending: false }).limit(14),
    db.from("sectors").select("slug, label"),
  ]);
  const latest = snapshots?.[0];
  const s = latest?.strategy as GrowthStrategy | undefined;
  const m = latest?.metrics as GrowthMetrics | undefined;
  const sectorLabel = new Map((sectors ?? []).map((x) => [x.slug, x.label]));
  const label = (slug: string) => REGIONS.find((r) => r.slug === slug)?.name ?? sectorLabel.get(slug) ?? slug;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Stratégie automatique</h1>
        <p className="mt-1 max-w-3xl text-slate-600">
          Chaque soir, avec le bilan de 21 h, le site analyse les chiffres réels des {GROWTH_WINDOW_DAYS} derniers jours (pages d&apos;entrée, visiteurs venus de
          Google, lectures des articles, inscriptions, réponses aux e-mails de prospection) et adapte ce qu&apos;il met en avant le lendemain : thèmes des
          articles, rythme de publication, régions de l&apos;accueil, ordre de la prospection. Règles simples et chiffrées, sans texte inventé.
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <p className="flex-1 text-sm" data-testid="growth-status">
          État : <strong>{enabled ? "active" : "suspendue"}</strong>
          {latest ? ` · dernier calcul le ${formatDateTime(latest.computed_at)}` : " · pas encore calculée (premier calcul ce soir)"}
        </p>
        <GrowthRecomputeForm />
        <GrowthEnableForm enabled={enabled} />
      </div>

      {!s || !m ? (
        <EmptyState title="Aucune stratégie calculée pour l'instant" description="Le premier calcul a lieu ce soir avec le bilan de 21 h (ou maintenant avec « Recalculer maintenant »)." />
      ) : (
        <>
          <Card title="Ce que le site applique en ce moment">
            <ul className="space-y-2 text-sm text-slate-700">
              <li>
                <strong>Articles — thèmes prioritaires :</strong>{" "}
                {Object.keys(s.articles.boosts).length
                  ? Object.entries(s.articles.boosts)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([slug]) => label(slug))
                      .join(", ")
                  : "aucun (pas encore assez de visites pour départager : les thèmes les plus fournis passent en premier)"}
              </li>
              <li>
                <strong>Articles — ordre des types :</strong> {s.articles.family_order.map((f) => FAMILY_LABEL[f]).join(" → ")}
              </li>
              <li>
                <strong>Articles — rythme minimum :</strong> {s.articles.per_day} par jour
              </li>
              <li>
                <strong>Accueil — régions mises en avant :</strong> {s.home.regions.map(label).join(", ")}
              </li>
              <li>
                <strong>Prospection — secteurs prioritaires :</strong>{" "}
                {Object.entries(s.outreach.sector_priority).filter(([, p]) => p > 0).length
                  ? Object.entries(s.outreach.sector_priority)
                      .filter(([, p]) => p > 0)
                      .sort((a, b) => b[1] - a[1])
                      .map(([slug]) => label(slug))
                      .join(", ")
                  : "aucun (au moins 50 e-mails envoyés et des clics nécessaires pour comparer les secteurs)"}
              </li>
            </ul>
          </Card>

          {s.watch.length > 0 && (
            <Card title="Points à surveiller">
              <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
                {s.watch.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Card>
          )}

          <Card title={`Pages d'entrée (${GROWTH_WINDOW_DAYS} derniers jours)`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="growth-entry-groups">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-1 pr-3">Arrivée par</th>
                    <th className="py-1 pr-3 text-right">Visites</th>
                    <th className="py-1 pr-3 text-right">Depuis un moteur</th>
                    <th className="py-1 pr-3 text-right">Repartis aussitôt</th>
                    <th className="py-1 pr-3 text-right">Page d&apos;inscription ouverte</th>
                    <th className="py-1 text-right">Inscriptions</th>
                  </tr>
                </thead>
                <tbody>
                  {m.entry_groups.map((g) => (
                    <tr key={g.grp} className="border-t border-slate-100">
                      <td className="py-1 pr-3">{g.grp}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{g.visits}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{g.from_search}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{pct(g.bounces, g.visits)}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{g.intent}</td>
                      <td className="py-1 text-right tabular-nums">{g.signups}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Historique des décisions">
            <ul className="space-y-3">
              {(snapshots ?? []).map((snap) => {
                const changes = (snap.changes ?? []) as Change[];
                return (
                  <li key={snap.day} className="text-sm">
                    <p className="font-semibold text-navy">{formatDate(snap.day)}</p>
                    {changes.length ? (
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">
                        {changes.map((c) => (
                          <li key={c.decision}>
                            <strong>{c.domaine} :</strong> {c.decision}. <span className="text-slate-500">{c.raison}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-slate-500">Aucun changement.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
