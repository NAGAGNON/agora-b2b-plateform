import Link from "next/link";
import { ArrowRight, Bell, CalendarClock, Handshake, KanbanSquare, Landmark, LineChart, MapPin, Sparkles, Star } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Ingénieurs d'affaires : détectez et qualifiez vos appels d'offres B2B",
  description:
    "Veille des appels d'offres (BOAMP, TED) et besoins d'entreprises par secteur et zone, échéances dans votre agenda, pipeline avec relances, acheteurs publics et partenaires de co-traitance.",
  path: "/ingenieurs-affaires",
});

const SHORTCUTS = [
  { href: "/opportunites?tri=deadline", label: "Échéances les plus proches" },
  { href: "/opportunites?publiee=7", label: "Publiées ces 7 derniers jours" },
  { href: "/opportunites?secteur=ingenierie-etudes", label: "Ingénierie et études" },
  { href: "/opportunites?secteur=maintenance-industrielle", label: "Maintenance industrielle" },
  { href: "/opportunites?secteur=electricite-automatisme", label: "Électricité et automatisme" },
  { href: "/opportunites?secteur=informatique", label: "Informatique" },
  { href: "/opportunites?secteur=batiment-technique", label: "Bâtiment technique" },
  { href: "/opportunites?secteur=energie", label: "Énergie" },
];

const STEPS = [
  {
    icon: MapPin,
    title: "1. Détecter sur votre territoire",
    text: "Recherche par mots-clés, secteur, région, département ou ville avec un rayon en kilomètres, type d'opportunité et date limite.",
    href: "/opportunites",
    cta: "Lancer une recherche",
  },
  {
    icon: Bell,
    title: "2. Ne plus rien rater",
    text: "Alertes sur vos critères et veille par e-mail (lundi et vendredi, ou chaque jour) avec les nouvelles opportunités de vos secteurs et zones.",
    href: "/dashboard/veille",
    cta: "Régler ma veille",
  },
  {
    icon: Sparkles,
    title: "3. Prioriser",
    text: "Recommandations expliquées selon le profil de votre entreprise (secteur, zone, compétences communes) et favoris pour votre short-list.",
    href: "/dashboard/recommandations",
    cta: "Voir mes recommandations",
  },
  {
    icon: CalendarClock,
    title: "4. Tenir les échéances",
    text: "Sur chaque opportunité ouverte : « Ajouter l'échéance à mon agenda » (Outlook, Google, Apple) avec rappels 7 jours (go / no go) et 2 jours avant.",
    href: "/opportunites?tri=deadline",
    cta: "Voir les échéances proches",
  },
  {
    icon: KanbanSquare,
    title: "5. Piloter votre pipeline",
    text: "De la détection au résultat (gagnée ou perdue) : notes, valeur estimée et date de relance pour chaque affaire. Inclus dans les offres Pro et Business.",
    href: "/dashboard/pipeline",
    cta: "Ouvrir mon pipeline",
  },
  {
    icon: Landmark,
    title: "6. Connaître vos acheteurs",
    text: "Communes, départements, régions, hôpitaux : retrouvez les appels d'offres en cours de chaque acheteur public pour préparer vos rendez-vous.",
    href: "/acheteurs",
    cta: "Parcourir les acheteurs",
  },
  {
    icon: Handshake,
    title: "7. Trouver des co-traitants",
    text: "Annuaire des entreprises par secteur et zone pour monter un groupement ou trouver un sous-traitant sur un lot.",
    href: "/entreprises",
    cta: "Chercher un partenaire",
  },
  {
    icon: LineChart,
    title: "8. Lire le marché",
    text: "Analyses des marchés par secteur et région, construites à partir des annonces publiées, pour orienter votre prospection.",
    href: "/analyses",
    cta: "Lire les analyses",
  },
];

export default function BusinessEngineersPage() {
  return (
    <>
      <section className="bg-navy text-white">
        <div className="container-page py-12 sm:py-16">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-teal-50 uppercase ring-1 ring-white/20">
            <Star className="size-3.5" aria-hidden /> Espace ingénieurs d&apos;affaires
          </p>
          <h1 className="mt-4 max-w-3xl text-3xl leading-tight font-extrabold text-white sm:text-5xl">
            Vous êtes ingénieur d&apos;affaires ? <span className="text-teal">Passez moins de temps à chercher</span>, plus à répondre.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-200 sm:text-lg">
            Appels d&apos;offres publics (BOAMP, TED) et besoins d&apos;entreprises réunis au même endroit, filtrés sur vos secteurs et votre zone, avec les
            échéances dans votre agenda et un pipeline pour suivre vos affaires.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/inscription" size="lg">
              Créer mon compte gratuit
            </ButtonLink>
            <ButtonLink href="/opportunites?tri=deadline" size="lg" variant="light">
              Voir les échéances proches
            </ButtonLink>
          </div>
          <nav aria-label="Recherches rapides" className="mt-6 flex flex-wrap gap-2 text-sm">
            {SHORTCUTS.map((s) => (
              <Link key={s.href} href={s.href} className="rounded-full bg-white/10 px-3 py-1 font-medium text-white ring-1 ring-white/20 hover:bg-white/20">
                {s.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <section className="container-page py-12">
        <h2 className="text-2xl font-bold text-navy sm:text-3xl">Vos outils, étape par étape</h2>
        <p className="mt-2 max-w-2xl text-slate-600">Du repérage d&apos;un marché au suivi de la réponse, sans changer d&apos;outil.</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="engineer-tools">
          {STEPS.map((s) => (
            <li key={s.title} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="flex size-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <s.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-3 font-heading text-lg font-bold text-navy">{s.title}</h3>
              <p className="mt-2 flex-1 text-sm text-slate-600">{s.text}</p>
              <Link href={s.href} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:underline">
                {s.cta} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-slate-200 bg-sky/40">
        <div className="container-page py-10">
          <h2 className="text-xl font-bold text-navy">Ce qu&apos;il faut savoir</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Recherche, consultation et alertes de base gratuites, sans carte bancaire.</li>
            <li>Les appels d&apos;offres externes renvoient toujours vers leur source officielle : c&apos;est elle qui fait foi.</li>
            <li>Pas de « leads garantis » : nous vous aidons à repérer et organiser, la réponse reste la vôtre.</li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/inscription">Créer mon compte gratuit</ButtonLink>
            <ButtonLink href="/tarifs" variant="outline">
              Voir les tarifs
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
