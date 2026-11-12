import { requireAdmin } from "@/lib/auth";
import { loadBuyerProfiles } from "@/lib/buyer-profiles";
import { CRITERIA } from "@/lib/buying-score";
import { DashboardCard } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { relaunchAllInactive, relaunchUser } from "@/app/actions/reengagement";
import { INACTIVE_DAYS, RELAUNCH_GAP_DAYS } from "@/lib/reengagement";

const DAY = 86_400_000;
const now = () => Date.now();

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
  const t = now();
  const { data: sends } = await createAdminClient().from("reengagement_sends").select("user_id, sent_at").order("sent_at", { ascending: false }).limit(5000);
  const lastRelaunch = new Map<string, string>();
  for (const r of sends ?? []) if (!lastRelaunch.has(r.user_id)) lastRelaunch.set(r.user_id, r.sent_at);
  const idleDays = (p: (typeof list)[number]) => Math.floor((t - new Date(p.lastSeenAt ?? p.createdAt).getTime()) / DAY);
  const inactive = list.filter((p) => idleDays(p) >= INACTIVE_DAYS).sort((a, b) => b.score - a.score);
  const canRelaunch = (id: string) => {
    const last = lastRelaunch.get(id);
    return !last || t - new Date(last).getTime() >= RELAUNCH_GAP_DAYS * DAY;
  };
  const eligible = inactive.filter((p) => canRelaunch(p.userId));
  const isNew = (p: (typeof list)[number]) => t - new Date(p.createdAt).getTime() < 7 * DAY;
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
                  <p className="font-semibold text-navy">
                    {p.name || "Sans nom"}
                    {isNew(p) && <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-900">Nouveau</span>}
                  </p>
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

      <section aria-labelledby="inactifs" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="inactifs" className="text-xl font-bold text-navy">
              Inactifs à relancer ({inactive.length})
            </h2>
            <p className="text-sm text-slate-600">
              Aucune visite depuis {INACTIVE_DAYS} jours ou plus, classés par score. L&apos;e-mail est personnel : nouveaux marchés de leur métier depuis leur dernière visite,
              favoris en attente. Au plus une relance tous les {RELAUNCH_GAP_DAYS} jours par membre, seulement s&apos;il accepte les e-mails.
            </p>
          </div>
          {eligible.length > 0 && (
            <form action={relaunchAllInactive}>
              <input type="hidden" name="userIds" value={eligible.map((p) => p.userId).join(",")} />
              <button className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white">Relancer les {eligible.length} éligibles</button>
            </form>
          )}
        </div>
        <ul className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          {inactive.map((p) => (
            <li key={p.userId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-navy">
                  {p.name || "Sans nom"} <span className="font-normal text-slate-500">· {p.company ?? "pas d'entreprise"} · score {p.score}</span>
                </p>
                <p className="text-xs text-slate-500">
                  Inactif depuis {idleDays(p)} jours{p.topSector ? ` · regardait : ${p.topSector}` : ""}
                  {lastRelaunch.has(p.userId) ? ` · relancé le ${formatDate(lastRelaunch.get(p.userId)!)}` : ""}
                </p>
              </div>
              {canRelaunch(p.userId) ? (
                <form action={relaunchUser}>
                  <input type="hidden" name="userId" value={p.userId} />
                  <button className="rounded-lg px-3 py-1.5 text-sm font-semibold text-teal-700 ring-1 ring-teal/40 hover:bg-teal-50">Relancer</button>
                </form>
              ) : (
                <span className="text-xs text-slate-500">Déjà relancé récemment</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
