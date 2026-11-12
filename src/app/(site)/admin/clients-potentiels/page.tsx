import { requireAdmin } from "@/lib/auth";
import { loadBuyerProfiles } from "@/lib/buyer-profiles";
import { CRITERIA } from "@/lib/buying-score";
import { DashboardCard } from "@/components/ui/card";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Clients potentiels" };
export const dynamic = "force-dynamic";

const LEVEL = {
  CHAUD: { label: "Chaud", cls: "bg-red-100 text-red-800" },
  TIEDE: { label: "Tiède", cls: "bg-sky text-navy" },
  FROID: { label: "Froid", cls: "bg-slate-100 text-slate-600" },
} as const;

/** Action conseillée selon le profil (relance humaine, pas d'envoi automatique). */
function advice(p: Awaited<ReturnType<typeof loadBuyerProfiles>>[number]) {
  if (!p.signals.hasCompany) return "L'aider à créer sa fiche entreprise (récompense et offre s'y appliquent)";
  if (p.level === "CHAUD") return "Appel ou e-mail personnel : lui proposer en premier le tarif fondateur au lancement";
  if (p.signals.days < 2 && p.signals.views + p.signals.searches >= 20) return "Très actif une seule fois : lui rappeler ses favoris et créer une alerte";
  if (!p.signals.alerts) return "Lui proposer une alerte sur son métier";
  return "Suivre : relance au lancement";
}

/**
 * Clients potentiels : membres classés selon leur probabilité de payer (barème lisible tiré de
 * leurs actions réelles), avec ce qu'ils regardent et l'action conseillée.
 */
export default async function ProspectsPage() {
  await requireAdmin();
  const list = await loadBuyerProfiles();
  const hot = list.filter((p) => p.level === "CHAUD");
  const warm = list.filter((p) => p.level === "TIEDE");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Clients potentiels</h1>
        <p className="mt-1 text-sm text-slate-600">
          Membres classés du plus susceptible de payer au moins susceptible. Barème :{" "}
          {CRITERIA.map((c) => `${c.label.toLowerCase()} +${c.points}`).join(" · ")} (sur 80), plus un bonus d&apos;intensité jusqu&apos;à +20. Équipe exclue.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <DashboardCard label="Membres classés" value={list.length} />
        <DashboardCard label="Chauds (60 et plus)" value={hot.length} />
        <DashboardCard label="Tièdes (35 à 59)" value={warm.length} />
        <DashboardCard label="Objectif : premiers clients" value="5" />
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Membre</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Activité</th>
              <th className="px-4 py-3">Ce qu&apos;il regarde</th>
              <th className="px-4 py-3">Action conseillée</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p, i) => (
              <tr key={p.userId} className="border-b border-slate-100 align-top last:border-0">
                <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-navy">{p.name || "Sans nom"}</p>
                  <p className="text-xs text-slate-500">{p.company ?? "Pas d'entreprise"}</p>
                  <p className="text-xs text-slate-500">{p.email}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-lg font-extrabold text-navy">{p.score}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LEVEL[p.level].cls}`}>{LEVEL[p.level].label}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  <p>
                    {p.signals.days} jour(s) · {p.signals.views} marchés · {p.signals.searches} recherches
                  </p>
                  <p>
                    {p.signals.sources} liens officiels · {p.signals.alerts} alerte(s) · {p.signals.favorites} favori(s)
                  </p>
                  <p className="mt-1 text-slate-500">
                    Inscrit le {formatDate(p.createdAt)}
                    {p.lastSeenAt ? ` · vu le ${formatDate(p.lastSeenAt)}` : ""}
                  </p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {p.topSector ? (
                    <>
                      <p className="font-semibold text-navy">{p.topSector}</p>
                      <p>{p.openInSector.toLocaleString("fr-FR")} marchés ouverts dans ce métier</p>
                      {p.topDepartments.length > 0 && <p>Départements : {p.topDepartments.join(", ")}</p>}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-700">{advice(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
