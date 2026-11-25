import Link from "next/link";
import { Medal } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { JsonLd, breadcrumbLd } from "@/components/json-ld";
import { AwardList } from "@/components/awards/award-list";
import { AlertLeadForm } from "@/components/alert-lead-form";
import { REGIONS } from "@/lib/geo";
import type { AwardItem, TopWinner } from "@/lib/queries/awards";

const nf = new Intl.NumberFormat("fr-FR");

/**
 * Classement « qui gagne les marchés publics de [métier] en [région] » : calculé uniquement sur les avis
 * d'attribution publiés au BOAMP sur 12 mois (aucun chiffre inventé), suivi des derniers marchés attribués.
 */
export function RankingPage({
  heading,
  intro,
  crumbs,
  winners,
  latest,
  sector,
  sectorSlug,
  regionName,
  links,
}: {
  heading: string;
  intro: string;
  crumbs: { name: string; path: string }[];
  winners: TopWinner[];
  latest: AwardItem[];
  sector: string | null;
  sectorSlug: string | null;
  regionName: string | null;
  links: { href: string; label: string }[];
}) {
  const path = crumbs.at(-1)!.path;
  return (
    <>
      <JsonLd data={breadcrumbLd(crumbs)} />
      {winners.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: heading,
            itemListOrder: "https://schema.org/ItemListOrderDescending",
            itemListElement: winners.slice(0, 20).map((w, i) => ({ "@type": "ListItem", position: i + 1, name: w.winner_name, url: `/titulaires/${w.winner_key}` })),
          }}
        />
      )}
      <PageHero eyebrow="Résultats des marchés publics" image="/images/illustrations/gratte-ciel.webp" title={heading} intro={intro} />
      <div className="container-page py-10 sm:py-14">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-slate-500">
          {crumbs.map((c, i) =>
            i < crumbs.length - 1 ? (
              <span key={c.path}>
                <Link href={c.path} className="hover:underline">
                  {c.name}
                </Link>{" "}
                /{" "}
              </span>
            ) : (
              <span key={c.path} className="text-navy">
                {c.name}
              </span>
            ),
          )}
        </nav>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-10">
            {winners.length > 0 && (
              <section aria-labelledby="classement">
                <h2 id="classement" className="text-xl font-bold text-navy">
                  Les entreprises qui ont remporté le plus de marchés (12 derniers mois)
                </h2>
                <ol className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                  {winners.map((w, i) => (
                    <li key={w.winner_key} className="flex items-center gap-4 p-4">
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${i < 3 ? "bg-teal text-navy" : "bg-slate-100 text-slate-600"}`}>
                        {i < 3 ? <Medal className="size-4" aria-label={`${i + 1}`} /> : i + 1}
                      </span>
                      <Link href={`/titulaires/${w.winner_key}`} className="min-w-0 flex-1 font-semibold text-navy hover:text-teal-700 hover:underline [overflow-wrap:anywhere]">
                        {w.winner_name}
                      </Link>
                      <span className="shrink-0 text-sm text-slate-600">
                        {nf.format(Number(w.awards))} marché{Number(w.awards) > 1 ? "s" : ""}
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-xs text-slate-500">Classement calculé sur les avis d&apos;attribution publiés au BOAMP (données publiques). Les entrepreneurs individuels n&apos;y figurent pas.</p>
              </section>
            )}
            {latest.length > 0 && (
              <section aria-labelledby="derniers">
                <h2 id="derniers" className="mb-4 text-xl font-bold text-navy">
                  Derniers marchés attribués
                </h2>
                <AwardList awards={latest} />
              </section>
            )}
          </div>
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <AlertLeadForm
              label={sector ? sector.toLowerCase() : "votre métier"}
              sector={sectorSlug}
              department={null}
              region={regionName}
              path={path}
              title="Recevoir les prochains appels d'offres, gratuitement"
              compact
            />
            {links.length > 0 && (
              <nav aria-label="Autres classements" className="rounded-2xl bg-white p-5 text-sm ring-1 ring-slate-200">
                <h2 className="text-base font-bold text-navy">Voir aussi</h2>
                <ul className="mt-3 space-y-2">
                  {links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-teal-800 hover:underline">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

export const regionBySlugOrNull = (slug: string) => REGIONS.find((r) => r.slug === slug) ?? null;
