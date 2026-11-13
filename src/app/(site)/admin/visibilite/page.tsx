import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReviewBoostButtons } from "@/components/dashboard/boost-actions";
import { BOOST_STATUS_LABEL } from "@/lib/visibility";
import { formatDateTime } from "@/lib/format";
import { formatEuros } from "@/lib/billing/plans";

export const metadata = { title: "Visibilité — demandes" };
export const dynamic = "force-dynamic";

/** Demandes de visibilité : rien ne démarre avant validation de l'équipe. */
export default async function VisibilityAdminPage() {
  await requireAdmin();
  const db = createAdminClient();
  const { data: rows } = await db.from("visibility_boosts").select("*").order("created_at", { ascending: false }).limit(200);
  const list = rows ?? [];
  const [{ data: companies }, { data: needs }, { data: counts }] = await Promise.all([
    list.length ? db.from("companies").select("id, name, slug").in("id", [...new Set(list.map((b) => b.company_id))]) : Promise.resolve({ data: [] }),
    list.some((b) => b.opportunity_id) ? db.from("opportunities").select("id, title").in("id", list.filter((b) => b.opportunity_id).map((b) => b.opportunity_id!)) : Promise.resolve({ data: [] }),
    list.length ? db.from("boost_presentations").select("boost_id").in("boost_id", list.map((b) => b.id)) : Promise.resolve({ data: [] }),
  ]);
  const company = new Map((companies ?? []).map((c) => [c.id, c]));
  const need = new Map((needs ?? []).map((n) => [n.id, n.title]));
  const presented = new Map<string, number>();
  for (const r of counts ?? []) presented.set(r.boost_id, (presented.get(r.boost_id) ?? 0) + 1);
  const pending = list.filter((b) => b.status === "PENDING");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Visibilité — demandes</h1>
        <p className="mt-1 text-sm text-slate-600">
          {pending.length} demande(s) à valider. Une demande validée démarre aussitôt : présentation quotidienne dans l&apos;espace des entreprises ciblées (entreprise) ou
          quota quotidien de la mise en relation (besoin), et affichage « À la une ».
        </p>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="w-full min-w-[56rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-4 py-3">Demande</th>
              <th className="px-4 py-3">Cible</th>
              <th className="px-4 py-3">Choix</th>
              <th className="px-4 py-3">Prix</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((b) => {
              const c = company.get(b.company_id);
              return (
                <tr key={b.id} className="align-top">
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(b.created_at)}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-navy">{c?.name ?? "—"}</p>
                    {b.opportunity_id && <p className="text-slate-600">Besoin : {need.get(b.opportunity_id) ?? "—"}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {b.daily_presentations > 0 && <p>{b.daily_presentations} / jour × {b.duration_days} j</p>}
                    {b.featured_days > 0 && <p>À la une : {b.featured_days} j</p>}
                    {b.status !== "PENDING" && <p className="text-slate-500">{presented.get(b.id) ?? 0} présentation(s)</p>}
                  </td>
                  <td className="px-4 py-3">{b.free_launch ? "Gratuit (lancement)" : `${formatEuros(Number(b.price_ht))} HT`}</td>
                  <td className="px-4 py-3">{BOOST_STATUS_LABEL[b.status] ?? b.status}</td>
                  <td className="px-4 py-3">{b.status === "PENDING" ? <ReviewBoostButtons id={b.id} /> : b.note ? <span className="text-slate-500">{b.note}</span> : null}</td>
                </tr>
              );
            })}
            {!list.length && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Aucune demande pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
