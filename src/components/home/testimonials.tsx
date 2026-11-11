import Link from "next/link";
import { Quote, Star } from "lucide-react";
import { CompanyLogo } from "@/components/companies/company-logo";
import { visitorRpc } from "@/lib/queries/public-cache";

/** La section n'apparaît qu'à partir de ce nombre d'avis publiés (choix de l'équipe). */
export const MIN_TESTIMONIALS = 2;

/**
 * Accueil : avis réels de membres, publiés avec leur accord et relus par l'équipe. Rien n'est
 * affiché tant qu'il y a moins de MIN_TESTIMONIALS avis publiés (jamais d'avis inventé).
 */
export async function Testimonials() {
  const { data } = await visitorRpc("public_testimonials", { p_limit: 6 }, { always: true });
  const list = data ?? [];
  if (list.length < MIN_TESTIMONIALS) return null;
  return (
    <section aria-labelledby="temoignages" className="cv-auto container-page py-12 sm:py-16">
      <p className="text-sm font-semibold tracking-wide text-teal-700 uppercase">Ils utilisent LinkProB2B</p>
      <h2 id="temoignages" className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">
        Ce qu&apos;en disent nos membres
      </h2>
      <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => (
          <li key={t.id} className="flex flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <Quote className="size-6 text-teal-600" aria-hidden />
            {t.rating && (
              <p className="mt-3 flex gap-0.5" role="img" aria-label={`Note : ${t.rating} sur 5`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className={`size-4 ${i < t.rating! ? "fill-teal text-teal" : "text-slate-300"}`} aria-hidden />
                ))}
              </p>
            )}
            <blockquote className="mt-3 flex-1 text-slate-800">« {t.quote} »</blockquote>
            <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
              {t.company_name && <CompanyLogo name={t.company_name} path={t.logo_path} size={40} />}
              <p className="min-w-0 text-sm">
                <span className="block font-semibold text-navy">{t.author_name}</span>
                <span className="block truncate text-slate-600">
                  {[t.author_role, t.company_slug && t.company_name ? null : t.company_name].filter(Boolean).join(" · ")}
                  {t.company_slug && t.company_name && (
                    <>
                      {t.author_role ? " · " : ""}
                      <Link href={`/entreprises/${t.company_slug}`} className="hover:underline">
                        {t.company_name}
                      </Link>
                    </>
                  )}
                </span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
