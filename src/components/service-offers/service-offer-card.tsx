import Link from "next/link";
import { BadgeCheck, CalendarCheck2, MapPin, Users } from "lucide-react";
import { CompanyLogo } from "@/components/companies/company-card";
import { availabilityLabel, zoneLabel } from "@/lib/service-offers-core";
import type { ServiceOffer } from "@/lib/queries/service-offers";

/** Carte d'une disponibilité : qui, quoi, où, quand ; toute la carte ouvre la disponibilité. */
export function ServiceOfferCard({ offer, sector, department, headingLevel = 3 }: { offer: ServiceOffer; sector?: string | null; department?: string | null; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="group relative flex h-full flex-col rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg hover:ring-teal/40 sm:p-6" data-testid="service-offer-card">
      <div className="flex items-center gap-3">
        {offer.company && <CompanyLogo name={offer.company.name} path={offer.company.logo_path} size={44} />}
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate font-semibold text-navy">
            <span className="truncate">{offer.company?.name ?? "Entreprise"}</span>
            {offer.company?.verified_at && <BadgeCheck className="size-4 shrink-0 text-teal-600" aria-label="Entreprise vérifiée" />}
          </p>
          {sector && <p className="truncate text-xs text-slate-500">{sector}</p>}
        </div>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-800 ring-1 ring-teal/30">
          <span className="size-1.5 animate-pulse rounded-full bg-teal" aria-hidden /> Disponible
        </span>
      </div>
      <H className="mt-4 font-heading text-lg leading-snug font-bold text-balance text-navy">
        <Link href={`/disponibilites/${offer.id}`} className="after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none">
          {offer.title}
        </Link>
      </H>
      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-600">{offer.description}</p>
      <ul className="mt-auto flex flex-wrap gap-1.5 pt-4 text-xs">
        <li className="inline-flex items-center gap-1 rounded-full bg-sky px-2.5 py-1 font-semibold text-navy">
          <CalendarCheck2 className="size-3.5 text-teal-700" aria-hidden /> {availabilityLabel(offer.available_from, offer.available_until)}
        </li>
        <li className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-slate-700 ring-1 ring-slate-200">
          <MapPin className="size-3.5" aria-hidden /> {zoneLabel(offer, department)}
        </li>
        {offer.capacity && (
          <li className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-slate-700 ring-1 ring-slate-200">
            <Users className="size-3.5" aria-hidden /> {offer.capacity}
          </li>
        )}
      </ul>
    </article>
  );
}
