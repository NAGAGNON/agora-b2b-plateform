import Link from "next/link";
import { Building2, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLocationLabel, getSectorLabels, showDemoData } from "@/lib/queries/platform";
import { sectorLabel } from "@/lib/constants";
import { deadlineLabel } from "@/lib/format";

/**
 * Besoins publiés par des entreprises inscrites, mis en avant au-dessus des listes d'annonces
 * (noyés sinon parmi des milliers de marchés publics). Filtrés comme la page (secteur, zone) ;
 * rien n'est affiché s'il n'y en a pas.
 */
export async function FeaturedNeeds({ sector, department, region }: { sector?: string | null; department?: string | null; region?: string | null }) {
  const supabase = await createClient();
  let q = supabase
    .from("opportunities")
    .select("id, title, summary, sector_slug, city, department_code, response_deadline, company:companies(name)")
    .eq("origin", "INTERNAL")
    .eq("status", "PUBLISHED")
    .eq("visibility", "PUBLIC")
    .or(`response_deadline.is.null,response_deadline.gt.${new Date().toISOString()}`)
    .order("published_at", { ascending: false })
    .limit(3);
  if (!(await showDemoData())) q = q.eq("is_demo", false);
  if (sector) q = q.eq("sector_slug", sector);
  if (department) q = q.eq("department_code", department);
  else if (region) q = q.eq("region", region);
  const { data } = await q;
  if (!data?.length) return null;
  const [labels, location] = await Promise.all([getSectorLabels(), getLocationLabel()]);
  return (
    <section aria-labelledby="besoins-entreprises" className="mb-6 rounded-2xl border border-teal-200 bg-teal-50/60 p-4 sm:p-5" data-testid="featured-needs">
      <h2 id="besoins-entreprises" className="flex items-center gap-2 text-lg font-bold text-navy">
        <Building2 className="size-5 text-teal-700" aria-hidden /> Besoins publiés par des entreprises
      </h2>
      <p className="mt-1 text-sm text-slate-600">Des entreprises cherchent un prestataire : écrivez-leur directement.</p>
      <ul className="mt-3 grid gap-3 md:grid-cols-3">
        {data.map((o) => {
          const c = Array.isArray(o.company) ? o.company[0] : o.company;
          const deadline = deadlineLabel(o.response_deadline);
          return (
            <li key={o.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4">
              <Link href={`/opportunites/${o.id}`} className="font-semibold leading-snug text-navy hover:text-teal-700 [overflow-wrap:anywhere]">
                {o.title}
              </Link>
              <p className="mt-1 text-xs text-slate-500">
                {[c?.name, o.sector_slug ? sectorLabel(o.sector_slug, labels) : null, location(o.city, o.department_code)].filter(Boolean).join(" · ")}
              </p>
              {o.summary && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{o.summary}</p>}
              <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs">
                <span className="text-slate-500">{deadline ?? ""}</span>
                <Link href={`/opportunites/${o.id}?message=1`} className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline">
                  <MessageSquare className="size-3.5" aria-hidden /> Envoyer un message
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
