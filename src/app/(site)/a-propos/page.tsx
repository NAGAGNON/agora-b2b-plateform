import Link from "next/link";
import { ArrowRight, BellRing, CalendarCheck, FileCheck2, Handshake, Layers, MapPinned, RefreshCw, ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { pageMetadata } from "@/lib/seo";
import { PROMISE, SLOGAN } from "@/lib/constants";
import { getPlatformStats, getSectors } from "@/lib/queries/platform";
import { formatDateTime } from "@/lib/format";
import { SECTOR_FAMILIES } from "@/lib/sector-families";

export const metadata = pageMetadata({
  title: "À propos",
  description: "LinkProB2B en chiffres réels, son fonctionnement et ses sources : la plateforme B2B française des appels d'offres et des besoins d'entreprises.",
  path: "/a-propos",
});

const nf = (n: number) => n.toLocaleString("fr-FR");

export default async function AboutPage() {
  const [stats, sectors] = await Promise.all([getPlatformStats().catch(() => null), getSectors().catch(() => [])]);
  const figures = stats
    ? [
        { value: nf(stats.active), label: "opportunités ouvertes" },
        { value: nf(stats.new_7d), label: "ajoutées ces 7 derniers jours" },
        { value: nf(stats.departments), label: "départements couverts" },
        { value: nf(sectors.length), label: `secteurs en ${SECTOR_FAMILIES.length} familles de métiers` },
      ]
    : [];
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-navy-900 via-navy to-petrol text-white">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-teal/25 blur-3xl" />
        <div className="container-page relative py-14 sm:py-20">
          <p className="text-sm font-semibold tracking-wide text-teal uppercase">À propos</p>
          <h1 className="mt-3 max-w-3xl text-4xl leading-tight font-extrabold text-white sm:text-5xl">À propos de LinkProB2B</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-200">{SLOGAN}</p>
          <p className="mt-3 max-w-2xl text-slate-300">{PROMISE}</p>
        </div>
      </section>

      {figures.length > 0 && (
        <section className="border-b border-slate-200 bg-white" aria-labelledby="chiffres">
          <div className="container-page py-10">
            <h2 id="chiffres" className="text-sm font-bold tracking-wide text-slate-500 uppercase">
              LinkProB2B aujourd&apos;hui
            </h2>
            <dl className="mt-5 grid grid-cols-2 gap-6 lg:grid-cols-4">
              {figures.map((f) => (
                <div key={f.label} className="flex flex-col">
                  <dt className="text-sm text-slate-600">{f.label}</dt>
                  <dd className="order-first font-heading text-3xl font-extrabold text-navy tabular-nums sm:text-4xl">{f.value}</dd>
                </div>
              ))}
            </dl>
            {stats?.last_sync_at && (
              <p className="mt-5 flex items-center gap-2 text-sm text-slate-500">
                <RefreshCw className="size-4 text-teal-600" aria-hidden /> Chiffres calculés en direct sur la base, dernière collecte le {formatDateTime(stats.last_sync_at)}.
              </p>
            )}
          </div>
        </section>
      )}

      <section className="container-page py-14 sm:py-16" aria-labelledby="mission">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 id="mission" className="text-3xl font-extrabold">
              Ce que fait LinkProB2B
            </h2>
            <p className="mt-4 text-slate-700">
              LinkProB2B met en relation les entreprises qui ont un besoin avec les entreprises capables d&apos;y répondre. La plateforme réunit les appels
              d&apos;offres publics publiés sur les sources officielles et les besoins publiés directement par des entreprises, toujours identifiés avec leur
              source.
            </p>
            <p className="mt-3 text-slate-700">
              Née en Bretagne, avec une attention particulière au Finistère et aux services techniques aux entreprises, elle couvre aujourd&apos;hui toute la
              France, métropole et outre-mer, et l&apos;ensemble des secteurs d&apos;activité.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Layers, title: "Sources réunies", text: "Marchés publics (BOAMP, TED) et besoins d'entreprises au même endroit." },
              { icon: BellRing, title: "Alertes ciblées", text: "Les nouvelles annonces de votre métier et de votre zone, par e-mail." },
              { icon: Handshake, title: "Mise en relation", text: "Un besoin publié est présenté aux entreprises du bon métier." },
              { icon: MapPinned, title: "Toute la France", text: "Recherche par région, département, ville et distance." },
            ].map((b) => (
              <li key={b.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <b.icon className="size-6 text-teal-600" aria-hidden />
                <h3 className="mt-3 font-bold">{b.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{b.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-white py-14 sm:py-16" aria-labelledby="bon-a-savoir">
        <div className="container-page">
          <h2 id="bon-a-savoir" className="text-3xl font-extrabold">
            Bon à savoir
          </h2>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { icon: RefreshCw, title: "Mise à jour chaque jour", text: "Les sources officielles sont interrogées automatiquement plusieurs fois par jour ; les annonces modifiées à la source sont mises à jour." },
              { icon: CalendarCheck, title: "Seules les annonces ouvertes", text: "Une annonce dont la date limite est passée sort des résultats ; elle reste consultable pour information." },
              { icon: FileCheck2, title: "L'avis officiel fait foi", text: "Chaque opportunité externe renvoie vers son annonce d'origine. LinkProB2B ne garantit ni l'obtention d'un marché ni un résultat commercial." },
              { icon: ShieldCheck, title: "Publications modérées", text: "Les besoins publiés par les entreprises sont vérifiés avant diffusion, et chacun peut signaler un contenu." },
              { icon: BellRing, title: "Gratuit pour commencer", text: "Consultation, recherche et compte gratuits ; l'offre Pro ajoute alertes illimitées et pipeline commercial." },
              { icon: Handshake, title: "Vos données protégées", text: "Aucune donnée, statistique ou témoignage inventé ; données personnelles minimisées et désinscription en un clic." },
            ].map((b) => (
              <li key={b.title} className="flex gap-4 rounded-2xl bg-canvas p-5">
                <b.icon className="mt-0.5 size-5 shrink-0 text-teal-600" aria-hidden />
                <div>
                  <h3 className="font-bold">{b.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{b.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page py-14 sm:py-16">
        <div className="flex flex-col items-start gap-4 rounded-3xl bg-gradient-to-br from-navy-900 via-navy to-petrol p-8 text-white sm:flex-row sm:items-center sm:justify-between sm:p-12">
          <div>
            <h2 className="text-2xl font-extrabold text-white sm:text-3xl">Prêt à trouver vos prochaines opportunités ?</h2>
            <p className="mt-2 text-slate-200">
              <Link href="/comment-ca-marche" className="underline">
                Voir comment ça marche
              </Link>{" "}
              ou créez votre compte en une minute.
            </p>
          </div>
          <ButtonLink href="/inscription" size="lg">
            Créer mon compte gratuit <ArrowRight className="size-4" aria-hidden />
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
