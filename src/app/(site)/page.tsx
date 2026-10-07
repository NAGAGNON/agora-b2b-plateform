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
} from "lucide-react";
import { SearchBar } from "@/components/opportunities/search-bar";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Notice } from "@/components/ui/notice";
import { recentOpportunities } from "@/lib/queries/opportunities";
import { getSectors } from "@/lib/queries/platform";
import { pageMetadata } from "@/lib/seo";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export const metadata = pageMetadata({
  title: "LinkProB2B — Trouvez le bon partenaire industriel en Bretagne",
  description:
    "Identifiez des fournisseurs, découvrez des besoins et développez de nouvelles opportunités commerciales. Plateforme B2B pilote en Finistère.",
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
  const [recent, sectors, { data: analyses }] = await Promise.all([
    recentOpportunities(6),
    getSectors(),
    supabase.from("articles").select("slug, title, description, published_at").eq("status", "PUBLISHED").order("published_at", { ascending: false }).limit(3),
  ]);
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
            <span className="size-2 rounded-full bg-teal" aria-hidden /> Pilote Bretagne · Finistère
          </p>
          <h1 className="mt-5 max-w-3xl text-3xl leading-tight font-extrabold text-white sm:text-5xl">
            Trouvez le bon partenaire industriel en <span className="text-teal">Bretagne</span>.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-200 sm:text-lg">
            Identifiez des fournisseurs, découvrez des besoins et développez de nouvelles opportunités commerciales.
          </p>
          <div className="mt-8 max-w-5xl">
            <SearchBar />
          </div>
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
              description="Le pilote démarre : soyez parmi les premières entreprises à publier un besoin réel."
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
          <p className="mt-1 text-slate-600">Priorité du pilote : maintenance industrielle et services techniques aux entreprises.</p>
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
          Comment ça marche
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
            "Gratuit pendant le pilote",
          ].map((t) => (
            <p key={t} className="flex items-center gap-2">
              <CheckCircle2 className="size-5 shrink-0 text-teal-600" aria-hidden /> {t}
            </p>
          ))}
        </div>
      </section>

      {/* CTA pilote */}
      <section className="container-page pb-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-navy-700 px-6 py-10 text-white sm:px-12 sm:py-14">
          <div className="absolute -right-24 -bottom-24 size-72 rounded-full bg-teal/30 blur-3xl" aria-hidden />
          <div className="relative max-w-2xl">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">Rejoignez le pilote finistérien.</h2>
            <p className="mt-3 text-slate-200">
              LinkProB2B démarre avec les entreprises de maintenance industrielle et de services techniques du Finistère. L&apos;accès est gratuit pendant
              toute la durée du pilote.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/inscription" size="lg">
                Créer un compte gratuit
              </ButtonLink>
              <ButtonLink href="/comment-ca-marche" size="lg" variant="light">
                Comment ça marche
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
