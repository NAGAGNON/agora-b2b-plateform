import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BadgeCheck, Globe, Mail, MapPin, Phone, Award, Lock, Users, CalendarDays } from "lucide-react";
import { Directory } from "@/components/companies/directory";
import { CompanyLogo } from "@/components/companies/company-card";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { FavoriteButton } from "@/components/opportunities/favorite-button";
import { ReportButton } from "@/components/report-button";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { DemoBadge } from "@/components/demo";
import { getCompanyBySlug, searchCompanies } from "@/lib/queries/companies";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseCompanyFilters } from "@/lib/search-params";
import { pageMetadata } from "@/lib/seo";
import { track } from "@/lib/analytics";
import type { Database } from "@/lib/database.types";
import { getSectors, getSectorLabels, showDemoData } from "@/lib/queries/platform";
import { COMPANY_KIND_LABELS, COMPANY_SIZE_LABELS, DEMO_NOTICE, sectorLabel } from "@/lib/constants";

export async function generateMetadata(props: PageProps<"/entreprises/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const sector = (await getSectors()).find((s) => s.slug === slug);
  if (sector) {
    const { total } = await searchCompanies(parseCompanyFilters({ secteur: slug }), 1);
    return pageMetadata({
      title: `Entreprises — ${sector.label}`,
      description: `Annuaire des fournisseurs et prestataires en ${sector.label.toLowerCase()} référencés sur LinkProB2B.`,
      path: `/entreprises/${slug}`,
      noindex: total === 0,
    });
  }
  const c = await getCompanyBySlug(slug);
  if (!c) return { title: "Entreprise introuvable", robots: { index: false } };
  const profile = (Array.isArray(c.profile) ? c.profile[0] : c.profile) as Database["public"]["Tables"]["company_profiles"]["Row"] | null;
  return pageMetadata({
    title: c.name,
    description: (profile?.tagline ?? profile?.description ?? `${c.name} sur LinkProB2B`).slice(0, 160),
    path: `/entreprises/${c.slug}`,
    noindex: c.is_demo || !profile?.is_public,
  });
}

export default async function CompanyPage(props: PageProps<"/entreprises/[slug]">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const sector = (await getSectors()).find((s) => s.slug === slug);
  if (sector) {
    return (
      <div className="container-page py-8 sm:py-10">
        <nav aria-label="Fil d'Ariane" className="mb-3 text-sm text-slate-500">
          <Link href="/entreprises" className="hover:underline">
            Annuaire
          </Link>{" "}
          / <span className="text-navy">{sector.label}</span>
        </nav>
        <h1 className="text-2xl font-bold sm:text-3xl">Entreprises — {sector.label}</h1>
        <p className="mt-1 mb-6 text-slate-600">Fournisseurs et prestataires référencés dans ce secteur.</p>
        <Directory filters={parseCompanyFilters({ ...sp, secteur: slug })} rawParams={sp} basePath={`/entreprises/${slug}`} />
      </div>
    );
  }

  const c = await getCompanyBySlug(slug);
  const sectorLabels = await getSectorLabels();
  if (!c || (c.is_demo && !(await showDemoData()))) notFound();
  const profile = (Array.isArray(c.profile) ? c.profile[0] : c.profile) as Database["public"]["Tables"]["company_profiles"]["Row"] | null;
  const session = await getSession();
  const isMember = Boolean(session?.memberships.some((m) => m.company.id === c.id));
  if (!profile?.is_public && !isMember && !session?.isStaff) notFound();
  void track("view_company", { company_id: c.id });

  const supabase = await createClient();
  const [{ data: opps }, fav] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, title, summary, type, origin, status, sector_slug, city, department_code, budget_min, budget_max, budget_visible, response_deadline, published_at, is_demo")
      .eq("company_id", c.id)
      .eq("status", "PUBLISHED")
      .order("published_at", { ascending: false })
      .limit(6),
    session ? supabase.from("favorites").select("id").eq("user_id", session.userId).eq("company_id", c.id).maybeSingle() : null,
  ]);

  return (
    <div className="bg-slate-50/60">
      <div className="container-page py-6 sm:py-10">
        <nav aria-label="Fil d'Ariane" className="mb-4 text-sm text-slate-500">
          <Link href="/entreprises" className="hover:underline">
            Annuaire
          </Link>{" "}
          / <span className="text-navy">{c.name}</span>
        </nav>
        {c.is_demo && (
          <Notice tone="warning" className="mb-6">
            {DEMO_NOTICE}
          </Notice>
        )}
        {c.status === "SUSPENDED" && (
          <Notice tone="error" className="mb-6">
            Cette entreprise est suspendue.
          </Notice>
        )}
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <CompanyLogo name={c.name} path={c.logo_path} size={80} />
              <div className="min-w-0">
                <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold sm:text-3xl">
                  {c.name}
                  {c.verified_at && <BadgeCheck className="size-6 text-teal-600" aria-label="Entreprise vérifiée" />}
                </h1>
                <p className="mt-1 text-slate-600">{profile?.tagline}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone="navy">{COMPANY_KIND_LABELS[c.kind]}</Badge>
                  {c.size && <Badge tone="slate">{COMPANY_SIZE_LABELS[c.size]}</Badge>}
                  {c.verified_at ? <Badge tone="teal">Entreprise vérifiée</Badge> : <Badge tone="outline">Non vérifiée</Badge>}
                  {c.is_demo && <DemoBadge />}
                </div>
              </div>
            </header>

            {profile?.description && (
              <section className="mt-8">
                <h2 className="mb-2 text-lg font-bold">Présentation</h2>
                <p className="leading-7 whitespace-pre-line text-slate-700">{profile.description}</p>
              </section>
            )}
            {profile && profile.sectors.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-2 text-lg font-bold">Secteurs</h2>
                <ul className="flex flex-wrap gap-2">
                  {profile.sectors.map((s) => (
                    <li key={s}>
                      <Link href={`/entreprises/${s}`}>
                        <Badge tone="sky">{sectorLabel(s, sectorLabels)}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {profile && profile.skills.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-2 text-lg font-bold">Compétences et prestations</h2>
                <ul className="flex flex-wrap gap-2">
                  {profile.skills.map((s) => (
                    <li key={s}>
                      <Badge tone="slate">{s}</Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {profile && profile.certifications.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
                  <Award className="size-5 text-teal-600" aria-hidden /> Certifications déclarées
                </h2>
                <ul className="list-disc space-y-1 pl-6 text-slate-700">
                  {profile.certifications.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-slate-500">Informations déclarées par l&apos;entreprise.</p>
              </section>
            )}
            {profile?.references_text && (
              <section className="mt-8">
                <h2 className="mb-2 text-lg font-bold">Références</h2>
                <p className="leading-7 whitespace-pre-line text-slate-700">{profile.references_text}</p>
                <p className="mt-2 text-xs text-slate-500">Informations déclarées par l&apos;entreprise.</p>
              </section>
            )}

            <section className="mt-10">
              <h2 className="mb-4 text-lg font-bold">Besoins publiés en cours</h2>
              {opps && opps.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {opps.map((o) => (
                    <OpportunityCard key={o.id} o={{ ...o, company_name: c.name, company_verified: Boolean(c.verified_at), budget_min: o.budget_visible ? o.budget_min : null, budget_max: o.budget_visible ? o.budget_max : null }} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Aucun besoin publié actuellement.</p>
              )}
            </section>
            <div className="mt-8 border-t border-slate-100 pt-4 text-right">
              <ReportButton targetType="COMPANY" targetId={c.id} signedIn={Boolean(session)} label="Signaler cette entreprise" />
            </div>
          </article>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-base font-bold">Coordonnées</h2>
              <ul className="space-y-3 text-sm">
                {(c.city || c.department_code) && (
                  <li className="flex gap-2">
                    <MapPin className="size-4 shrink-0 text-teal-700" aria-hidden />
                    {c.city} {c.postal_code} {c.department_code && `(${c.department_code})`}
                  </li>
                )}
                {profile?.intervention_zone && (
                  <li className="flex gap-2">
                    <Users className="size-4 shrink-0 text-teal-700" aria-hidden />
                    Intervient : {profile.intervention_zone}
                    {profile.intervention_radius_km ? ` (${profile.intervention_radius_km} km)` : ""}
                  </li>
                )}
                {profile?.founded_year && (
                  <li className="flex gap-2">
                    <CalendarDays className="size-4 shrink-0 text-teal-700" aria-hidden /> Créée en {profile.founded_year}
                  </li>
                )}
                {c.website && (
                  <li className="flex gap-2">
                    <Globe className="size-4 shrink-0 text-teal-700" aria-hidden />
                    <a href={c.website} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-teal-700 underline">
                      {c.website.replace(/^https?:\/\//, "")}
                    </a>
                  </li>
                )}
                {session ? (
                  <>
                    {profile?.contact_email && (
                      <li className="flex gap-2">
                        <Mail className="size-4 shrink-0 text-teal-700" aria-hidden />
                        <a href={`mailto:${profile.contact_email}`} className="break-all text-teal-700 underline">
                          {profile.contact_email}
                        </a>
                      </li>
                    )}
                    {profile?.contact_phone && (
                      <li className="flex gap-2">
                        <Phone className="size-4 shrink-0 text-teal-700" aria-hidden /> {profile.contact_phone}
                      </li>
                    )}
                  </>
                ) : (
                  <li className="flex gap-2 text-slate-500">
                    <Lock className="size-4 shrink-0" aria-hidden />
                    <span>
                      Coordonnées réservées aux membres.{" "}
                      <Link href={`/connexion?suite=/entreprises/${c.slug}`} className="font-semibold text-teal-700 underline">
                        Se connecter
                      </Link>
                    </span>
                  </li>
                )}
              </ul>
            </div>
            {!isMember && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <FavoriteButton target="company" id={c.id} initial={Boolean(fav?.data)} signedIn={Boolean(session)} />
                <p className="mt-3 text-xs text-slate-500">
                  La messagerie s&apos;ouvre dans le cadre d&apos;une opportunité (manifestation d&apos;intérêt ou réponse).
                </p>
              </div>
            )}
            {isMember && (
              <Link href="/dashboard/entreprise" className="block rounded-2xl border border-teal bg-teal-50 p-4 text-sm font-semibold text-teal-700">
                C&apos;est votre entreprise — modifier le profil →
              </Link>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
