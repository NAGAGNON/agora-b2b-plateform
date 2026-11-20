import Link from "next/link";
import { ArrowRight, MapPin, Sparkles } from "lucide-react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { searchOpportunities } from "@/lib/queries/opportunities";
import { getDepartments } from "@/lib/queries/platform";
import { REGIONS } from "@/lib/geo";
import { formatDate } from "@/lib/format";
import type { OpportunityFilters, RawSearchParams } from "@/lib/search-params";

/**
 * « Pour vous » en tête des résultats : quand un membre cherche dans toute la France, les offres de sa
 * zone (département de son entreprise, puis sa région) sont montrées d'abord, avec un lien pour filtrer.
 * Sans mot-clé ni secteur choisi, le métier de l'entreprise est utilisé.
 */
export async function ForYouBlock({ filters, rawParams, basePath }: { filters: OpportunityFilters; rawParams: RawSearchParams; basePath: string }) {
  if (filters.page > 1 || filters.department || filters.region || filters.city || filters.place) return null;
  const session = await getSession();
  const company = session?.activeCompany?.company as { id: string; department_code?: string | null } | undefined;
  if (!company) return null;
  const supabase = await createClient();
  const [{ data: c }, { data: prof }, departments] = await Promise.all([
    supabase.from("companies").select("department_code").eq("id", company.id).maybeSingle(),
    supabase.from("company_profiles").select("sectors").eq("company_id", company.id).maybeSingle(),
    getDepartments(),
  ]);
  const dep = departments.find((d) => d.code === c?.department_code);
  if (!dep) return null;
  const region = REGIONS.find((r) => r.name === dep.region) ?? null;
  const sector = filters.sector ?? (!filters.q ? (prof?.sectors?.[0] ?? undefined) : undefined);
  const base = { ...filters, sector, page: 1 };
  const [local, regional] = await Promise.all([
    searchOpportunities({ ...base, department: dep.code }, 3),
    region ? searchOpportunities({ ...base, region: region.slug }, 1) : null,
  ]);
  if (local.error || (local.total === 0 && !(regional?.total))) return null;

  const href = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(rawParams)) if (typeof v === "string" && k !== "page") p.set(k, v);
    if (sector && !filters.sector) p.set("secteur", sector);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return `${basePath}?${p.toString()}`;
  };
  const plural = (n: number) => `${n} offre${n > 1 ? "s" : ""}`;

  return (
    <section className="mt-4 rounded-3xl bg-gradient-to-br from-teal-50 to-sky p-5 ring-1 ring-teal/25" data-testid="for-you" aria-label="Offres près de chez vous">
      <p className="flex items-center gap-2 font-heading text-lg font-bold text-navy">
        <Sparkles className="size-5 text-teal-600" aria-hidden /> Pour vous, près de chez vous
      </p>
      <p className="mt-1 text-sm text-slate-600">
        {local.total > 0 ? (
          <>
            <strong className="text-navy">{plural(local.total)}</strong> dans le département {dep.name} ({dep.code})
          </>
        ) : (
          <>Aucune offre en ce moment dans le département {dep.name}</>
        )}
        {region && regional && regional.total > 0 && (
          <>
            {" "}
            et <strong className="text-navy">{plural(regional.total)}</strong> en {region.name}
          </>
        )}
        .
      </p>
      {local.rows.length > 0 && (
        <ul className="mt-3 space-y-2">
          {local.rows.map((o) => (
            <li key={o.id}>
              <Link href={`/opportunites/${o.id}`} className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200 transition hover:ring-teal/50">
                <MapPin className="mt-0.5 size-4 shrink-0 text-teal-600" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-semibold text-navy">{o.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {[o.city, o.response_deadline ? `Date limite : ${formatDate(o.response_deadline)}` : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <ArrowRight className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {local.total > 0 && (
          <Link href={href({ departement: dep.code })} className="inline-flex items-center gap-1.5 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90">
            Voir les {plural(local.total)} du département {dep.name}
          </Link>
        )}
        {region && regional && regional.total > 0 && (
          <Link href={href({ region: region.slug })} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-navy ring-1 ring-slate-300 hover:ring-teal/50">
            Voir les {plural(regional.total)} en {region.name}
          </Link>
        )}
      </div>
    </section>
  );
}
