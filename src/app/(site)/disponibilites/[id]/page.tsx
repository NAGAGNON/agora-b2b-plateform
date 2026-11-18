import { freeLaunch } from "@/lib/billing/entitlements";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BadgeCheck, CalendarCheck2, Lock, MapPin, PenLine, Tag, Users } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getServiceOffer } from "@/lib/queries/service-offers";
import { getDepartments, getSectors, showDemoData } from "@/lib/queries/platform";
import { availabilityLabel, offerState, zoneLabel } from "@/lib/service-offers-core";
import { CompanyLogo } from "@/components/companies/company-card";
import { ContactOfferForm } from "@/components/service-offers/offer-actions";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { DemoBadge } from "@/components/demo";
import { isUuid, clip, formatDate } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(props: PageProps<"/disponibilites/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const o = isUuid(id) ? await getServiceOffer(id) : null;
  if (!o) return { title: "Disponibilité introuvable", robots: { index: false } };
  return pageMetadata({
    title: `${o.title} — ${o.company?.name ?? "entreprise"} disponible`,
    description: clip(o.description.replace(/\s+/g, " "), 155),
    path: `/disponibilites/${o.id}`,
    noindex: o.is_demo || o.status !== "PUBLISHED",
  });
}

/** Une disponibilité : qui, quoi, où, quand, et un seul bouton pour écrire à l'entreprise. */
export default async function ServiceOfferPage(props: PageProps<"/disponibilites/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!isUuid(id)) notFound();
  const [o, session, sectors, departments] = await Promise.all([getServiceOffer(id), getSession(), getSectors(), getDepartments()]);
  if (!o || (o.is_demo && !(await showDemoData()))) notFound();
  const mine = Boolean(session?.memberships.some((m) => m.company.id === o.company_id));
  const state = offerState(o);
  // Hors ligne : visible seulement par son entreprise et l'équipe
  if (state !== "online" && !mine && !session?.isStaff) notFound();
  const sector = o.sector_slug ? (sectors.find((s) => s.slug === o.sector_slug)?.label ?? null) : null;
  const dep = o.department_code ? (departments.find((d) => d.code === o.department_code)?.name ?? null) : null;
  const facts = [
    { icon: CalendarCheck2, label: "Quand", value: availabilityLabel(o.available_from, o.available_until) },
    { icon: MapPin, label: "Où", value: zoneLabel(o, dep) },
    sector && { icon: Tag, label: "Métier", value: sector },
    o.capacity && { icon: Users, label: "Moyens", value: o.capacity },
  ].filter(Boolean) as { icon: typeof MapPin; label: string; value: string }[];

  return (
    <div className="bg-slate-50/60">
      <div className="container-page py-6 sm:py-10">
        <nav aria-label="Fil d'Ariane" className="mb-4 text-sm text-slate-500">
          <Link href="/disponibilites" className="hover:underline">
            Disponibilités
          </Link>
          {sector && o.sector_slug && (
            <>
              {" / "}
              <Link href={`/disponibilites?metier=${o.sector_slug}`} className="hover:underline">
                {sector}
              </Link>
            </>
          )}
        </nav>
        <div className="mx-auto max-w-3xl space-y-4">
          {sp.publiee === "1" && mine && (
            <Notice tone="success" title="Votre disponibilité est en ligne">
              Les entreprises qui cherchent un prestataire peuvent maintenant vous écrire. Vous serez prévenu par e-mail. Retrouvez-la dans{" "}
              <Link href="/dashboard/disponibilites" className="font-semibold underline">
                Mes disponibilités
              </Link>
              .
            </Notice>
          )}
          {sp.publiee === "1" && mine && (
            <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-navy to-teal-800 p-5 text-white shadow-lg sm:flex-row sm:items-center" data-testid="campaign-cta">
              <p className="flex-1 text-sm">
                <strong className="block text-base">Faites-la connaître : on fait votre prospection pour vous</strong>
                Votre entreprise présentée chaque jour aux entreprises de votre métier et de votre zone.{(await freeLaunch()) ? " Gratuit pendant le lancement." : ""}
              </p>
              <Link href="/dashboard/visibilite" className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-teal px-4 text-sm font-bold text-navy shadow-md">
                Lancer ma campagne
              </Link>
            </div>
          )}
          {state !== "online" && (
            <Notice tone="warning" title={state === "removed" ? "Retirée par la modération" : state === "archived" ? "Retirée du site" : "Expirée"}>
              {state === "removed" ? (o.removed_reason ?? "Cette disponibilité n'est plus visible.") : "Cette disponibilité n'est plus visible sur le site. Vous pouvez la remettre en ligne depuis « Mes disponibilités »."}
            </Notice>
          )}

          <article className="relative isolate overflow-hidden rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 [overflow-wrap:anywhere] sm:p-9">
            <div aria-hidden className="pointer-events-none absolute -top-28 -right-24 -z-10 size-72 animate-aurora rounded-full bg-teal/15 blur-3xl" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold tracking-wide text-teal-800 uppercase ring-1 ring-teal/30">
                <span className="size-1.5 animate-pulse rounded-full bg-teal" aria-hidden /> Disponible
              </span>
              {o.is_demo && <DemoBadge />}
            </div>
            <h1 className="mt-4 font-heading text-[1.4rem] leading-tight font-extrabold text-balance text-navy sm:text-3xl">{o.title}</h1>
            {o.company && (
              <Link href={`/entreprises/${o.company.slug}`} className="mt-4 inline-flex items-center gap-3 rounded-2xl p-1.5 pr-4 transition hover:bg-sky">
                <CompanyLogo name={o.company.name} path={o.company.logo_path} size={44} />
                <span>
                  <span className="flex items-center gap-1 font-semibold text-navy">
                    {o.company.name}
                    {o.company.verified_at && <BadgeCheck className="size-4 text-teal-600" aria-label="Entreprise vérifiée" />}
                  </span>
                  <span className="block text-xs text-slate-500">Voir la fiche de l&apos;entreprise</span>
                </span>
              </Link>
            )}
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {facts.map(({ icon: Icon, label, value }) => (
                <li key={label} className="flex items-start gap-2.5 rounded-2xl bg-slate-50 px-3.5 py-3 ring-1 ring-slate-200">
                  <Icon className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-xs text-slate-500">{label}</span>
                    <span className="block font-semibold text-navy">{value}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <p className="text-xs font-bold tracking-wide text-teal-700 uppercase">Ce que l&apos;entreprise peut faire</p>
              <p className="mt-2 text-[15px] leading-7 whitespace-pre-line text-slate-700">{o.description}</p>
            </div>
            <p className="mt-6 text-xs text-slate-500">Publiée le {formatDate(o.published_at)}</p>
          </article>

          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8" aria-labelledby="contacter">
            <h2 id="contacter" className="font-heading text-xl font-bold text-navy">
              {mine ? "C'est votre disponibilité" : "Écrire à cette entreprise"}
            </h2>
            <div className="mt-4">
              {mine ? (
                <div className="flex flex-wrap gap-3">
                  <ButtonLink href={`/dashboard/disponibilites/${o.id}`}>
                    <PenLine className="size-4" aria-hidden /> Modifier
                  </ButtonLink>
                  <ButtonLink href="/dashboard/disponibilites" variant="outline">
                    Mes disponibilités
                  </ButtonLink>
                </div>
              ) : !session ? (
                <div className="rounded-2xl bg-sky p-5 text-center">
                  <Lock className="mx-auto size-6 text-teal-700" aria-hidden />
                  <p className="mt-2 font-semibold text-navy">Créez votre compte gratuit pour écrire à {o.company?.name ?? "cette entreprise"}</p>
                  <ButtonLink href={`/inscription?suite=${encodeURIComponent(`/disponibilites/${o.id}`)}`} className="mt-4">
                    Créer mon compte gratuit
                  </ButtonLink>
                  <p className="mt-3 text-sm">
                    <Link href={`/connexion?suite=${encodeURIComponent(`/disponibilites/${o.id}`)}`} className="font-semibold text-teal-700 underline">
                      J&apos;ai déjà un compte
                    </Link>
                  </p>
                </div>
              ) : !session.activeCompany ? (
                <div className="text-sm text-slate-600">
                  Créez d&apos;abord le profil de votre entreprise pour écrire à une autre entreprise.{" "}
                  <ButtonLink href={`/onboarding/entreprise?suite=${encodeURIComponent(`/disponibilites/${o.id}`)}`} className="mt-3">
                    Créer mon entreprise
                  </ButtonLink>
                </div>
              ) : state === "online" ? (
                <ContactOfferForm offerId={o.id} companyName={o.company?.name ?? "cette entreprise"} />
              ) : null}
            </div>
          </section>
          <p className="text-center text-sm">
            <Link href="/disponibilites" className="font-semibold text-teal-700 underline">
              Voir les autres entreprises disponibles
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
