import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { PageHead, Panel, PROSPECT_STATUS, StatusBadge, fmtN } from "@/components/outreach/ui";
import { ImportForm } from "@/components/outreach/prospect-forms";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { title: "Entreprises" };
const PER_PAGE = 50;

export default async function ProspectsPage(props: PageProps<"/outreach/prospects">) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80).replace(/[%_,()]/g, "") : "";
  const dept = typeof sp.departement === "string" && /^[0-9AB]{2,3}$/.test(sp.departement) ? sp.departement : "";
  const sector = typeof sp.secteur === "string" ? sp.secteur : "";
  const status = typeof sp.statut === "string" ? sp.statut : "";
  const withEmail = sp.email === "1";
  const supabase = await createClient();
  let query = supabase
    .from("outreach_prospects")
    .select("id, name, siren, naf_code, city, department_code, sectors, email, source, status, contacts_count, last_contacted_at, last_clicked_at", { count: "exact" });
  if (q) query = /^\d{9}$/.test(q) ? query.eq("siren", q) : query.or(`name.ilike.%${q}%,email.ilike.%${q}%,naf_code.ilike.%${q}%`);
  if (dept) query = query.eq("department_code", dept);
  if (sector) query = query.contains("sectors", [sector]);
  if (status) query = query.eq("status", status);
  if (withEmail) query = query.not("email", "is", null);
  const [{ data, count }, { data: sectors }, { data: departments }] = await Promise.all([
    query.order("updated_at", { ascending: false }).range((page - 1) * PER_PAGE, page * PER_PAGE - 1),
    supabase.from("sectors").select("slug, label").order("sort_order"),
    supabase.from("departments").select("code, name").order("code"),
  ]);
  const label = new Map((sectors ?? []).map((s) => [s.slug, s.label]));
  return (
    <>
      <PageHead
        title="Entreprises"
        description="Entreprises susceptibles d'être intéressées : découvertes automatiquement (registre public SIRENE), importées ou saisies. Chaque fiche conserve l'origine de ses données."
        action={
          <Link href="/outreach/prospects/nouveau" className={buttonClasses()}>
            <Plus className="size-4" aria-hidden /> Ajouter une entreprise
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Panel title={`${fmtN(count ?? 0)} entreprise(s)`}>
          <form className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]" role="search">
            <input name="q" defaultValue={q} placeholder="Nom, e-mail, SIREN ou code NAF" aria-label="Rechercher" className="h-10 rounded-lg border border-slate-300 px-3 text-sm" />
            <select name="departement" defaultValue={dept} aria-label="Département" className="h-10 rounded-lg border border-slate-300 px-2 text-sm">
              <option value="">Tous départements</option>
              {(departments ?? []).map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
            <select name="secteur" defaultValue={sector} aria-label="Secteur" className="h-10 rounded-lg border border-slate-300 px-2 text-sm">
              <option value="">Tous secteurs</option>
              {(sectors ?? []).map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label}
                </option>
              ))}
            </select>
            <select name="statut" defaultValue={status} aria-label="Statut" className="h-10 rounded-lg border border-slate-300 px-2 text-sm">
              <option value="">Tous statuts</option>
              {Object.entries(PROSPECT_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            <button className="h-10 rounded-lg bg-navy px-4 text-sm font-semibold text-white">Filtrer</button>
            <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2 lg:col-span-5">
              <input type="checkbox" name="email" value="1" defaultChecked={withEmail} className="size-4 accent-teal" /> Uniquement les entreprises avec e-mail
            </label>
          </form>
          {!data?.length ? (
            <EmptyState
              title="Aucune entreprise"
              description="Les entreprises sont découvertes automatiquement à partir des opportunités du jour (registre public SIRENE). Vous pouvez aussi importer un fichier ou en ajouter une manuellement."
            />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[52rem] text-sm">
                <thead className="text-left text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="py-2 pr-3 font-semibold">Entreprise</th>
                    <th className="py-2 pr-3 font-semibold">Activité</th>
                    <th className="py-2 pr-3 font-semibold">E-mail</th>
                    <th className="py-2 pr-3 font-semibold">Statut</th>
                    <th className="py-2 font-semibold">Historique</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((p) => (
                    <tr key={p.id} className="align-top hover:bg-slate-50">
                      <td className="py-3 pr-3">
                        <Link href={`/outreach/prospects/${p.id}`} className="font-semibold text-navy hover:underline">
                          {p.name}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {[p.city, p.department_code && `(${p.department_code})`].filter(Boolean).join(" ")}
                          {p.siren ? ` · SIREN ${p.siren}` : ""}
                        </p>
                      </td>
                      <td className="py-3 pr-3 text-xs text-slate-600">
                        {p.naf_code && <span className="block font-semibold">NAF {p.naf_code}</span>}
                        {p.sectors.map((s) => label.get(s) ?? s).join(", ")}
                      </td>
                      <td className="py-3 pr-3 text-xs">{p.email ?? <span className="text-amber-700">à compléter</span>}</td>
                      <td className="py-3 pr-3">
                        <StatusBadge map={PROSPECT_STATUS} status={p.status} />
                      </td>
                      <td className="py-3 text-xs text-slate-500">
                        {p.contacts_count} contact(s)
                        {p.last_contacted_at && <span className="block">dernier : {formatDate(p.last_contacted_at)}</span>}
                        {p.last_clicked_at && <span className="block text-teal-700">a cliqué le {formatDate(p.last_clicked_at)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} pageCount={Math.ceil((count ?? 0) / PER_PAGE)} basePath="/outreach/prospects" params={sp} />
        </Panel>
        <Panel title="Importer des entreprises" description="Fichier CSV d'origine légale (fichier B2B acheté, export CRM, contacts de salon…).">
          <ImportForm />
        </Panel>
      </div>
    </>
  );
}
