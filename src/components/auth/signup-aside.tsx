import { CalendarClock, MapPin, Quote, Sparkles, Star } from "lucide-react";
import { CompanyLogo } from "@/components/companies/company-logo";
import { MemberProofCompact } from "@/components/home/member-proof";
import { MIN_TESTIMONIALS } from "@/components/home/testimonials";
import { formatDate } from "@/lib/format";
import { visitorRpc } from "@/lib/queries/public-cache";
import type { MemberCompany } from "@/lib/queries/platform";
import type { LiveStats } from "@/components/home/member-proof";

type Offer = { id: string; title: string; city: string | null; department_code: string | null; response_deadline: string | null };

/**
 * Inscription, panneau de droite : des preuves réelles. Les avis de membres (publiés avec leur accord) dès
 * qu'il y en a au moins MIN_TESTIMONIALS ; sinon, et en plus, l'activité réelle de la plateforme (offres
 * ouvertes, dernières offres, entreprises inscrites). Jamais d'avis ni de chiffre inventé.
 */
export async function SignupAside({ total, latest, live, companies }: { total: number; latest: Offer[]; live: LiveStats | null; companies: MemberCompany[] }) {
  const { data } = await visitorRpc("public_testimonials", { p_limit: 3 }, { always: true });
  const reviews = (data ?? []).filter((t) => t.quote);
  const showReviews = reviews.length >= MIN_TESTIMONIALS;
  return (
    <aside className="relative isolate hidden overflow-hidden bg-gradient-to-br from-sky via-white to-teal-50 px-10 py-14 lg:block xl:px-16">
      <div aria-hidden className="absolute -top-24 -right-24 -z-10 size-96 rounded-full bg-teal/15 blur-3xl" />
      <div aria-hidden className="bg-grid absolute inset-0 -z-10 opacity-60" />
      <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-teal-700 shadow-sm ring-1 ring-slate-200">
        <Sparkles className="size-4" aria-hidden /> Trouvez. Répondez. Signez.
      </p>
      <h2 className="mt-6 max-w-xl font-heading text-4xl leading-tight font-extrabold text-navy">
        Vos prochains clients publient <span className="text-teal-700">leurs besoins aujourd&apos;hui.</span>
      </h2>
      <p className="mt-4 max-w-lg text-lg text-slate-600">
        {showReviews ? "Ce qu'en disent les entreprises qui l'utilisent." : "Appels d'offres publics et besoins d'entreprises, réunis au même endroit et mis à jour chaque jour."}
      </p>

      {showReviews ? (
        <ul className="mt-8 max-w-xl space-y-4">
          {reviews.map((t) => (
            <li key={t.id} className="flex gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <CompanyLogo name={t.company_name ?? t.author_name} path={t.logo_path} size={48} />
              <div className="min-w-0">
                <Quote className="size-4 text-teal-600" aria-hidden />
                <p className="mt-1 text-[15px] text-slate-700">« {t.quote} »</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
                  — {t.author_name}
                  {t.company_name && <span>· {t.company_name}</span>}
                  {t.rating && (
                    <span className="flex gap-0.5" role="img" aria-label={`Note : ${t.rating} sur 5`}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} className={`size-3.5 ${i < (t.rating ?? 0) ? "fill-teal text-teal" : "text-slate-300"}`} aria-hidden />
                      ))}
                    </span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        latest.length > 0 && (
          <div className="mt-8 max-w-xl">
            {total > 0 && (
              <p className="flex items-center gap-2 text-sm font-semibold text-navy">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-teal" />
                </span>
                {total.toLocaleString("fr-FR")} opportunités ouvertes en ce moment, dont les plus récentes :
              </p>
            )}
            <ul className="mt-4 space-y-3">
              {latest.map((o) => (
                <li key={o.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <p className="line-clamp-2 font-semibold text-navy">{o.title}</p>
                  <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-slate-500">
                    {o.department_code && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" aria-hidden /> {o.city || o.department_code}
                      </span>
                    )}
                    {o.response_deadline && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="size-3.5" aria-hidden /> avant le {formatDate(o.response_deadline)}
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )
      )}

      {live && (
        <div className="mt-6 max-w-xl">
          <MemberProofCompact initial={live} companies={companies} />
        </div>
      )}

      <div className="mt-8 flex max-w-xl items-end justify-end gap-3 text-teal-700" aria-hidden>
        <svg viewBox="0 0 60 30" className="mb-1 h-6 w-12 fill-none stroke-current stroke-2">
          <path d="M58 6C42 26 20 28 4 14M4 14l2 10M4 14l10-2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="font-heading text-lg -rotate-3 italic">
          Des entreprises réelles,
          <br />
          des opportunités concrètes.
        </p>
      </div>
    </aside>
  );
}
