import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BellRing, Megaphone, Users } from "lucide-react";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CompanyLogo } from "@/components/companies/company-logo";
import { familyPhoto, sectorFamilySlug } from "@/components/opportunities/sector-visual";
import { EmptyState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Entreprises suivies" };

type Co = { id: string; slug: string; name: string; logo_path: string | null; city: string | null; profile: { sectors: string[] | null; tagline: string | null } | { sectors: string[] | null; tagline: string | null }[] | null };
const prof = (c: Co) => (Array.isArray(c.profile) ? c.profile[0] : c.profile) ?? { sectors: [], tagline: null };

/** Entreprises suivies par l'entreprise active, leurs derniers besoins, et les entreprises qui la suivent. */
export default async function FollowsPage() {
  const session = await requireCompany("/dashboard/suivies");
  const me = session.activeCompany.company.id;
  const supabase = await createClient();
  const sel = "id, slug, name, logo_path, city, profile:company_profiles(sectors, tagline)";
  const [{ data: following }, { data: followers }] = await Promise.all([
    supabase.from("company_follows").select(`created_at, company:companies!company_follows_followed_company_id_fkey(${sel})`).eq("follower_company_id", me).order("created_at", { ascending: false }),
    supabase.from("company_follows").select(`created_at, company:companies!company_follows_follower_company_id_fkey(${sel})`).eq("followed_company_id", me).order("created_at", { ascending: false }),
  ]);
  const followed = (following ?? []).map((f) => f.company as unknown as Co).filter(Boolean);
  const ids = followed.map((c) => c.id);
  const { data: needs } = ids.length
    ? await supabase
        .from("opportunities")
        .select("id, title, company_id, published_at, response_deadline")
        .in("company_id", ids)
        .eq("status", "PUBLISHED")
        .order("published_at", { ascending: false })
        .limit(10)
    : { data: [] };
  const byId = new Map(followed.map((c) => [c.id, c]));
  const fans = (followers ?? []).map((f) => f.company as unknown as Co).filter(Boolean);

  return (
    <div className="space-y-10">
      <header className="relative overflow-hidden rounded-3xl bg-navy p-6 text-white shadow-xl sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-56 animate-aurora rounded-full bg-teal/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 left-10 size-56 animate-aurora rounded-full bg-violet/25 blur-3xl [animation-delay:-7s]" />
        <div className="relative">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-teal-200">
            <BellRing className="size-4" aria-hidden /> Réseau
          </p>
          <h1 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">Entreprises suivies</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/75">
            Suivez vos clients, partenaires ou donneurs d&apos;ordre : chaque nouveau besoin qu&apos;ils publient arrive dans vos notifications.
          </p>
        </div>
      </header>

      <section aria-labelledby="suivies">
        <h2 id="suivies" className="mb-4 text-lg font-bold">
          Vous suivez {followed.length ? `${followed.length} entreprise${followed.length > 1 ? "s" : ""}` : ""}
        </h2>
        {followed.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" aria-hidden />}
            title="Vous ne suivez encore aucune entreprise"
            description="Ouvrez la fiche d'une entreprise de l'annuaire et cliquez sur « Suivre » : vous serez prévenu dès qu'elle publie un besoin."
            action={<ButtonLink href="/entreprises">Parcourir l&apos;annuaire</ButtonLink>}
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {followed.map((c) => (
              <li key={c.id}>
                <Link href={`/entreprises/${c.slug}`} className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg hover:ring-teal/40">
                  <span aria-hidden className="relative block h-20 overflow-hidden bg-navy">
                    <Image src={familyPhoto(sectorFamilySlug(prof(c).sectors?.[0]))} alt="" fill unoptimized sizes="33vw" className="object-cover transition duration-700 group-hover:scale-110" />
                    <span className="absolute inset-0 bg-gradient-to-t from-navy/70 to-transparent" />
                  </span>
                  <span className="flex flex-1 flex-col px-5 pb-5">
                    <span className="-mt-7 mb-2 block w-fit rounded-2xl bg-white p-1 shadow-md ring-1 ring-slate-200">
                      <CompanyLogo name={c.name} path={c.logo_path} size={48} />
                    </span>
                    <span className="font-bold text-navy group-hover:text-teal-700">{c.name}</span>
                    {prof(c).tagline && <span className="mt-1 line-clamp-2 text-sm text-slate-600">{prof(c).tagline}</span>}
                    {c.city && <span className="mt-auto pt-3 text-xs text-slate-500">{c.city}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {followed.length > 0 && (
        <section aria-labelledby="besoins-suivis">
          <h2 id="besoins-suivis" className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Megaphone className="size-5 text-teal-700" aria-hidden /> Leurs derniers besoins
          </h2>
          {needs?.length ? (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
              {needs.map((n) => {
                const c = n.company_id ? byId.get(n.company_id) : undefined;
                return (
                  <li key={n.id}>
                    <Link href={`/opportunites/${n.id}`} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-teal-50/50">
                      {c && <CompanyLogo name={c.name} path={c.logo_path} size={40} />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-navy group-hover:text-teal-700">{n.title}</span>
                        <span className="block text-xs text-slate-500">
                          {c?.name} · publié le {formatDate(n.published_at)}
                          {n.response_deadline ? ` · réponse avant le ${formatDate(n.response_deadline)}` : ""}
                        </span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-teal-700 transition group-hover:translate-x-1" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">Aucun besoin en cours chez ces entreprises. Vous serez prévenu dès la prochaine publication.</p>
          )}
        </section>
      )}

      <section aria-labelledby="abonnes">
        <h2 id="abonnes" className="mb-4 text-lg font-bold">
          Ils suivent votre entreprise
        </h2>
        {fans.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            Aucune entreprise ne vous suit pour l&apos;instant. Une fiche complète (logo, présentation, compétences) et des besoins publiés donnent envie de vous suivre.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {fans.map((c) => (
              <li key={c.id}>
                <Link href={`/entreprises/${c.slug}`} className="flex items-center gap-3 rounded-2xl bg-white py-2 pr-4 pl-2 shadow-sm ring-1 ring-slate-200 transition hover:ring-teal/40">
                  <CompanyLogo name={c.name} path={c.logo_path} size={36} />
                  <span className="text-sm font-semibold text-navy">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
