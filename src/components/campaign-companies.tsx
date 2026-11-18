import Link from "next/link";
import { Megaphone } from "lucide-react";
import { CompanyLogo } from "@/components/companies/company-logo";
import { visitorRpc } from "@/lib/queries/public-cache";

/**
 * Entreprises en campagne de visibilité (d'un métier, ou toutes) : mises en avant sur les fiches d'appels
 * d'offres de leur métier et en tête des disponibilités. Rien n'est affiché quand il n'y en a pas.
 */
export async function CampaignCompanies({ sector = null, title, limit = 2 }: { sector?: string | null; title: string; limit?: number }) {
  const { data } = await visitorRpc("campaign_companies", { p_sector: sector, p_limit: limit }, { always: true });
  const list = data ?? [];
  if (!list.length) return null;
  return (
    <section aria-label={title} className="mb-5" data-testid="campaign-companies">
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-teal-700 uppercase">
        <Megaphone className="size-4" aria-hidden /> {title}
      </p>
      <ul className="grid gap-3 md:grid-cols-2">
        {list.map((c) => (
          <li key={c.id}>
            <Link
              href={`/entreprises/${c.slug}?utm_source=linkprob2b&utm_medium=mise-en-avant`}
              className="group flex h-full items-center gap-3 rounded-2xl bg-gradient-to-br from-white to-teal-50 p-4 shadow-sm ring-1 ring-teal/30 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <CompanyLogo name={c.name} path={c.logo_path} size={44} />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-navy group-hover:text-teal-800">{c.name}</span>
                <span className="line-clamp-2 text-xs text-slate-600">{c.ad_title ?? c.tagline ?? "Entreprise inscrite sur LinkProB2B"}</span>
                <span className="mt-0.5 block text-[11px] text-slate-400">Mise en avant{c.city ? ` · ${c.city}` : ""}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
