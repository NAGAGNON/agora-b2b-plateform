import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Briefcase, CalendarClock, MapPin } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { pageMetadata } from "@/lib/seo";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/errors";
import { PUBLIC_CACHE_TAG } from "@/lib/queries/public-cache";
import { deadlineLabel } from "@/lib/format";
import { ALL_FREELANCE_TERMS, FREELANCE_TRADES, freelanceTrade } from "@/lib/freelance";
import { cn } from "@/lib/cn";
import { JsonLd, breadcrumbLd } from "@/components/json-ld";

const PER_PAGE = 30;
/** En dessous, la page de métier n'est pas proposée à Google (page trop maigre), mais reste accessible. */
const MIN_INDEXABLE = 3;

type Props = { params: Promise<{ metier?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const pageOf = (sp: Record<string, string | string[] | undefined>) => Math.max(1, Math.min(50, Number(typeof sp.page === "string" ? sp.page : 1) || 1));

/**
 * Offres publiques de la page, lues côté serveur (sans le délai de 3 s des visiteurs anonymes : la
 * recherche sur tous les métiers le frôle) et gardées 15 min. Une erreur n'est jamais mise en cache.
 */
const freelanceRows = unstable_cache(
  async (slug: string, page: number) => {
    const trade = freelanceTrade(slug || undefined);
    const { data, error } = await createAdminClient().rpc("freelance_offers", {
      p_terms: trade ? trade.terms : ALL_FREELANCE_TERMS,
      p_limit: PER_PAGE,
      p_offset: (page - 1) * PER_PAGE,
      p_include_demo: false,
      p_all_missions: !trade,
    });
    if (error) throw error;
    return data ?? [];
  },
  ["freelance-offers-v1"],
  { revalidate: 900, tags: [PUBLIC_CACHE_TAG] },
);

/** Offres de la page (la même lecture sert aux métadonnées et à la page). */
async function load(trade: ReturnType<typeof freelanceTrade>, page: number) {
  const rows = await freelanceRows(trade?.slug ?? "", page).catch((e) => {
    logServerError("freelance offers", e);
    return [];
  });
  return { rows, total: Number(rows[0]?.total_count ?? 0) };
}

async function resolve(params: Props["params"]) {
  const segs = (await params).metier ?? [];
  if (segs.length > 1) notFound();
  const trade = freelanceTrade(segs[0]);
  if (segs[0] && !trade) notFound();
  return trade;
}

export async function generateMetadata({ params, searchParams }: Props) {
  const trade = await resolve(params);
  const page = pageOf(await searchParams);
  const { total } = await load(trade, page);
  const label = trade?.label.toLowerCase();
  return pageMetadata({
    title: trade ? `Missions freelance en ${label} : offres en cours` : "Missions freelance et offres pour indépendants",
    description: trade
      ? `${total ? `${total} offre${total > 1 ? "s" : ""} en cours` : "Offres"} en ${label} pour freelances et indépendants : missions d'entreprises et marchés publics, partout en France. Alerte gratuite.`
      : "Missions freelance en traduction, graphisme, rédaction, vidéo, réalité virtuelle, e-learning, conseil : offres en cours pour indépendants, partout en France. Alerte gratuite.",
    path: trade ? `/independants/${trade.slug}` : "/independants",
    // Pages suivantes et métiers sans assez d'offres : accessibles, mais pas proposés à Google
    noindex: page > 1 || (Boolean(trade) && total < MIN_INDEXABLE),
  });
}

/**
 * Indépendants et freelances : missions courtes publiées par les entreprises inscrites, puis offres
 * en cours dans les métiers exercés par des indépendants (mot du métier dans l'intitulé). Données réelles.
 */
export default async function FreelancePage({ params, searchParams }: Props) {
  const trade = await resolve(params);
  const sp = await searchParams;
  const page = pageOf(sp);
  const { rows, total } = await load(trade, page);
  if (page > 1 && !rows.length) notFound();
  const base = trade ? `/independants/${trade.slug}` : "/independants";
  const signup = `/inscription?suite=${encodeURIComponent(base)}`;
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Accueil", path: "/" },
          { name: "Missions freelance", path: "/independants" },
          ...(trade ? [{ name: trade.label, path: base }] : []),
        ])}
      />
      <PageHero
        eyebrow="Freelances et indépendants"
        title={trade ? `Missions freelance en ${trade.label.toLowerCase()}` : "Missions freelance et offres pour indépendants"}
        intro={
          <>
            Missions courtes publiées par des entreprises, et appels d&apos;offres en cours dans votre métier. Créez votre profil en 30 secondes : vous recevez
            par e-mail les nouvelles missions de votre métier, partout en France.
          </>
        }
      >
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={signup} size="lg">
            Recevoir les missions de mon métier <ArrowRight className="size-4" aria-hidden />
          </ButtonLink>
          <ButtonLink href="/publier" size="lg" variant="outline">
            Publier une mission
          </ButtonLink>
        </div>
      </PageHero>
      <div className="container-page py-10 sm:py-14">
        <nav aria-label="Métiers" className="flex flex-wrap gap-2">
          <Link href="/independants" className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", !trade ? "border-teal bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-navy hover:border-teal")}>
            Tous les métiers
          </Link>
          {FREELANCE_TRADES.map((t) => (
            <Link
              key={t.slug}
              href={`/independants/${t.slug}`}
              aria-current={trade?.slug === t.slug ? "page" : undefined}
              className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", trade?.slug === t.slug ? "border-teal bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-navy hover:border-teal")}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <p className="mt-6 text-sm text-slate-600" data-testid="freelance-count">
          {total ? `${total.toLocaleString("fr-FR")} offre${total > 1 ? "s" : ""} en cours` : "Aucune offre en cours pour le moment"}
          {trade ? ` en ${trade.label.toLowerCase()}` : ""}.
        </p>

        {rows.length ? (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {rows.map((o) => {
              const deadline = deadlineLabel(o.response_deadline);
              const place = o.city ?? (o.department_code ? `Département ${o.department_code}` : o.region);
              return (
                <li key={o.id} className="min-w-0">
                  <Link href={`/opportunites/${o.id}`} className="group flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-teal">
                    {o.is_mission && (
                      <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-800">
                        <Briefcase className="size-3.5" aria-hidden /> Mission courte
                      </span>
                    )}
                    <span className="line-clamp-2 font-semibold [overflow-wrap:anywhere] text-navy group-hover:text-teal-700">{o.title}</span>
                    {o.buyer && <span className="mt-1 truncate text-sm text-slate-600">{o.buyer}</span>}
                    <span className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-3 text-xs text-slate-600">
                      {place && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5" aria-hidden /> {place}
                        </span>
                      )}
                      {deadline && (
                        <span className="inline-flex items-center gap-1 font-medium text-navy">
                          <CalendarClock className="size-3.5" aria-hidden /> {deadline}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<Briefcase className="size-6" aria-hidden />}
            title="Pas d'offre en cours dans ce métier aujourd'hui"
            description="Créez votre profil : vous serez prévenu par e-mail dès qu'une mission de votre métier est publiée."
            action={<ButtonLink href={signup}>Recevoir les missions de mon métier</ButtonLink>}
          />
        )}

        {total > page * PER_PAGE && (
          <div className="mt-8 text-center">
            <Link href={`${base}?page=${page + 1}`} className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline">
              Offres suivantes <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
