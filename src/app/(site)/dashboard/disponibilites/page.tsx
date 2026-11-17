import Link from "next/link";
import { CalendarCheck2, Eye, MessageSquare, PenLine, PlusCircle } from "lucide-react";
import { requireCompany } from "@/lib/auth";
import { myServiceOffers } from "@/lib/queries/service-offers";
import { getDepartments } from "@/lib/queries/platform";
import { availabilityLabel, offerState, zoneLabel } from "@/lib/service-offers-core";
import { OfferStatusButton } from "@/components/service-offers/offer-actions";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Mes disponibilités" };

const STATE = {
  online: { label: "En ligne", tone: "bg-teal-50 text-teal-800 ring-teal/30" },
  expired: { label: "Expirée", tone: "bg-slate-100 text-slate-600 ring-slate-200" },
  archived: { label: "Retirée", tone: "bg-slate-100 text-slate-600 ring-slate-200" },
  removed: { label: "Retirée par la modération", tone: "bg-rose-50 text-rose-800 ring-rose-200" },
} as const;

/** Les disponibilités de l'entreprise : en ligne ou non, contacts reçus, modifier, prolonger, retirer. */
export default async function MyServiceOffersPage(props: PageProps<"/dashboard/disponibilites">) {
  const session = await requireCompany("/dashboard/disponibilites");
  const sp = await props.searchParams;
  const [offers, departments] = await Promise.all([myServiceOffers(session.activeCompany.company.id), getDepartments()]);
  const depName = new Map(departments.map((d) => [d.code, d.name]));
  const now = new Date();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-navy sm:text-3xl">Mes disponibilités</h1>
          <p className="mt-1 max-w-2xl text-slate-600">Ce que votre entreprise peut faire, où et quand. Les entreprises qui cherchent un prestataire vous écrivent par la messagerie.</p>
        </div>
        <ButtonLink href="/disponibilites/publier" className="btn-shine">
          <PlusCircle className="size-4" aria-hidden /> Annoncer une disponibilité
        </ButtonLink>
      </div>
      {typeof sp.modifiee === "string" && <Notice tone="success">Modifications enregistrées.</Notice>}

      {offers.length === 0 ? (
        <div className="rounded-3xl bg-gradient-to-br from-sky to-white p-8 text-center ring-1 ring-slate-200 sm:p-12">
          <CalendarCheck2 className="mx-auto size-10 text-teal-700" aria-hidden />
          <p className="mt-3 font-heading text-xl font-bold text-navy">Faites savoir que vous êtes disponible</p>
          <p className="mx-auto mt-1 max-w-lg text-slate-600">Une équipe libre en décembre ? Un savoir-faire à proposer ? Annoncez-le : les entreprises de votre zone qui cherchent un prestataire vous trouveront.</p>
          <ButtonLink href="/disponibilites/publier" className="mt-5">
            Annoncer ma première disponibilité
          </ButtonLink>
        </div>
      ) : (
        <ul className="space-y-3">
          {offers.map((o) => {
            const state = offerState(o, now);
            return (
              <li key={o.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6" data-testid="my-offer">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ring-1", STATE[state].tone)}>{STATE[state].label}</span>
                    <h2 className="mt-2 font-heading text-lg font-bold text-navy">
                      <Link href={`/disponibilites/${o.id}`} className="hover:underline">
                        {o.title}
                      </Link>
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {availabilityLabel(o.available_from, o.available_until)} · {zoneLabel(o, o.department_code ? depName.get(o.department_code) : null)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {state === "online" ? `En ligne jusqu'au ${formatDate(o.expires_at)}` : state === "expired" ? `Expirée le ${formatDate(o.expires_at)}` : state === "removed" ? (o.removed_reason ?? "") : "Retirée du site"}
                    </p>
                  </div>
                  <p className="inline-flex items-center gap-1.5 rounded-2xl bg-sky px-3 py-2 text-sm font-semibold text-navy">
                    <MessageSquare className="size-4 text-teal-700" aria-hidden /> {o.contacts} contact{o.contacts > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                  <Link href={`/disponibilites/${o.id}`} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-navy transition hover:bg-slate-50">
                    <Eye className="size-4" aria-hidden /> Voir
                  </Link>
                  {state !== "removed" && (
                    <Link href={`/dashboard/disponibilites/${o.id}`} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-navy transition hover:bg-slate-50">
                      <PenLine className="size-4" aria-hidden /> Modifier
                    </Link>
                  )}
                  {o.contacts > 0 && (
                    <Link href="/dashboard/messages" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-navy transition hover:bg-slate-50">
                      <MessageSquare className="size-4" aria-hidden /> Messages
                    </Link>
                  )}
                  <span className="ml-auto flex flex-wrap gap-2">
                    {state === "online" && <OfferStatusButton id={o.id} to="PUBLISHED" label="Prolonger 60 jours" />}
                    {(state === "expired" || state === "archived") && <OfferStatusButton id={o.id} to="PUBLISHED" label="Remettre en ligne" />}
                    {state === "online" && <OfferStatusButton id={o.id} to="ARCHIVED" label="Retirer" />}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
