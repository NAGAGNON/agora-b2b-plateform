import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Cog,
  Cpu,
  Handshake,
  Megaphone,
  Package,
  Search,
  ShieldCheck,
  Truck,
  UserRoundPlus,
  Wrench,
  Briefcase,
  CheckCircle2,
  Zap,
  Sun,
  Building,
  Ruler,
  RadioTower,
  Sparkles,
  Lock,
  GraduationCap,
  Lightbulb,
  HardHat,
  Trees,
  Landmark,
  Megaphone as MegaphoneIcon,
  UtensilsCrossed,
  RefreshCw,
  Filter,
  Bell,
  Layers,
  CalendarX,
  Database,
} from "lucide-react";
import { SearchBar } from "@/components/opportunities/search-bar";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Notice } from "@/components/ui/notice";
import { recentOpportunities, searchOpportunities } from "@/lib/queries/opportunities";
import { parseOpportunityFilters } from "@/lib/search-params";
import { getPlatformStats, getSectors } from "@/lib/queries/platform";
import { FreshnessBar } from "@/components/opportunities/freshness";
import { pageMetadata } from "@/lib/seo";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export const metadata = pageMetadata({
  title: "LinkProB2B — Appels d'offres et opportunités B2B en France",
  description:
    "Appels d'offres publics (BOAMP, TED) et besoins d'entreprises partout en France : recherche par secteur et région, alertes par e-mail. Inscription gratuite.",
  path: "/",
});

const SECTOR_ICONS: Record<string, typeof Wrench> = {
  "maintenance-industrielle": Wrench,
  "fournitures-industrielles": Package,
  "sous-traitance-industrielle": Cog,
  informatique: Cpu,
  cybersecurite: ShieldCheck,
  "services-aux-entreprises": Briefcase,
  "transport-logistique": Truck,
  "electricite-automatisme": Zap,
  energie: Sun,
  "batiment-technique": Building,
  "ingenierie-etudes": Ruler,
  telecoms: RadioTower,
  "nettoyage-proprete": Sparkles,
  "securite-surete": Lock,
  formation: GraduationCap,
  conseil: Lightbulb,
  "travaux-btp": HardHat,
  "espaces-verts": Trees,
  "assurances-finance": Landmark,
  "communication-evenementiel": MegaphoneIcon,
  "restauration-alimentation": UtensilsCrossed,
};

export default async function HomePage(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [recent, sectors, { data: analyses }, { total: openTotal }, stats] = await Promise.all([
    recentOpportunities(6),
    getSectors(),
    supabase.from("articles").select("slug, title, description, published_at").eq("status", "PUBLISHED").order("published_at", { ascending: false }).limit(3),
    // Même calcul que la page « Explorer les opportunités » (opportunités ouvertes)
    searchOpportunities(parseOpportunityFilters({}), 1),
    getPlatformStats(),
  ]);
  const openCount = Number(openTotal);
  return (
    <>
      {sp.compte === "supprime" && (
        <div className="container-page pt-4">
          <Notice tone="success">Votre compte a été supprimé. Vos données personnelles ont été effacées.</Notice>
        </div>
      )}
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy text-white">
        <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1440 600">
          <defs>
            <linearGradient id="swoosh" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#14B8A6" stopOpacity="0.0" />
              <stop offset="0.5" stopColor="#14B8A6" stopOpacity="0.35" />
              <stop offset="1" stopColor="#14B8A6" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <path d="M0 520 C 420 600, 900 380, 1440 180 L1440 600 L0 600 Z" fill="url(#swoosh)" opacity="0.35" />
          <path d="M0 560 C 520 620, 980 460, 1440 300" stroke="#14B8A6" strokeWidth="3" fill="none" opacity="0.6" />
        </svg>
        <div className="container-page relative py-14 sm:py-20 lg:py-24">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-teal-50 uppercase ring-1 ring-white/20">
            <span className="size-2 rounded-full bg-teal" aria-hidden />{" "}
            {openCount ? `${openCount.toLocaleString("fr-FR")} opportunité${openCount > 1 ? "s" : ""} disponible${openCount > 1 ? "s" : ""} aujourd'hui partout en France` : "Opportunités B2B partout en France"}
          </p>
          <h1 className="mt-5 max-w-3xl text-3xl leading-tight font-extrabold text-white sm:text-5xl">
            La plateforme B2B pour trouver des <span className="text-teal">opportunités commerciales</span> et des partenaires.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-200 sm:text-lg">
            Découvrez chaque jour de nouvelles opportunités, appels d&apos;offres, besoins d&apos;entreprises et partenaires partout en France.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/opportunites" size="lg">
              Découvrir les opportunités
            </ButtonLink>
            <ButtonLink href="/inscription" size="lg" variant="light">
              Créer mon profil gratuit
            </ButtonLink>
          </div>
          <div className="mt-8 max-w-5xl">
            <SearchBar />
          </div>
          <nav aria-label="Opportunités par région" className="mt-4 flex max-w-5xl flex-wrap gap-2 text-sm">
            {[
              ["france", "France entière"],
              ["bretagne", "Bretagne"],
              ["ile-de-france", "Île-de-France"],
              ["auvergne-rhone-alpes", "Auvergne-Rhône-Alpes"],
              ["nouvelle-aquitaine", "Nouvelle-Aquitaine"],
              ["occitanie", "Occitanie"],
              ["hauts-de-france", "Hauts-de-France"],
              ["provence-alpes-cote-d-azur", "Provence-Alpes-Côte d'Azur"],
            ].map(([slug, label]) => (
              <Link key={slug} href={`/opportunites/${slug}`} className="rounded-full bg-white/10 px-3 py-1 font-medium text-white ring-1 ring-white/20 hover:bg-white/20">
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 grid max-w-3xl gap-3 sm:grid-cols-2">
            <Link href="/entreprises" className="group flex items-center gap-3 rounded-xl bg-white/10 p-4 ring-1 ring-white/15 transition hover:bg-white/15">
              <span className="flex size-10 items-center justify-center rounded-lg bg-teal text-navy">
                <Search className="size-5" aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">Je cherche un prestataire</span>
                <span className="text-sm text-slate-300">Annuaire et publication de besoin</span>
              </span>
              <ArrowRight className="size-5 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link href="/fournisseurs" className="group flex items-center gap-3 rounded-xl bg-white/10 p-4 ring-1 ring-white/15 transition hover:bg-white/15">
              <span className="flex size-10 items-center justify-center rounded-lg bg-white text-navy">
                <Megaphone className="size-5" aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">Je propose mes services</span>
                <span className="text-sm text-slate-300">Opportunités, alertes et pipeline</span>
              </span>
              <ArrowRight className="size-5 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* Activité de la plateforme : chiffres réels */}
      {stats && stats.active > 0 && (
        <section className="border-b border-slate-200 bg-white" aria-label="Activité de la plateforme">
          <div className="container-page py-6">
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: "opportunités ouvertes", value: stats.active },
                { label: "ajoutées ces 7 derniers jours", value: stats.new_7d },
                { label: "régions couvertes", value: stats.regions },
                { label: "départements couverts", value: stats.departments },
              ].map((k) => (
                <div key={k.label} className="flex flex-col">
                  <dt className="text-sm text-slate-600">{k.label}</dt>
                  <dd className="order-first font-heading text-2xl font-bold text-navy tabular-nums sm:text-3xl">{k.value.toLocaleString("fr-FR")}</dd>
                </div>
              ))}
            </dl>
            <FreshnessBar stats={stats} className="mt-4" />
          </div>
        </section>
      )}

      {/* Pour qui ? */}
      <section className="container-page py-14 sm:py-16" aria-labelledby="pour-qui">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div>
            <h2 id="pour-qui" className="text-2xl font-bold sm:text-3xl">
              Une plateforme B2B pour développer votre activité
            </h2>
            <p className="mt-3 text-slate-600">
              LinkProB2B centralise les opportunités commerciales — appels d&apos;offres publics, consultations et besoins publiés par des entreprises —
              et facilite la mise en relation entre entreprises. Vous recherchez, filtrez et suivez les opportunités qui correspondent à votre activité,
              puis échangez directement avec les entreprises.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/opportunites">Découvrir les opportunités</ButtonLink>
              <ButtonLink href="/entreprises" variant="outline">
                Trouver un prestataire
              </ButtonLink>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-wide text-slate-500 uppercase">Pour qui ?</h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                "PME et TPE",
                "Indépendants",
                "Fournisseurs",
                "Prestataires de services",
                "Industriels et sous-traitants",
                "Entreprises du BTP",
                "Entreprises de services et du numérique",
                "Entreprises qui cherchent des partenaires",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-navy">
                  <CheckCircle2 className="size-4 shrink-0 text-teal-600" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Actualisation quotidienne */}
      <section className="bg-sky py-14 sm:py-16" aria-labelledby="actualisation">
        <div className="container-page">
          <h2 id="actualisation" className="text-2xl font-bold sm:text-3xl">
            Des opportunités actualisées chaque jour
          </h2>
          <p className="mt-1 max-w-3xl text-slate-600">
            Chaque matin, LinkProB2B interroge automatiquement ses sources officielles et met la base à jour. Les résultats affichés sont donc toujours
            des opportunités ouvertes.
          </p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Database, title: "Collecte", text: "Les opportunités sont collectées depuis des sources officielles (BOAMP, TED) et publiées par les entreprises inscrites." },
              { icon: Layers, title: "Normalisation et dédoublonnage", text: "Un même marché publié sur plusieurs sources n'apparaît qu'une fois, avec toutes ses sources." },
              { icon: CalendarX, title: "Expiration", text: "Les opportunités dont la date limite est passée sont retirées des résultats actifs (l'historique reste consultable)." },
              { icon: RefreshCw, title: "Ajout quotidien", text: "Les nouvelles opportunités sont ajoutées automatiquement, et les annonces modifiées à la source sont mises à jour." },
              { icon: Filter, title: "Recherche", text: "Vous filtrez par secteur, région, département, ville, type, date limite ou source pour trouver celles qui vous concernent." },
              { icon: Bell, title: "Alertes et recommandations", text: "Avec votre profil, recevez les opportunités adaptées à votre activité par e-mail et dans votre espace." },
            ].map((step, i) => (
              <li key={step.title} className="rounded-2xl border border-white bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-navy font-heading text-sm font-bold text-white">{i + 1}</span>
                  <step.icon className="size-5 text-teal-600" aria-hidden />
                </div>
                <h3 className="mt-3 font-bold">{step.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-xs text-slate-700">
            Les opportunités externes renvoient toujours vers l&apos;annonce officielle, qui fait foi. LinkProB2B ne garantit ni l&apos;obtention d&apos;un
            marché ni un résultat commercial.
          </p>
        </div>
      </section>

      {/* Opportunités récentes */}
      <section className="container-page py-14 sm:py-16" aria-labelledby="recentes">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="recentes" className="text-2xl font-bold sm:text-3xl">
              Opportunités récentes
            </h2>
            <p className="mt-1 text-slate-600">Besoins publiés sur LinkProB2B et opportunités externes référencées, toujours identifiées.</p>
          </div>
          <ButtonLink href="/opportunites" variant="outline">
            Toutes les opportunités <ArrowRight className="size-4" aria-hidden />
          </ButtonLink>
        </div>
        <div className="mt-8">
          {recent.length === 0 ? (
            <EmptyState
              title="Aucune opportunité publiée pour le moment"
              description="Soyez parmi les premières entreprises à publier un besoin."
              action={<ButtonLink href="/publier">Publier un besoin</ButtonLink>}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((o) => (
                <OpportunityCard key={o.id} o={o} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Dernières analyses de marché */}
      {analyses && analyses.length > 0 && (
        <section className="container-page pb-14 sm:pb-16" aria-labelledby="analyses">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="analyses" className="text-2xl font-bold sm:text-3xl">
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
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-teal hover:shadow-md"
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

      {/* Secteurs */}
      <section className="bg-sky py-14 sm:py-16" aria-labelledby="secteurs">
        <div className="container-page">
          <h2 id="secteurs" className="text-2xl font-bold sm:text-3xl">
            Secteurs
          </h2>
          <p className="mt-1 text-slate-600">Industrie, services techniques, numérique, bâtiment… trouvez les opportunités de votre métier.</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {sectors.map((s, i) => {
              const Icon = SECTOR_ICONS[s.slug] ?? Building2;
              return (
                <li key={s.slug}>
                  <Link
                    href={`/opportunites/${s.slug}`}
                    className="flex h-full items-center gap-3 rounded-xl border border-white bg-white p-4 shadow-sm transition hover:border-teal hover:shadow-md"
                  >
                    <span className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${i === 0 ? "bg-teal text-navy" : "bg-sky text-navy"}`}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="font-semibold text-navy">{s.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="container-page py-14 sm:py-16" aria-labelledby="fonctionnement">
        <h2 id="fonctionnement" className="text-2xl font-bold sm:text-3xl">
          Comment utiliser LinkProB2B
        </h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { icon: UserRoundPlus, title: "Créez votre profil", text: "Présentez votre entreprise, vos secteurs, vos compétences et votre zone d'intervention." },
            { icon: Search, title: "Recherchez ou publiez un besoin", text: "Trouvez des opportunités et des fournisseurs, ou publiez une demande de devis, une consultation ou un appel d'offres privé." },
            { icon: Handshake, title: "Échangez et développez l'opportunité", text: "Manifestez votre intérêt, répondez, échangez via la messagerie et suivez votre pipeline." },
          ].map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-navy font-heading font-bold text-white">{i + 1}</span>
                <step.icon className="size-6 text-teal-600" aria-hidden />
              </div>
              <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{step.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 grid gap-3 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
          {[
            "Provenance toujours affichée",
            "Opportunités externes redirigées vers la source",
            "Publications modérées avant diffusion",
            "Consultation et recherche gratuites",
          ].map((t) => (
            <p key={t} className="flex items-center gap-2">
              <CheckCircle2 className="size-5 shrink-0 text-teal-600" aria-hidden /> {t}
            </p>
          ))}
        </div>
      </section>

      {/* Appel à l'inscription */}
      <section className="container-page pb-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-navy-700 px-6 py-10 text-white sm:px-12 sm:py-14">
          <div className="absolute -right-24 -bottom-24 size-72 rounded-full bg-teal/30 blur-3xl" aria-hidden />
          <div className="relative max-w-2xl">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">Recevez les opportunités adaptées à votre activité.</h2>
            <p className="mt-3 text-slate-200">
              Créez votre profil gratuitement : secteur, zone et compétences. LinkProB2B vous recommande alors les opportunités correspondantes et vous
              alerte des nouvelles publications. Passez à Pro pour les alertes illimitées, les recommandations complètes et le pipeline commercial.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/inscription" size="lg">
                Recevoir mes opportunités
              </ButtonLink>
              <ButtonLink href="/tarifs" size="lg" variant="light">
                Découvrir LinkProB2B Pro
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
