import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReviewAdButtons, ReviewBoostButtons, StopBoostButton } from "@/components/dashboard/boost-actions";
import { BOOST_STATUS_LABEL } from "@/lib/visibility";
import { formatDateTime } from "@/lib/format";
import { formatEuros } from "@/lib/billing/plans";

export const metadata = { title: "Visibilité — demandes" };
export const dynamic = "force-dynamic";

/** Offres de visibilité : démarrage automatique ; l'équipe peut arrêter une offre en cas de souci. */
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
  const ads = list.filter((b) => b.ad_status === "PENDING_REVIEW" && b.status === "ACTIVE");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Visibilité — demandes</h1>
        <p className="mt-1 text-sm text-slate-600">
          Les offres démarrent automatiquement, sans validation. En cas de souci, cliquez sur « Arrêter » : plus aucune présentation ni mise en avant.
          {pending.length > 0 && ` ${pending.length} demande(s) en attente.`}
        </p>
      </div>
      <section aria-labelledby="annonces" className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 id="annonces" className="text-lg font-bold text-navy">
          Annonces à relire {ads.length > 0 && <span className="ml-1 rounded-full bg-teal px-2 py-0.5 text-sm text-navy">{ads.length}</span>}
        </h2>
        <p className="mt-1 text-sm text-slate-600">Aucun e-mail ne part tant que l&apos;annonce n&apos;est pas validée. Les présentations dans l&apos;espace des membres continuent.</p>
        {!ads.length ? (
          <p className="mt-3 text-sm text-slate-500">Aucune annonce en attente.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {ads.map((b) => (
              <li key={b.id} className="rounded-xl border border-slate-200 border-l-4 border-l-teal p-4" data-testid="ad-review">
                <p className="text-xs text-slate-500">
                  {company.get(b.company_id)?.name ?? "—"} · {formatDateTime(b.created_at)}
                  {b.objective && ` · objectif : ${b.objective === "CLIENTS" ? "clients" : b.objective === "SOUS_TRAITANTS" ? "sous-traitants" : "partenaires"}`}
                </p>
                <p className="mt-1 font-bold text-navy">{b.ad_title}</p>
                {b.ad_points?.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                    {b.ad_points.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                )}
                {b.ad_text && <p className="mt-1 text-sm whitespace-pre-line text-slate-700">{b.ad_text}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <ReviewAdButtons id={b.id} />
                  <Link href={`/admin/visibilite/${b.id}`} className="text-sm font-semibold text-teal-700 hover:underline">
                    Suivi étape par étape
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
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
                    <Link href={`/admin/visibilite/${b.id}`} className="font-semibold text-navy hover:text-teal-700 hover:underline">
                      {c?.name ?? "—"}
                    </Link>
                    <p>
                      <Link href={`/admin/visibilite/${b.id}`} className="text-xs font-semibold text-teal-700 hover:underline">
                        Suivi étape par étape
                      </Link>
                    </p>
                    {b.opportunity_id && <p className="text-slate-600">Besoin : {need.get(b.opportunity_id) ?? "—"}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {b.daily_presentations > 0 && <p>{b.daily_presentations} / jour × {b.duration_days} j</p>}
                    {b.featured_days > 0 && <p>À la une : {b.featured_days} j</p>}
                    {(() => {
                      const t = (b.targeting ?? {}) as { sectors?: string[]; regions?: string[]; sizes?: string[]; kinds?: string[] };
                      const all = [...(t.regions ?? []), ...(t.sizes ?? []), ...(t.kinds ?? []), ...(t.sectors ?? [])];
                      return all.length ? <p className="text-xs text-slate-500">Ciblage : {all.join(", ")}</p> : <p className="text-xs text-slate-500">Ciblage : toutes les entreprises</p>;
                    })()}
                    {b.included_presentations > 0 && <p className="text-xs text-teal-700">{b.included_presentations} incluses dans l&apos;abonnement</p>}
                    {b.status !== "PENDING" && <p className="text-slate-500">{presented.get(b.id) ?? 0} présentation(s)</p>}
                  </td>
                  <td className="px-4 py-3">{b.free_launch ? "Gratuit (lancement)" : `${formatEuros(Number(b.price_ht))} HT`}</td>
                  <td className="px-4 py-3">{BOOST_STATUS_LABEL[b.status] ?? b.status}</td>
                  <td className="px-4 py-3">
                    {b.status === "PENDING" ? (
                      <ReviewBoostButtons id={b.id} />
                    ) : (
                      <div className="space-y-1">
                        {b.status === "ACTIVE" && <StopBoostButton id={b.id} />}
                        {b.note && <p className="text-slate-500">{b.note}</p>}
                      </div>
                    )}
                  </td>
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
