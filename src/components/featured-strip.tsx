import Link from "next/link";
import { Crown } from "lucide-react";
import { CompanyLogo } from "@/components/companies/company-logo";
import { visitorRpc } from "@/lib/queries/public-cache";

/**
 * « À la une » : entreprises (annuaire) ou besoins (opportunités) dont la mise en avant est en cours
 * (offre « Visibilité » en cours). Rien n'est affiché quand il n'y en a pas.
 */
export async function FeaturedStrip({ kind }: { kind: "COMPANY" | "NEED" }) {
  const { data } = await visitorRpc("public_featured", { p_kind: kind, p_limit: 3 }, { always: true });
  const list = data ?? [];
  if (!list.length) return null;
  return (
    <section aria-label="À la une" className="mb-6" data-testid={`featured-${kind.toLowerCase()}`}>
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-teal-700 uppercase">
        <Crown className="size-4" aria-hidden /> À la une
      </p>
      <ul className="grid gap-3 md:grid-cols-3">
        {list.map((f) => (
          <li key={f.id}>
            <Link
              href={kind === "NEED" && f.opportunity_id ? `/opportunites/${f.opportunity_id}` : `/entreprises/${f.slug}`}
              className="group flex h-full items-center gap-3 rounded-2xl bg-gradient-to-br from-white to-teal-50 p-4 shadow-sm ring-1 ring-teal/30 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <CompanyLogo name={f.name} path={f.logo_path} size={48} />
              <span className="min-w-0">
                <span className="line-clamp-2 font-semibold text-navy group-hover:text-teal-800">{kind === "NEED" && f.title ? f.title : f.name}</span>
                <span className="block truncate text-xs text-slate-500">
                  {kind === "NEED" ? f.name : "Entreprise inscrite"}
                  {f.city ? ` · ${f.city}` : ""}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
