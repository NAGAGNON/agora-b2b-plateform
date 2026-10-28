import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Conversion de l'accueil" };
export const dynamic = "force-dynamic";

const DAY = 86_400_000;

/** Les deux fenêtres comparées : 7 derniers jours, puis les 7 jours d'avant. */
function comparedPeriods() {
  const now = Date.now();
  return {
    now,
    periods: [
      { from: new Date(now - 7 * DAY).toISOString(), to: new Date(now).toISOString() },
      { from: new Date(now - 14 * DAY).toISOString(), to: new Date(now - 7 * DAY).toISOString() },
    ],
  };
}

const CTA_LABELS: Record<string, string> = {
  home_hero_opportunites: "« Découvrir les opportunités » (en-tête)",
  home_hero_besoin: "« Publier un besoin » (en-tête)",
  home_hero_inscription: "« Créer mon compte gratuit » (en-tête)",
  home_apercu_opportunites: "« Voir les opportunités ouvertes » (aperçu en direct)",
  home_usage_opportunites: "Bloc « Identifier des opportunités »",
  home_usage_besoins: "Bloc « Découvrir les besoins des entreprises »",
  home_usage_annuaire: "Bloc « Trouver des partenaires »",
  home_benefices_alerte: "« Créer mon alerte gratuite »",
  home_benefices_opportunites: "« Explorer les opportunités » (après les bénéfices)",
  home_besoins_publier: "« Publier un besoin »",
  home_besoins_consulter: "« Voir les besoins publiés »",
  home_final_inscription: "« Créer mon compte gratuit » (bas de page)",
  home_final_besoin: "« Publier un besoin » (bas de page)",
};

/**
 * Parcours de conversion de l'accueil, sur les 7 derniers jours comparés aux 7 jours précédents :
 * visites, clics sur les appels à l'action, début et fin d'inscription, premières actions utiles.
 * Sources internes uniquement (pages vues sans cookie, événements produit sans donnée personnelle).
 */
export default async function ConversionPage() {
  await requireAdmin();
  const db = createAdminClient();
  const { now, periods } = comparedPeriods();
  const views = (path: string, p: (typeof periods)[number]) =>
    db.from("page_views").select("id", { count: "exact", head: true }).eq("path", path).gte("created_at", p.from).lt("created_at", p.to);
  const events = (names: string[], p: (typeof periods)[number]) =>
    db.from("analytics_events").select("id", { count: "exact", head: true }).in("event_name", names).gte("created_at", p.from).lt("created_at", p.to);
  const ACTIONS = ["create_company", "create_alert", "save_favorite", "express_interest", "publish_opportunity", "submit_proposal"];
  const rows = [
    { label: "Visites de la page d'accueil", run: (p: (typeof periods)[number]) => views("/", p) },
    { label: "Visites de la page d'inscription (début d'inscription)", run: (p: (typeof periods)[number]) => views("/inscription", p) },
    { label: "Inscriptions terminées", run: (p: (typeof periods)[number]) => events(["create_account"], p) },
    { label: "Consultations d'opportunités", run: (p: (typeof periods)[number]) => events(["view_opportunity"], p) },
    { label: "Actions utiles (entreprise créée, alerte, favori, intérêt, publication, réponse)", run: (p: (typeof periods)[number]) => events(ACTIONS, p) },
  ];
  const [counts, clicks] = await Promise.all([
    Promise.all(rows.map(async (r) => Promise.all(periods.map(async (p) => (await r.run(p)).count ?? 0)))),
    Promise.all(
      periods.map(async (p) => {
        const { data } = await db.from("analytics_events").select("properties").eq("event_name", "cta_click").gte("created_at", p.from).lt("created_at", p.to).limit(20000);
        const by: Record<string, number> = {};
        for (const e of data ?? []) {
          const cta = (e.properties as { cta?: string } | null)?.cta;
          if (cta) by[cta] = (by[cta] ?? 0) + 1;
        }
        return by;
      }),
    ),
  ]);
  const ctas = Object.keys(CTA_LABELS);
  const delta = (a: number, b: number) => (b === 0 ? (a > 0 ? "nouveau" : "—") : `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)} %`);
  const cell = "px-3 py-2 text-right tabular-nums";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conversion de l&apos;accueil</h1>
        <p className="mt-1 text-slate-600">
          7 derniers jours comparés aux 7 jours précédents (au {formatDateTime(new Date(now).toISOString())}). Visites de l&apos;équipe exclues ; aucune donnée
          personnelle. Les clics sur les boutons sont mesurés depuis la mise en ligne de la nouvelle page d&apos;accueil.
        </p>
      </div>
      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <caption className="sr-only">Parcours de conversion</caption>
          <thead className="bg-canvas text-left text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2">Étape</th>
              <th scope="col" className="px-3 py-2 text-right">7 derniers jours</th>
              <th scope="col" className="px-3 py-2 text-right">7 jours précédents</th>
              <th scope="col" className="px-3 py-2 text-right">Évolution</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.label} className="border-t border-slate-100">
                <th scope="row" className="px-3 py-2 text-left font-medium text-navy">{r.label}</th>
                <td className={cell}>{counts[i][0]}</td>
                <td className={cell}>{counts[i][1]}</td>
                <td className={cell}>{delta(counts[i][0], counts[i][1])}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-100 bg-canvas">
              <th scope="row" className="px-3 py-2 text-left font-medium text-navy">Taux d&apos;inscription (inscriptions / visites de l&apos;accueil)</th>
              <td className={cell}>{counts[0][0] ? `${((counts[2][0] / counts[0][0]) * 100).toFixed(1)} %` : "—"}</td>
              <td className={cell}>{counts[0][1] ? `${((counts[2][1] / counts[0][1]) * 100).toFixed(1)} %` : "—"}</td>
              <td className={cell} />
            </tr>
          </tbody>
        </table>
      </section>
      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <caption className="px-3 pt-3 text-left font-semibold text-navy">Clics sur les boutons de l&apos;accueil</caption>
          <thead className="bg-canvas text-left text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2">Bouton</th>
              <th scope="col" className="px-3 py-2 text-right">7 derniers jours</th>
              <th scope="col" className="px-3 py-2 text-right">7 jours précédents</th>
            </tr>
          </thead>
          <tbody>
            {ctas.map((c) => (
              <tr key={c} className="border-t border-slate-100">
                <th scope="row" className="px-3 py-2 text-left font-medium text-navy">{CTA_LABELS[c]}</th>
                <td className={cell}>{clicks[0][c] ?? 0}</td>
                <td className={cell}>{clicks[1][c] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
