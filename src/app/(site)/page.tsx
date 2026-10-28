import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Bell,
  Briefcase,
  Building,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Cpu,
  Factory,
  FileSearch,
  Handshake,
  HardHat,
  Landmark,
  Leaf,
  ListChecks,
  MapPin,
  Megaphone,
  Search,
  SlidersHorizontal,
  Target,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { SearchBar } from "@/components/opportunities/search-bar";
import { ButtonLink } from "@/components/ui/button";
import { TrackedButtonLink, TrackedLink } from "@/components/ui/tracked-link";
import { Notice } from "@/components/ui/notice";
import { searchOpportunities } from "@/lib/queries/opportunities";
import { parseOpportunityFilters } from "@/lib/search-params";
import { getPlatformStats, getSectorLabels, getSectors } from "@/lib/queries/platform";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { deadlineLabel, formatDate } from "@/lib/format";
import { sectorLabel } from "@/lib/constants";
import { REGIONS } from "@/lib/geo";
import { homeRegions } from "@/lib/growth/engine";
import { groupSectors } from "@/lib/sector-families";
import { StatsTicker } from "@/components/home/stats-ticker";
import { SectorVisual } from "@/components/opportunities/sector-visual";
import { HeroVideo } from "@/components/home/hero-video";

export const metadata = pageMetadata({
  title: "LinkProB2B — Appels d'offres et opportunités B2B en France",
  description:
    "Appels d'offres publics (BOAMP, TED) et besoins d'entreprises partout en France : recherche par secteur et région, alertes par e-mail. Inscription gratuite.",
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
  const [sectors, { data: analyses }, latest, stats, { data: growth }, labels] = await Promise.all([
    safe(getSectors(), []),
    safe(supabase.from("articles").select("slug, title, description, published_at").eq("status", "PUBLISHED").order("published_at", { ascending: false }).limit(3), { data: null }),
    // Même calcul que la page « Explorer les opportunités » (opportunités ouvertes), trois plus récentes en aperçu
    safe(searchOpportunities(parseOpportunityFilters({ tri: "recent" }), 3), { rows: [], total: 0, error: true as const }),
    safe(getPlatformStats(), null),
    // Régions mises en avant : choisies chaque soir par la stratégie automatique (pages les plus consultées)
    safe(supabase.from("platform_settings").select("value").eq("key", "growth_public").maybeSingle(), { data: null }),
    safe(getSectorLabels(), {} as Record<string, string>),
  ]);
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

      {/* Chiffres réels de la plateforme, en bande défilante */}
      <StatsTicker stats={stats} />

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
              <h1 className="mt-5 animate-rise text-4xl leading-[1.05] font-extrabold text-navy [animation-delay:120ms] sm:text-6xl">
                Les bonnes <span className="text-gradient-dark">opportunités</span> commencent ici.
              </h1>
              <p className="mt-5 max-w-xl animate-rise text-lg text-slate-700 [animation-delay:300ms]">
                Trouvez des partenaires, découvrez des opportunités et développez votre activité.
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

      {/* Aperçu réel : les trois dernières opportunités publiées */}
      {preview.length > 0 && (
        <section className="container-page pt-12 sm:pt-16" aria-labelledby="apercu">
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

      {/* Les trois usages de LinkProB2B */}
      <section className="container-page py-12 sm:py-16" aria-labelledby="usages">
        <h2 id="usages" className="reveal max-w-3xl text-3xl font-extrabold sm:text-4xl">
          Ce que vous pouvez faire dès maintenant
        </h2>
        <ul className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            {
              icon: Target,
              title: "Identifier des opportunités commerciales",
              text: "Repérez des marchés et des opportunités correspondant à votre activité pour alimenter votre développement commercial.",
              href: "/opportunites",
              cta: "home_usage_opportunites",
              link: "Explorer les opportunités",
            },
            {
              icon: ClipboardList,
              title: "Découvrir les besoins des entreprises",
              text: "Consultez les besoins publiés par les entreprises et identifiez les occasions de proposer vos services ou vos solutions.",
              href: "/opportunites?origine=INTERNAL",
              cta: "home_usage_besoins",
              link: "Voir les besoins publiés",
            },
            {
              icon: Users,
              title: "Trouver des partenaires professionnels",
              text: "Identifiez des entreprises et des partenaires potentiels pour développer votre réseau et créer de nouvelles collaborations.",
              href: "/entreprises",
              cta: "home_usage_annuaire",
              link: "Parcourir l'annuaire",
            },
          ].map((b) => (
            <li key={b.title} className="reveal">
              <TrackedLink cta={b.cta} href={b.href} className="group glow-card flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal to-glow text-navy shadow-md shadow-teal/30 transition group-hover:scale-110">
                  <b.icon className="size-6" aria-hidden />
                </span>
                <span className="mt-5 font-heading text-xl font-bold text-navy">{b.title}</span>
                <span className="mt-2 text-slate-600">{b.text}</span>
                <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-teal-700">
                  {b.link} <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden />
                </span>
              </TrackedLink>
            </li>
          ))}
        </ul>
      </section>

      {/* Familles de métiers : chaque famille mène aux secteurs, puis aux opportunités */}
      <section className="bg-canvas py-12 sm:py-16" aria-labelledby="familles">
        <div className="container-page">
          <p className="reveal text-sm font-semibold tracking-wide text-teal-700 uppercase">Par métier</p>
          <h2 id="familles" className="reveal mt-2 text-3xl font-extrabold sm:text-4xl">
            Trouvez les marchés de votre secteur
          </h2>
          <p className="reveal mt-3 max-w-2xl text-slate-700">Choisissez votre famille de métiers, puis votre secteur : vous voyez aussitôt les opportunités ouvertes qui vous concernent.</p>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {families.map(({ family, sectors: list }, i) => {
              const Icon = FAMILY_ICONS[family.slug] ?? Building2;
              const featured = i === 0;
              return (
                <li
                  key={family.slug}
                  className={`group reveal glow-card overflow-hidden rounded-2xl p-6 ${featured ? "border border-navy bg-navy text-white sm:col-span-2 lg:col-span-1 lg:row-span-2" : "border border-slate-200 bg-white"}`}
                >
                  <SectorVisual family={family.slug} className={`-mx-6 -mt-6 mb-5 ${featured ? "h-40 lg:h-80" : "h-32"}`} />
                  <span className={`relative -mt-12 flex size-12 items-center justify-center rounded-xl shadow-lg ring-4 ${featured ? "bg-teal text-navy ring-navy" : "bg-white text-teal-700 ring-white"}`}>
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <h3 className={`mt-4 text-xl font-bold ${featured ? "text-white" : ""}`}>{family.label}</h3>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {list.map((s) => (
                      <li key={s.slug}>
                        <Link
                          href={`/opportunites/${s.slug}`}
                          className={`inline-flex rounded-full px-3 py-1.5 text-sm font-medium transition ${featured ? "bg-white/10 text-white ring-1 ring-white/20 hover:bg-teal hover:text-navy" : "bg-canvas text-navy ring-1 ring-slate-200 hover:bg-teal-50 hover:ring-teal"}`}
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

      {/* Ce qui différencie LinkProB2B d'une simple liste d'annonces */}
      <section className="relative isolate overflow-hidden bg-navy-900 py-14 text-white sm:py-20" aria-labelledby="benefices">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="bg-tech-grid absolute inset-0" />
          <div className="absolute -top-32 left-1/4 size-96 animate-aurora rounded-full bg-electric/20 blur-3xl" />
          <div className="absolute -right-24 bottom-0 size-96 animate-aurora rounded-full bg-teal/20 blur-3xl [animation-delay:-9s]" />
        </div>
        <div className="container-page">
          <p className="reveal text-sm font-semibold tracking-wide text-teal uppercase">Pourquoi LinkProB2B</p>
          <h2 id="benefices" className="reveal mt-2 max-w-3xl text-3xl font-extrabold text-white sm:text-5xl">
            Moins de temps à chercher, plus de temps pour vendre
          </h2>
          <div className="mt-10 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            <div className="reveal relative overflow-hidden rounded-3xl bg-gradient-to-br from-petrol to-navy p-8 ring-1 ring-white/10">
              <div aria-hidden className="absolute -right-16 -bottom-16 size-56 rounded-full bg-teal/25 blur-2xl" />
              <div className="relative grid items-center gap-8 md:grid-cols-[1fr_0.9fr]">
                <div>
                  <Bell className="size-8 text-teal" aria-hidden />
                  <h3 className="mt-4 text-2xl font-bold text-white">Ne ratez plus une échéance</h3>
                  <p className="mt-3 text-slate-200">
                    Indiquez vos secteurs, votre zone et quelques mots-clés : chaque nouvelle annonce qui correspond arrive dans votre boîte e-mail.
                  </p>
                  <TrackedButtonLink cta="home_benefices_alerte" href="/inscription" className="mt-6" variant="light">
                    Créer mon alerte gratuite
                  </TrackedButtonLink>
                </div>
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/15 transition duration-500 hover:rotate-0 md:rotate-2">
                  <Image src="/images/illustrations/tableau-de-bord.webp" alt="" fill unoptimized sizes="(min-width: 1024px) 25vw, 90vw" className="object-cover" />
                </div>
              </div>
            </div>
            <div className="grid gap-5">
              {[
                {
                  icon: FileSearch,
                  title: "Toutes les sources réunies au même endroit",
                  text: "Marchés publics (BOAMP, TED) et besoins publiés par les entreprises, avec le lien vers l'annonce officielle.",
                },
                {
                  icon: SlidersHorizontal,
                  title: "Trouvez plus vite ce qui vous correspond",
                  text: "Recherche par secteur, région, ville et rayon, type d'opportunité et date limite de réponse.",
                },
                {
                  icon: ListChecks,
                  title: "Suivez vos affaires jusqu'à la décision",
                  text: "Favoris pour garder les annonces intéressantes, pipeline commercial pour suivre vos démarches et vos relances.",
                },
              ].map((b) => (
                <div key={b.title} className="reveal glow-card rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                  <b.icon className="size-7 text-teal" aria-hidden />
                  <h3 className="mt-3 text-lg font-bold text-white">{b.title}</h3>
                  <p className="mt-1 text-sm text-slate-200">{b.text}</p>
                </div>
              ))}
            </div>
          </div>
          {stats && stats.regions > 0 && (
            <p className="reveal mt-8 text-slate-200">
              Aujourd&apos;hui : <strong className="text-white">{nf(stats.active)} opportunités ouvertes</strong> dans{" "}
              <strong className="text-white">{nf(stats.regions)} régions</strong> et <strong className="text-white">{nf(stats.departments)} départements</strong>, mises à jour
              chaque jour.
            </p>
          )}
          <div className="reveal mt-8">
            <TrackedButtonLink cta="home_benefices_opportunites" href="/opportunites" size="lg">
              Explorer les opportunités <ArrowRight className="size-4" aria-hidden />
            </TrackedButtonLink>
          </div>
        </div>
      </section>

      {/* Besoins des entreprises : publier et consulter */}
      <section className="container-page py-14 sm:py-20" aria-labelledby="besoins">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="reveal relative">
            <div aria-hidden className="absolute -inset-3 -rotate-2 rounded-[2rem] bg-gradient-to-br from-teal/30 via-glow/20 to-electric/20 blur-xl" />
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-xl">
              <Image src="/images/illustrations/reunion.webp" alt="" fill unoptimized sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover transition duration-700 hover:scale-105" />
            </div>
          </div>
          <div>
            <p className="reveal text-sm font-semibold tracking-wide text-teal-700 uppercase">Besoins des entreprises</p>
            <h2 id="besoins" className="reveal mt-2 text-3xl font-extrabold sm:text-5xl">
              Vous cherchez un prestataire ? Publiez votre besoin
            </h2>
            <p className="reveal mt-4 text-slate-700">
              Décrivez ce que vous cherchez une seule fois : LinkProB2B présente votre besoin aux entreprises du bon métier et de la bonne zone, qui vous
              répondent directement sur la plateforme.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {["Publication gratuite", "Relue avant diffusion", "Réponses comparables", "Vous gardez la main sur la sélection"].map((t) => (
                <li key={t} className="reveal flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-navy shadow-sm">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-teal-600" aria-hidden /> {t}
                </li>
              ))}
            </ul>
            <div className="reveal mt-8 flex flex-col gap-3 sm:flex-row">
              <TrackedButtonLink cta="home_besoins_publier" href="/publier" size="lg">
                Publier un besoin <ArrowRight className="size-4" aria-hidden />
              </TrackedButtonLink>
              <TrackedButtonLink cta="home_besoins_consulter" href="/opportunites?origine=INTERNAL" size="lg" variant="outline">
                Voir les besoins publiés
              </TrackedButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="bg-canvas py-14 sm:py-20" aria-labelledby="fonctionnement">
        <div className="container-page">
          <p className="reveal text-sm font-semibold tracking-wide text-teal-700 uppercase">En trois étapes</p>
          <h2 id="fonctionnement" className="reveal mt-2 text-3xl font-extrabold sm:text-5xl">
            Comment utiliser LinkProB2B
          </h2>
          <ol className="relative mt-12 grid gap-6 md:grid-cols-3">
            <span aria-hidden className="reveal-line absolute top-12 right-[16%] left-[16%] hidden h-0.5 bg-gradient-to-r from-teal via-glow to-amber md:block" />
            {[
              { icon: UserRoundPlus, title: "Créez votre profil", text: "Présentez votre entreprise, vos secteurs, vos compétences et votre zone d'intervention." },
              { icon: Search, title: "Recherchez ou publiez un besoin", text: "Trouvez des opportunités et des fournisseurs, ou publiez une demande de devis, une consultation ou un appel d'offres privé." },
              { icon: Handshake, title: "Échangez et développez l'opportunité", text: "Manifestez votre intérêt, répondez, échangez via la messagerie et suivez votre pipeline." },
            ].map((step, i) => (
              <li key={step.title} className="reveal glow-card relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="relative flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-navy to-petrol font-heading text-lg font-extrabold text-white shadow-lg shadow-navy/20 ring-4 ring-white">
                  {i + 1}
                </span>
                <h3 className="mt-5 flex items-start gap-2 text-lg font-bold">
                  <step.icon className="mt-1 size-5 shrink-0 text-teal-600" aria-hidden /> {step.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Dernières analyses de marché */}
      {analyses && analyses.length > 0 && (
        <section className="container-page py-16 sm:py-24" aria-labelledby="analyses">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="analyses" className="text-3xl font-extrabold">
                Analyses des marchés
              </h2>
              <p className="mt-1 text-slate-600">Chaque jour, une analyse par secteur ou département, établie à partir des avis BOAMP et TED.</p>
            </div>
            <ButtonLink href="/analyses" variant="outline">
              Toutes les analyses <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {analyses.map((a) => (
              <Link
                key={a.slug}
                href={`/analyses/${a.slug}`}
                className="group reveal glow-card flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <Image src={`/visuels/analyses/${a.slug}`} alt="" width={1200} height={630} unoptimized className="h-auto w-full border-b border-slate-100" />
                <div className="flex flex-1 flex-col p-5">
                  {a.published_at && <p className="text-xs text-slate-500">{formatDate(a.published_at)}</p>}
                  <h3 className="mt-1 font-bold text-navy group-hover:text-teal-700">{a.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm text-slate-600">{a.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Appel à l'inscription */}
      <section className="container-page py-14 sm:py-20">
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
