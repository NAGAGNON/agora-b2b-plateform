import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Bell,
  Briefcase,
  Building,
  Building2,
  CalendarClock,
  Cpu,
  Factory,
  Handshake,
  HardHat,
  Landmark,
  Leaf,
  MapPin,
  Megaphone,
  Search,
} from "lucide-react";
import { SearchBar } from "@/components/opportunities/search-bar";
import { TrackedButtonLink, TrackedLink } from "@/components/ui/tracked-link";
import { Notice } from "@/components/ui/notice";
import { searchOpportunities } from "@/lib/queries/opportunities";
import { parseOpportunityFilters } from "@/lib/search-params";
import { getMemberCompanies, getPlatformStats, getPublicActivity, getSectorLabels, getSectors, liveStats } from "@/lib/queries/platform";
import { MemberProof } from "@/components/home/member-proof";
import { PlatformProof } from "@/components/home/platform-proof";
import { PricingPlans } from "@/components/billing/pricing-plans";
import { cardTrial } from "@/lib/billing/card-trial";
import { Testimonials } from "@/components/home/testimonials";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { deadlineLabel, formatDate } from "@/lib/format";
import { sectorLabel } from "@/lib/constants";
import { REGIONS } from "@/lib/geo";
import { homeRegions } from "@/lib/growth/engine";
import { groupSectors } from "@/lib/sector-families";
import { SectorVisual } from "@/components/opportunities/sector-visual";
import { HeroVideo } from "@/components/home/hero-video";
import { DirectoryShowcase } from "@/components/home/directory-showcase";

export const metadata = pageMetadata({
  title: "LinkProB2B — Trouvez des opportunités B2B, gagnez du temps",
  description:
    "Appels d'offres publics et besoins d'entreprises triés pour votre métier, aide à la réponse et prospection B2B. Gagnez du temps, développez votre activité. Gratuit.",
  path: "/",
});

const FAMILY_ICONS: Record<string, typeof Factory> = {
  industrie: Factory,
  btp: HardHat,
  "energie-environnement": Leaf,
  numerique: Cpu,
  "conseil-services": Landmark,
  "services-generaux": Building,
};

export default async function HomePage(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const supabase = await createClient();
  // Base lente ou indisponible : chaque bloc a sa valeur de repli, la page s'affiche toujours
  const safe = <T, F = T>(p: PromiseLike<T>, fallback: F): Promise<T | F> => Promise.resolve(p).catch(() => fallback);
  const trial = await cardTrial().catch(() => ({ enabled: false, days: 7 }));
  const [sectors, { data: analyses }, latest, stats, { data: growth }, labels, { total: needsTotal, rows: needsRows }, memberCompanies, activity] = await Promise.all([
    safe(getSectors(), []),
    safe(supabase.from("articles").select("slug, title, published_at").eq("status", "PUBLISHED").order("published_at", { ascending: false }).limit(3), { data: null }),
    // Même calcul que la page « Explorer les opportunités » (opportunités ouvertes), trois plus récentes en aperçu
    safe(searchOpportunities(parseOpportunityFilters({ tri: "recent" }), 3), { rows: [], total: 0, error: true as const }),
    safe(getPlatformStats(), null),
    // Régions mises en avant : choisies chaque soir par la stratégie automatique (pages les plus consultées)
    safe(supabase.from("platform_settings").select("value").eq("key", "growth_public").maybeSingle(), { data: null }),
    safe(getSectorLabels(), {} as Record<string, string>),
    // Besoins d'entreprises visibles par un visiteur : sinon les liens mènent à la publication
    safe(searchOpportunities(parseOpportunityFilters({ origine: "INTERNAL", tri: "recent" }), 6), { rows: [], total: 0, error: true as const }),
    // Entreprises de l'annuaire public (choix de chaque entreprise) : bande défilante des membres
    safe(getMemberCompanies(), []),
    // Preuve sociale : acheteurs publics actifs et activité récente des entreprises inscrites
    safe(getPublicActivity(), null),
  ]);
  const live = liveStats(stats);
  // Besoins publiés directement par des entreprises inscrites : mis en avant en tête de page (vrais besoins uniquement)
  const clientNeeds = needsRows.filter((o) => !o.is_demo).slice(0, 3);
  const featuredRegions = homeRegions(growth?.value ?? null);
  const openCount = Number(latest.total);
  const preview = latest.rows.filter((o) => !o.is_demo || latest.rows.every((x) => x.is_demo));
  const families = groupSectors(sectors);
  const nf = (n: number) => n.toLocaleString("fr-FR");
  return (
    <>
      {sp.compte === "supprime" && (
        <div className="container-page pt-4">
          <Notice tone="success">Votre compte a été supprimé. Vos données personnelles ont été effacées.</Notice>
        </div>
      )}


      {/* En-tête : la promesse, les deux actions, le spot de présentation */}
      <section className="relative isolate overflow-hidden bg-gradient-to-b from-sky via-white to-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="bg-tech-grid-light absolute inset-0" />
          <div className="absolute -top-40 -right-32 size-[32rem] animate-aurora rounded-full bg-teal/20 blur-3xl" />
          <div className="absolute top-1/3 -left-40 size-[26rem] animate-aurora rounded-full bg-electric/10 blur-3xl [animation-delay:-7s]" />
        </div>
        <div className="container-page py-10 sm:py-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="inline-flex animate-rise items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold tracking-wide text-teal-700 uppercase shadow-sm ring-1 ring-slate-200">
                <span className="relative flex size-2" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-teal" />
                </span>{" "}
                {openCount ? `${nf(openCount)} opportunité${openCount > 1 ? "s" : ""} disponible${openCount > 1 ? "s" : ""} aujourd'hui partout en France` : "Opportunités B2B partout en France"}
              </p>
              <h1 className="mt-5 text-4xl leading-[1.05] font-extrabold text-navy [animation-delay:120ms] sm:text-5xl xl:text-6xl">
                <span className="word-in">
                  Trouvez des <span className="text-flow">opportunités</span>.
                </span>{" "}
                <span className="word-in [animation-delay:350ms]">Gagnez du temps.</span>{" "}
                <span className="word-in [animation-delay:700ms]">Développez votre activité.</span>
              </h1>
              <p className="mt-5 max-w-xl animate-rise text-lg text-slate-700 [animation-delay:300ms]">
                Les appels d&apos;offres publics et les besoins d&apos;entreprises de votre métier, triés pour vous. Nous vous aidons à y répondre, et nous présentons votre entreprise à celles qui peuvent devenir vos clients.
              </p>
              <div className="mt-8 flex animate-rise flex-col gap-3 [animation-delay:500ms] sm:flex-row">
                <TrackedButtonLink cta="home_hero_opportunites" href="/opportunites" size="lg" className="sm:px-8">
                  Découvrir les opportunités <ArrowRight className="size-4" aria-hidden />
                </TrackedButtonLink>
                <TrackedButtonLink cta="home_hero_besoin" href="/publier" size="lg" variant="outline">
                  Publier un besoin
                </TrackedButtonLink>
              </div>
              <p className="mt-4 animate-rise text-sm font-medium text-slate-600 [animation-delay:650ms]">
                Gratuit · Sans carte bancaire · Des opportunités partout en France ·{" "}
                <TrackedLink cta="home_hero_inscription" href="/inscription" className="font-semibold text-teal-700 underline-offset-2 hover:underline">
                  Créer mon compte gratuit
                </TrackedLink>
              </p>
            </div>

            {/* Spot de présentation (lecture automatique, musique activable) */}
            <div className="relative animate-pop [animation-delay:350ms]">
              <div aria-hidden className="absolute -inset-4 rounded-[2rem] bg-gradient-to-tr from-teal/30 via-glow/20 to-electric/20 blur-2xl" />
              <div className="relative aspect-video overflow-hidden rounded-3xl bg-navy shadow-2xl ring-1 ring-slate-200">
                <Image src="/media/spot-poster.webp" alt="" fill unoptimized priority sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
                <HeroVideo className="absolute inset-0 size-full object-cover" />
              </div>
              <div className="absolute -top-5 -left-3 hidden animate-float items-center gap-3 rounded-2xl bg-white px-4 py-3 text-navy shadow-xl ring-1 ring-slate-200 sm:flex">
                <span className="flex size-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <Bell className="size-5" aria-hidden />
                </span>
                <span className="text-sm leading-tight">
                  <strong className="block font-semibold">Alerte e-mail</strong>
                  <span className="text-slate-600">Les annonces de votre secteur</span>
                </span>
              </div>
            </div>
          </div>

          <div className="mt-12 max-w-5xl animate-rise [animation-delay:800ms]">
            <SearchBar />
          </div>
          <nav aria-label="Opportunités par région" className="mt-4 flex max-w-5xl flex-wrap gap-2 text-sm">
            {[["france", "France entière"] as const, ...featuredRegions.map((slug) => [slug, REGIONS.find((r) => r.slug === slug)?.name ?? slug] as const)].map(([slug, label]) => (
              <Link key={slug} href={`/opportunites/${slug}`} className="rounded-full bg-white px-3 py-1 font-medium text-navy shadow-sm ring-1 ring-slate-200 transition hover:bg-teal-50 hover:ring-teal">
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <Link href="/entreprises" className="group inline-flex items-center gap-2 font-semibold text-navy hover:text-teal-700">
              <Search className="size-4 text-teal-700" aria-hidden /> Je cherche un prestataire
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link href="/fournisseurs" className="group inline-flex items-center gap-2 font-semibold text-navy hover:text-teal-700">
              <Megaphone className="size-4 text-teal-700" aria-hidden /> Je propose mes services
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link href="/ingenieurs-affaires" data-testid="engineer-cta" className="group inline-flex items-center gap-2 font-semibold text-amber-800 hover:text-navy">
              <Briefcase className="size-4" aria-hidden /> Vous êtes ingénieur d&apos;affaires ?
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* Compteurs en direct (chiffres réels) et entreprises membres de l'annuaire */}
      {live ? <MemberProof initial={live} companies={memberCompanies} /> : <PlatformProof stats={stats} activity={activity} />}

      {/* Avis réels de membres (affichés à partir de 2 avis publiés, relus, avec accord) */}
      <Testimonials />

      {/* Lancement payant ouvert : les offres apparaissent sur l'accueil */}
      {trial.enabled && (
        <section aria-labelledby="offres" className="cv-auto container-page py-12 sm:py-16" data-testid="home-pricing">
          <p className="text-sm font-semibold tracking-wide text-teal-700 uppercase">Nos offres</p>
          <h2 id="offres" className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">
            {trial.days} jours pour l&apos;essayer, sans engagement
          </h2>
          <p className="mt-2 max-w-2xl text-slate-600">Rien n&apos;est débité avant la fin de l&apos;essai. Résiliable à tout moment depuis votre espace.</p>
          <PricingPlans launch={false} paidOpen trialDays={trial.days} className="mt-8" />
          <p className="mt-6 text-center text-sm">
            <Link href="/tarifs" className="font-semibold text-teal-700 hover:underline">
              Comparer les offres en détail
            </Link>
          </p>
        </section>
      )}

      {/* Besoins publiés directement par des entreprises inscrites : mis en avant */}
      {clientNeeds.length > 0 && (
        <section className="cv-auto container-page pt-12 sm:pt-16" aria-labelledby="besoins-clients" data-testid="home-client-needs">
          <div className="rounded-3xl border-2 border-teal-200 bg-gradient-to-br from-teal-50 via-white to-sky p-5 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold tracking-wide text-teal-700 uppercase">
                  <Handshake className="size-4" aria-hidden /> Besoins d&apos;entreprises
                </p>
                <h2 id="besoins-clients" className="mt-1 text-2xl font-extrabold sm:text-3xl">
                  Des entreprises cherchent un prestataire en ce moment
                </h2>
                <p className="mt-1 text-sm text-slate-600">Publiés directement sur LinkProB2B : répondez-leur sans intermédiaire.</p>
              </div>
              {Number(needsTotal) > clientNeeds.length && (
                <TrackedLink cta="home_besoins_clients_tous" href="/opportunites?origine=INTERNAL" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:underline">
                  Voir les {nf(Number(needsTotal))} besoins <ArrowRight className="size-4" aria-hidden />
                </TrackedLink>
              )}
            </div>
            <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              {clientNeeds.map((o) => {
                const deadline = deadlineLabel(o.response_deadline);
                const place = o.city ?? (o.department_code ? `Département ${o.department_code}` : null);
                return (
                  <li key={o.id} className="min-w-0">
                    <TrackedLink cta="home_besoin_client" href={`/opportunites/${o.id}`} className="group flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-300 hover:shadow-md">
                      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-800">
                        <Building2 className="size-3.5" aria-hidden /> Besoin d&apos;entreprise
                      </span>
                      <span className="mt-2 line-clamp-3 font-semibold [overflow-wrap:anywhere] text-navy group-hover:text-teal-700">{o.title}</span>
                      {o.company_name && <span className="mt-1 truncate text-sm text-slate-600">{o.company_name}</span>}
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
                      <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-teal-700">
                        Voir le besoin et répondre <ArrowRight className="size-4" aria-hidden />
                      </span>
                    </TrackedLink>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* Aperçu réel : les trois dernières opportunités publiées */}
      {preview.length > 0 && (
        <section className="cv-auto container-page pt-12 sm:pt-16" aria-labelledby="apercu">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold tracking-wide text-teal-700 uppercase">
                <span className="relative flex size-2" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-teal" />
                </span>
                En direct
              </p>
              <h2 id="apercu" className="mt-1 text-2xl font-extrabold sm:text-3xl">
                Publiées récemment sur LinkProB2B
              </h2>
            </div>
            <TrackedLink cta="home_apercu_opportunites" href="/opportunites" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:underline">
              Voir les {nf(openCount)} opportunités ouvertes <ArrowRight className="size-4" aria-hidden />
            </TrackedLink>
          </div>
          <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {preview.map((o) => {
              const by = o.origin === "EXTERNAL" ? o.external_buyer_name : o.company_name;
              const deadline = deadlineLabel(o.response_deadline);
              const place = o.city ?? (o.department_code ? `Département ${o.department_code}` : null);
              return (
                <li key={o.id} className="reveal min-w-0">
                  <Link href={`/opportunites/${o.id}`} className="group glow-card flex h-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <SectorVisual sector={o.sector_slug} className="w-24 shrink-0 sm:w-28" />
                    <span className="flex min-w-0 flex-1 flex-col p-4">
                      {o.sector_slug && <span className="text-xs font-semibold text-teal-700">{sectorLabel(o.sector_slug, labels)}</span>}
                      <span className="mt-1 line-clamp-2 font-semibold [overflow-wrap:anywhere] text-navy group-hover:text-teal-700">{o.title}</span>
                      {by && <span className="mt-1 truncate text-sm text-slate-600">{by}</span>}
                      <span className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-3 text-xs text-slate-600">
                        {place && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3.5" aria-hidden /> {place}
                          </span>
                        )}
                        {o.published_at && <span>Publiée le {formatDate(o.published_at)}</span>}
                        {deadline && (
                          <span className="inline-flex items-center gap-1 font-medium text-navy">
                            <CalendarClock className="size-3.5" aria-hidden /> {deadline}
                          </span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}



      <DirectoryShowcase />

      {/* Familles de métiers : chaque famille mène aux secteurs, puis aux opportunités */}
      <section className="cv-auto bg-canvas py-12 sm:py-16" aria-labelledby="familles">
        <div className="container-page">
          <p className="reveal text-sm font-semibold tracking-wide text-teal-700 uppercase">Par métier</p>
          <h2 id="familles" className="reveal mt-2 text-3xl font-extrabold sm:text-4xl">
            Trouvez les marchés de votre secteur
          </h2>
          <p className="reveal mt-3 max-w-2xl text-slate-700">Choisissez votre famille de métiers, puis votre secteur : vous voyez aussitôt les opportunités ouvertes qui vous concernent.</p>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {families.map(({ family, sectors: list }) => {
              const Icon = FAMILY_ICONS[family.slug] ?? Building2;
              return (
                <li key={family.slug} className="group reveal glow-card overflow-hidden rounded-2xl border border-slate-200 bg-white p-6">
                  <SectorVisual family={family.slug} className="-mx-6 -mt-6 mb-5 h-32" />
                  <span className="relative -mt-12 flex size-12 items-center justify-center rounded-xl bg-white text-teal-700 shadow-lg ring-4 ring-white">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-xl font-bold">{family.label}</h3>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {list.map((s) => (
                      <li key={s.slug}>
                        <Link
                          href={`/opportunites/${s.slug}`}
                          className="inline-flex rounded-full bg-canvas px-3 py-1.5 text-sm font-medium text-navy ring-1 ring-slate-200 transition hover:bg-teal-50 hover:ring-teal"
                        >
                          {s.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Dernières analyses de marché (liens simples) */}
      {analyses && analyses.length > 0 && (
        <section className="cv-auto container-page py-12 sm:py-16" aria-labelledby="analyses">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="analyses" className="text-2xl font-extrabold sm:text-3xl">
              Analyses des marchés
            </h2>
            <Link href="/analyses" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:underline">
              Toutes les analyses <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ul className="mt-5 grid gap-3 sm:grid-cols-3">
            {analyses.map((a) => (
              <li key={a.slug}>
                <Link href={`/analyses/${a.slug}`} className="group block h-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  {a.published_at && <p className="text-xs text-slate-500">{formatDate(a.published_at)}</p>}
                  <p className="mt-1 font-semibold text-navy group-hover:text-teal-700">{a.title}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}




      {/* Appel à l'inscription */}
      <section className="cv-auto container-page py-14 sm:py-20">
        <div className="reveal relative isolate overflow-hidden rounded-3xl bg-navy-900 px-6 py-14 text-white shadow-2xl sm:px-12 sm:py-20">
          <Image src="/images/illustrations/gratte-ciel.webp" alt="" fill unoptimized sizes="100vw" className="-z-20 object-cover" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-900 via-navy-900/90 to-navy-900/50" />
          <div aria-hidden className="absolute -right-24 -bottom-24 -z-10 size-72 animate-aurora rounded-full bg-teal/30 blur-3xl" />
          <div className="relative max-w-2xl">
            <h2 className="text-3xl font-extrabold text-white sm:text-5xl">
              Votre prochaine <span className="text-gradient">opportunité commerciale</span> commence ici.
            </h2>
            <p className="mt-4 text-slate-200">
              Créez votre profil gratuitement : secteur, zone et compétences. LinkProB2B vous recommande les opportunités correspondantes, vous alerte des
              nouvelles publications et vous aide à suivre vos démarches. Toutes les fonctionnalités sont gratuites pendant la phase de lancement.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <TrackedButtonLink cta="home_final_inscription" href="/inscription" size="lg">
                Créer mon compte gratuit
              </TrackedButtonLink>
              <TrackedButtonLink cta="home_final_besoin" href="/publier" size="lg" variant="light">
                Publier un besoin
              </TrackedButtonLink>
            </div>
            <p className="mt-4 text-sm text-slate-200">Gratuit · Sans carte bancaire · Sans engagement</p>
          </div>
        </div>
      </section>
    </>
  );
}
