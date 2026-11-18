import { CampaignCompanies } from "@/components/campaign-companies";
import Link from "next/link";
import { CalendarCheck2, Megaphone, Search } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { ServiceOfferCard } from "@/components/service-offers/service-offer-card";
import { listServiceOffers } from "@/lib/queries/service-offers";
import { getDepartments, getSectors, showDemoData } from "@/lib/queries/platform";
import { getSession } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Entreprises disponibles",
  description: "Des entreprises annoncent ce qu'elles peuvent faire, où et quand : trouvez un prestataire disponible et contactez-le par la messagerie.",
  path: "/disponibilites",
});

/** Disponibilités : les entreprises qui annoncent ce qu'elles peuvent faire (métier, zone, période). */
export default async function ServiceOffersPage(props: PageProps<"/disponibilites">) {
  const sp = await props.searchParams;
  const sector = typeof sp.metier === "string" && /^[a-z0-9-]{2,80}$/.test(sp.metier) ? sp.metier : null;
  const department = typeof sp.departement === "string" && /^[0-9AB]{2,3}$/.test(sp.departement) ? sp.departement : null;
  const [session, sectors, departments, demo] = await Promise.all([getSession(), getSectors(), getDepartments(), showDemoData()]);
  const offers = await listServiceOffers({ sector, department, demo });
  const sectorName = new Map(sectors.map((s) => [s.slug, s.label]));
  const depName = new Map(departments.map((d) => [d.code, d.name]));
  const publishHref = session ? "/disponibilites/publier" : `/inscription?suite=${encodeURIComponent("/disponibilites/publier")}`;

  return (
    <>
      <PageHero
        eyebrow="Disponibilités"
        image="/images/illustrations/poignee-de-main.webp"
        title="Des entreprises disponibles, près de chez vous"
        intro="Elles annoncent ce qu'elles peuvent faire, où et quand. Vous cherchez un prestataire ? Écrivez-leur directement par la messagerie."
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={publishHref} size="lg" className="btn-shine">
            <Megaphone className="size-4" aria-hidden /> Annoncer ma disponibilité
          </ButtonLink>
          <ButtonLink href="/publier" variant="outline" size="lg">
            Publier un besoin
          </ButtonLink>
        </div>
      </PageHero>

      <div className="container-page py-8 sm:py-12">
        <CampaignCompanies sector={sector} title="Entreprises mises en avant" limit={4} />
        <form method="get" className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-end sm:p-5" role="search" aria-label="Filtrer les disponibilités">
          <label className="flex-1 text-sm font-semibold text-navy">
            Métier
            <select name="metier" defaultValue={sector ?? ""} className="mt-1.5 block h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 focus:border-teal focus:ring-2 focus:ring-teal/30 focus:outline-none">
              <option value="">Tous les métiers</option>
              {sectors.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1 text-sm font-semibold text-navy">
            Département
            <select name="departement" defaultValue={department ?? ""} className="mt-1.5 block h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 focus:border-teal focus:ring-2 focus:ring-teal/30 focus:outline-none">
              <option value="">Toute la France</option>
              {departments.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} · {d.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-shine inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-navy px-6 font-semibold text-white transition hover:-translate-y-0.5">
            <Search className="size-4" aria-hidden /> Voir
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-500" aria-live="polite">
          {offers.length === 0 ? "Aucune disponibilité pour ces critères pour le moment." : `${offers.length} entreprise${offers.length > 1 ? "s" : ""} disponible${offers.length > 1 ? "s" : ""}`}
          {(sector || department) && (
            <>
              {" · "}
              <Link href="/disponibilites" className="font-semibold text-teal-700 underline">
                tout voir
              </Link>
            </>
          )}
        </p>

        {offers.length > 0 ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((o) => (
              <ServiceOfferCard key={o.id} offer={o} sector={o.sector_slug ? (sectorName.get(o.sector_slug) ?? null) : null} department={o.department_code ? (depName.get(o.department_code) ?? null) : null} headingLevel={2} />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-3xl bg-gradient-to-br from-sky to-white p-8 text-center ring-1 ring-slate-200 sm:p-12">
            <CalendarCheck2 className="mx-auto size-10 text-teal-700" aria-hidden />
            <p className="mt-3 font-heading text-xl font-bold text-navy">Soyez la première entreprise disponible ici</p>
            <p className="mx-auto mt-1 max-w-lg text-slate-600">Annoncez ce que vous pouvez faire : les entreprises qui cherchent un prestataire dans votre métier vous trouveront et vous écriront.</p>
            <ButtonLink href={publishHref} className="mt-5">
              Annoncer ma disponibilité
            </ButtonLink>
          </div>
        )}

        <section className="mt-12 grid gap-4 rounded-3xl bg-navy p-6 text-white sm:grid-cols-3 sm:p-8" aria-label="Comment ça marche">
          {[
            { t: "1. Vous annoncez", d: "Ce que vous pouvez faire, où et à partir de quand. En ligne tout de suite, gratuitement." },
            { t: "2. On vous trouve", d: "Les entreprises qui cherchent un prestataire voient votre disponibilité dans votre métier et votre zone." },
            { t: "3. On vous écrit", d: "Elles vous contactent par la messagerie du site. Vous êtes prévenu par e-mail." },
          ].map((x) => (
            <div key={x.t}>
              <p className="font-heading text-lg font-bold text-white">{x.t}</p>
              <p className="mt-1 text-sm text-white/75">{x.d}</p>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
