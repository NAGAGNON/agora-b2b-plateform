import Link from "next/link";
import { SectorVisual } from "@/components/opportunities/sector-visual";
import { JsonLd, breadcrumbLd } from "@/components/json-ld";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import {
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  ExternalLink,
  FileText,
  Info,
  Lock,
  MapPin,
  Tag,
  Users,
  Wallet,
  Eye,
  ShieldAlert,
  Building2,
  Landmark,
} from "lucide-react";
import { InterestPanel } from "@/components/opportunities/interest-panel";
import { FavoriteButton } from "@/components/opportunities/favorite-button";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { CompanyCard } from "@/components/companies/company-card";
import { searchCompanies } from "@/lib/queries/companies";
import { parseCompanyFilters } from "@/lib/search-params";
import { LandingPage, landingMetadata } from "@/components/opportunities/landing-page";
import { resolveLanding } from "@/lib/landing";
import { ReportButton } from "@/components/report-button";
import { PipelineButton } from "@/components/opportunities/pipeline-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { DemoBadge } from "@/components/demo";
import { CompanyLogo } from "@/components/companies/company-card";
import { buttonClasses } from "@/components/ui/button";
import { getOpportunityDetail } from "@/lib/queries/opportunities";
import { visitorRpc } from "@/lib/queries/public-cache";
import { buyerSlug } from "@/lib/buyer-slug";
import { ShareLinks } from "@/components/share-links";
import { cookies, headers } from "next/headers";
import { OfferAccessGate } from "@/components/opportunities/offer-access-gate";
import { OutreachWelcome } from "@/components/opportunities/outreach-welcome";
import { OUTREACH_COOKIE, outreachVisitor, track as trackOutreach } from "@/lib/outreach/tracking";
import { getSectorLabels, showDemoData, getLocationLabel, getDepartments, getOpenCounts } from "@/lib/queries/platform";
import { regionByName } from "@/lib/geo";
import { AlertLeadForm } from "@/components/alert-lead-form";
import { MIN_INDEXABLE } from "@/lib/landing";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/analytics";
import { pageMetadata, siteUrl } from "@/lib/seo";
import { DEMO_NOTICE, OPPORTUNITY_TYPE_HELP, OPPORTUNITY_TYPE_LABELS, sectorLabel, VERIFICATION_STATUS_LABELS, COMPANY_SIZE_LABELS } from "@/lib/constants";
import { clip, deadlineLabel, formatBudget, formatBytes, formatDate, formatDateTime, isUuid } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/opportunites/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (!isUuid(id)) {
    const landing = await resolveLanding(id);
    if (!landing) return { title: "Page introuvable" };
    return landingMetadata(landing, `/opportunites/${id}`, await props.searchParams);
  }
  const o = await getOpportunityDetail(id);
  if (!o) return { title: "Opportunité introuvable", robots: { index: false } };
  // Date limite dépassée : plus indexée, même avant le passage de la tâche quotidienne d'expiration
  const deadlinePassed = Boolean(o.response_deadline && new Date(o.response_deadline) < new Date());
  // Une opportunité externe doit citer sa source : sans source connue, elle n'est pas indexée
  const hasSource = o.origin !== "EXTERNAL" || (Array.isArray(o.source) ? o.source.length > 0 : Boolean(o.source));
  const indexable = o.status === "PUBLISHED" && !deadlinePassed && o.visibility === "PUBLIC" && !o.is_demo && hasSource;
  const location = (await getLocationLabel())(o.city, o.department_code);
  const details = [
    o.origin === "EXTERNAL" && o.external_buyer_name ? `Acheteur : ${o.external_buyer_name}` : null,
    location ? `Lieu : ${location}` : null,
    o.response_deadline ? `Échéance : ${formatDate(o.response_deadline)}` : null,
  ].filter(Boolean);
  const intro = clip((o.summary ?? o.description ?? "").replace(/\s+/g, " ").trim(), 90);
  // Titre distinctif : beaucoup d'annonces ont des intitulés génériques (« Travaux de voirie »)
  const qualifier = location ?? (o.origin === "EXTERNAL" ? o.external_buyer_name : null);
  return pageMetadata({
    title: qualifier && !o.title.toLowerCase().includes(qualifier.toLowerCase()) ? `${clip(o.title, 62 - Math.min(qualifier.length, 28) - 3)} – ${clip(qualifier, 28)}` : clip(o.title, 62),
    description: clip([intro, ...details].filter(Boolean).join(" · "), 160),
    path: `/opportunites/${o.id}`,
    noindex: !indexable,
  });
}

/**
 * Besoin « réservé aux membres » ouvert à un visiteur sans compte : jamais de détail. Arrivé par un
 * e-mail de prospection qui lui proposait ce besoin, il voit la page d'accès « Créez votre compte » ;
 * sinon, il est invité à s'inscrire et revient ensuite sur la fiche.
 */
async function membersOnlyGate(id: string) {
  if (await getSession()) return null;
  const db = createAdminClient();
  const { data: o } = await db
    .from("opportunities")
    .select("id, title, city, department_code, sector_slug, response_deadline, budget_visible, budget_min, budget_max")
    .eq("id", id)
    .eq("status", "PUBLISHED")
    .eq("visibility", "MEMBERS_ONLY")
    .eq("is_demo", false)
    .maybeSingle();
  if (!o) return null;
  const visitor = await outreachVisitor((await cookies()).get(OUTREACH_COOKIE)?.value);
  const offered = visitor ? (await db.from("outreach_recipient_opportunities").select("opportunity_id").eq("recipient_id", visitor.id).eq("opportunity_id", id).maybeSingle()).data : null;
  if (!visitor || !offered) redirect(`/inscription?suite=${encodeURIComponent(`/opportunites/${id}`)}`);
  const h = await headers();
  if (!h.get("next-router-prefetch") && h.get("purpose") !== "prefetch") await trackOutreach(visitor, "GATE_VIEW", { opportunityId: o.id });
  const location = (await getLocationLabel())(o.city, o.department_code);
  return (
    <OfferAccessGate
      token={visitor.token}
      offer={{
        id: o.id,
        title: o.title,
        buyer: null,
        location,
        sector: o.sector_slug ? sectorLabel(o.sector_slug, await getSectorLabels()) : null,
        deadline: o.response_deadline,
        budget: o.budget_visible ? formatBudget(o.budget_min, o.budget_max) : null,
      }}
    />
  );
}

export default async function OpportunityPage(props: PageProps<"/opportunites/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;

  if (!isUuid(id)) {
    const landing = await resolveLanding(id);
    if (!landing) notFound();
    return <LandingPage landing={landing} path={`/opportunites/${id}`} sp={sp} />;
  }

  const o = await getOpportunityDetail(id);
  if (!o) {
    const gate = await membersOnlyGate(id);
    if (gate) return gate;
    notFound();
  }
  if (o.is_demo && !(await showDemoData())) notFound();
  const session = await getSession();
  // Parcours « e-mail de prospection » : l'annonce complète est visible sans compte, avec un
  // bandeau pour créer son compte (annonces similaires, suivi des réponses).
  const visitor = await outreachVisitor((await cookies()).get(OUTREACH_COOKIE)?.value);
  const welcomeToken = visitor && !session ? visitor.token : null;
  if (visitor) {
    const h = await headers();
    const prefetch = Boolean(h.get("next-router-prefetch")) || h.get("purpose") === "prefetch";
    if (!session) {
      if (!prefetch) await trackOutreach(visitor, "GATE_VIEW", { opportunityId: o.id });
    } else if (!prefetch) await trackOutreach(visitor, "OFFER_ACCESS", { opportunityId: o.id, userId: session.userId });
  }
  const supabase = await createClient();
  void track("view_opportunity", { opportunity_id: o.id, origin: o.origin, type: o.type });

  const myCompanyId = session?.activeCompany?.company.id ?? null;
  const isOwner = Boolean(o.company_id && session?.memberships.some((m) => m.company.id === o.company_id));
  const [fav, interest, proposal, pipeline] = await Promise.all([
    session ? supabase.from("favorites").select("id").eq("user_id", session.userId).eq("opportunity_id", o.id).maybeSingle() : null,
    myCompanyId ? supabase.from("interests").select("id, status").eq("opportunity_id", o.id).eq("company_id", myCompanyId).maybeSingle() : null,
    myCompanyId ? supabase.from("proposals").select("id, status").eq("opportunity_id", o.id).eq("company_id", myCompanyId).maybeSingle() : null,
    myCompanyId ? supabase.from("pipeline_items").select("id").eq("opportunity_id", o.id).eq("company_id", myCompanyId).maybeSingle() : null,
  ]);

  const external = o.origin === "EXTERNAL";
  const sources = (Array.isArray(o.source) ? o.source : o.source ? [o.source] : []).sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  const source = sources[0];
  const otherSources = sources.slice(1);
  const company = Array.isArray(o.company) ? o.company[0] : o.company;
  const deadlinePassed = Boolean(o.response_deadline && new Date(o.response_deadline) < new Date());
  const effectiveStatus = o.status === "PUBLISHED" && deadlinePassed ? "EXPIRED" : o.status;
  const isOpen = effectiveStatus === "PUBLISHED";
  const closedReason =
    effectiveStatus === "EXPIRED"
      ? "La date limite de réponse est dépassée."
      : effectiveStatus === "CLOSED"
        ? "Cette consultation a été clôturée par le demandeur."
        : effectiveStatus !== "PUBLISHED"
          ? "Cette opportunité n'est pas publiée."
          : null;
  const budget = o.budget_visible ? formatBudget(o.budget_min, o.budget_max) : null;
  const deadline = deadlineLabel(o.response_deadline);
  const crumbSector = o.sector_slug ? sectorLabel(o.sector_slug, await getSectorLabels()) : null;
  // Fil d'Ariane géographique et métier : région › département › métier dans le département (pages d'atterrissage)
  const [departments, count] = await Promise.all([getDepartments(), getOpenCounts()]);
  const dep = departments.find((d) => d.code === o.department_code) ?? null;
  const depRegion = dep ? regionByName(dep.region) : null;
  const depPath = dep && depRegion ? `/opportunites/${depRegion.slug}/${dep.slug}` : null;
  const crumbs = [
    { name: "Opportunités", path: "/opportunites" },
    ...(depRegion ? [{ name: depRegion.name, path: `/opportunites/${depRegion.slug}` }] : []),
    ...(dep && depPath ? [{ name: dep.name, path: depPath }] : []),
    ...(o.sector_slug && crumbSector
      ? [
          dep && depPath && count("department_sector", `${dep.code}|${o.sector_slug}`) >= MIN_INDEXABLE
            ? { name: crumbSector, path: `${depPath}/${o.sector_slug}` }
            : { name: crumbSector, path: `/opportunites/${o.sector_slug}` },
        ]
      : []),
  ];
  const leadLabel = [crumbSector, dep ? `${dep.name} (${dep.code})` : o.region].filter(Boolean).join(" — ") || "similaires";
  const showLeadForm = !session && !o.is_demo && o.visibility === "PUBLIC";

  return (
    <div className="bg-slate-50/60">
      <div className="container-page py-6 sm:py-10">
        <JsonLd
          data={breadcrumbLd([...crumbs, { name: o.title, path: `/opportunites/${o.id}` }])}
        />
        <nav aria-label="Fil d'Ariane" className="mb-4 text-sm text-slate-500">
          {crumbs.map((c, i) => (
            <span key={c.path}>
              {i > 0 && " / "}
              <Link href={c.path} className="hover:underline">
                {c.name}
              </Link>
            </span>
          ))}
        </nav>

        {welcomeToken && <OutreachWelcome token={welcomeToken} offerId={o.id} />}
        {effectiveStatus === "EXPIRED" && (
          <Notice tone="warning" title="EXPIRÉE" className="mb-6">
            La date limite de cette opportunité est dépassée : elle n&apos;est plus active. Elle reste consultable pour information.{" "}
            <Link href={`/opportunites${o.sector_slug ? `/${o.sector_slug}` : ""}`} className="font-semibold underline">
              Voir les opportunités ouvertes
            </Link>
          </Notice>
        )}
        {typeof sp.erreur === "string" && (
          <Notice tone="error" className="mb-6" title="Pièces jointes">
            {sp.erreur}
          </Notice>
        )}
        {sp.reponse === "envoyee" && (
          <Notice tone="success" title="Réponse envoyée" className="mb-6">
            Le demandeur a été notifié. Suivez l&apos;avancement dans{" "}
            <Link href="/dashboard/opportunites?onglet=reponses" className="font-semibold underline">
              vos réponses
            </Link>
            .
          </Notice>
        )}
        {o.is_demo && (
          <Notice tone="warning" className="mb-6">
            {DEMO_NOTICE}
          </Notice>
        )}
        {!isOpen && (isOwner || session?.isStaff) && ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "REJECTED", "SUSPENDED", "PAUSED"].includes(o.status) && (
          <Notice tone="info" className="mb-6" title="Aperçu non public">
            Cette opportunité n&apos;est visible que par votre entreprise et la modération (statut : <StatusBadge kind="opportunity" status={o.status} />).
          </Notice>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
          <article className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm [overflow-wrap:anywhere] sm:p-8">
            <div className="flex items-start gap-4">
              <SectorVisual sector={o.sector_slug} priority className="size-12 shrink-0 rounded-xl sm:size-14" />
              <div className="min-w-0 flex-1">
                {/* Provenance toujours indiquée : externe (avec la source) ou besoin publié par un membre */}
                <p data-testid="origin" className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  {external ? (
                    <>
                      {o.type === "PUBLIC_TENDER" ? <Landmark className="size-3.5" aria-hidden /> : <ExternalLink className="size-3.5" aria-hidden />}
                      <span>Opportunité externe</span>
                      {o.type !== "EXTERNAL_OPPORTUNITY" && (
                        <>
                          <span aria-hidden>·</span>
                          <span>{OPPORTUNITY_TYPE_LABELS[o.type]}</span>
                        </>
                      )}
                      <span aria-hidden>·</span>
                      <span>{source?.external_source?.name ?? "Source externe"}</span>
                    </>
                  ) : (
                    <>
                      <Building2 className="size-3.5 text-teal-700" aria-hidden />
                      <span className="text-teal-700">Besoin publié sur LinkProB2B</span>
                      {o.type !== "EXTERNAL_OPPORTUNITY" && (
                        <>
                          <span aria-hidden>·</span>
                          <span>{OPPORTUNITY_TYPE_LABELS[o.type]}</span>
                        </>
                      )}
                    </>
                  )}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <StatusBadge kind="opportunity" status={effectiveStatus} />
                  {o.visibility === "MEMBERS_ONLY" && (
                    <Badge tone="slate" icon={<Lock className="size-3" aria-hidden />}>
                      Réservée aux membres
                    </Badge>
                  )}
                  {o.is_demo && <DemoBadge />}
                </div>
              </div>
            </div>
            <h1 className="mt-5 text-xl leading-snug font-semibold tracking-tight text-navy [overflow-wrap:anywhere] sm:text-2xl lg:text-[1.75rem]">{o.title}</h1>

            {external ? (
              <p className="mt-2 text-sm text-slate-600">
                {o.external_buyer_name ? (
                  <>
                    <span className="text-slate-500">Acheteur (selon la source) :</span>{" "}
                    {buyerSlug(o.external_buyer_name) ? (
                      <Link href={`/acheteurs/${buyerSlug(o.external_buyer_name)}`} className="font-semibold text-navy underline-offset-2 hover:underline">
                        {o.external_buyer_name}
                      </Link>
                    ) : (
                      <strong className="text-navy">{o.external_buyer_name}</strong>
                    )}
                  </>
                ) : (
                  "Acheteur : voir la source originale"
                )}
              </p>
            ) : company ? (
              <Link href={`/entreprises/${company.slug}`} className="mt-3 inline-flex items-center gap-3 rounded-xl hover:bg-sky sm:pr-3">
                <CompanyLogo name={company.name} path={company.logo_path} size={40} />
                <span>
                  <span className="flex items-center gap-1 font-semibold text-navy">
                    {company.name}
                    {company.verified_at && <BadgeCheck className="size-4 text-teal-600" aria-label="Entreprise vérifiée" />}
                  </span>
                  <span className="block text-xs text-slate-500">{company.verified_at ? "Entreprise vérifiée par LinkProB2B" : "Entreprise non vérifiée"}</span>
                </span>
              </Link>
            ) : null}

            <dl className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 text-sm sm:grid-cols-2">
              <Fact icon={MapPin} label="Localisation" value={[(await getLocationLabel())(o.city, o.department_code), o.region && `— ${o.region}`].filter(Boolean).join(" ") || "—"} />
              <Fact icon={Tag} label="Secteur" value={sectorLabel(o.sector_slug, await getSectorLabels())} />
              <Fact icon={CalendarDays} label="Publication" value={formatDate(o.published_at)} />
              <Fact icon={CalendarClock} label="Échéance" value={o.response_deadline ? `${formatDateTime(o.response_deadline)}${deadline ? ` — ${deadline}` : ""}` : "Non précisée"} />
              {!external && <Fact icon={Wallet} label="Budget" value={budget ?? (o.budget_visible ? "Non précisé" : "Non communiqué")} />}
              {!external && o.max_suppliers && <Fact icon={Users} label="Fournisseurs souhaités" value={String(o.max_suppliers)} />}
              {o.start_date && <Fact icon={CalendarDays} label="Démarrage souhaité" value={formatDate(o.start_date)} />}
              {o.target_company_size && <Fact icon={Users} label="Taille de fournisseur visée" value={COMPANY_SIZE_LABELS[o.target_company_size]} />}
            </dl>

            <p className="mt-4 flex items-start gap-2 text-xs text-slate-500">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {OPPORTUNITY_TYPE_HELP[o.type]}
            </p>

            {o.summary && <p className="mt-6 text-lg text-navy">{o.summary}</p>}
            <Section title={external ? "Résumé" : "Description"}>
              <p className="whitespace-pre-line">{o.description}</p>
            </Section>
            {o.services && (
              <Section title="Prestations attendues">
                <p className="whitespace-pre-line">{o.services}</p>
              </Section>
            )}
            {o.skills.length > 0 && (
              <Section title="Compétences recherchées">
                <ul className="flex flex-wrap gap-2">
                  {o.skills.map((s) => (
                    <li key={s}>
                      <Badge tone="sky">{s}</Badge>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
            {o.constraints && (
              <Section title="Contraintes">
                <p className="whitespace-pre-line">{o.constraints}</p>
              </Section>
            )}
            {o.criteria && (
              <Section title="Critères de sélection">
                <p className="whitespace-pre-line">{o.criteria}</p>
              </Section>
            )}

            {!external && (
              <Section title="Documents">
                {!session ? (
                  <p className="flex items-center gap-2 text-sm text-slate-600">
                    <Lock className="size-4" aria-hidden /> Les documents sont accessibles aux membres connectés.{" "}
                    <Link className="font-semibold text-teal-700 underline" href={`/connexion?suite=/opportunites/${o.id}`}>
                      Se connecter
                    </Link>
                  </p>
                ) : o.documents.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucun document joint.</p>
                ) : (
                  <ul className="space-y-2">
                    {o.documents.map((d) => (
                      <li key={d.id}>
                        <a href={`/api/fichiers/opportunite/${d.id}`} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-teal hover:bg-teal-50">
                          <FileText className="size-4 text-teal-700" aria-hidden />
                          <span className="flex-1 truncate font-medium text-navy">{d.file_name}</span>
                          <span className="text-xs text-slate-500">{formatBytes(d.size_bytes)}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Eye className="size-3.5" aria-hidden />
                Provenance :{" "}
                {external ? `opportunité externe référencée (${source?.external_source?.name ?? "source externe"})` : "besoin publié sur LinkProB2B"}
              </span>
              <ReportButton targetType="OPPORTUNITY" targetId={o.id} signedIn={Boolean(session)} label="Signaler cette opportunité" />
            </div>
          </article>

          <aside className="min-w-0 space-y-4 [overflow-wrap:anywhere] lg:sticky lg:top-20 lg:self-start">
            {external ? (
              <div className="rounded-2xl border-2 border-amber-300 bg-white p-5 shadow-sm">
                <p className="flex items-center gap-2 font-heading text-lg font-bold text-navy">
                  <ExternalLink className="size-5 text-amber-600" aria-hidden /> Opportunité externe
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Cette opportunité est issue d&apos;une source externe. Consultez la source officielle pour les informations définitives et les modalités
                  de candidature. LinkProB2B n&apos;est pas l&apos;organisme qui publie ce marché.
                </p>
                <dl className="mt-4 space-y-2 text-sm">
                  <Row label="Source" value={source?.external_source?.name ?? "—"} />
                  {source?.external_id && <Row label="Référence" value={source.external_id} />}
                  <Row label="Publication (source)" value={formatDate(source?.source_published_at)} />
                  <Row label="Référencée le" value={formatDate(source?.imported_at)} />
                  <Row label="Dernière actualisation" value={formatDate(source?.last_verified_at)} />
                  {source?.verification_status && source.verification_status !== "VERIFIED" && (
                    <Row label="État" value={VERIFICATION_STATUS_LABELS[source.verification_status] ?? source.verification_status} />
                  )}
                  {source?.external_source?.license && <Row label="Conditions" value={source.external_source.license} />}
                </dl>
                {source?.external_source?.attribution && <p className="mt-3 text-xs text-slate-500">{source.external_source.attribution}</p>}
                {source?.original_url && (
                  <a
                    href={`/go/${o.id}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className={buttonClasses({ full: true, size: "lg", className: "mt-5" })}
                  >
                    Consulter l&apos;opportunité originale <ExternalLink className="size-4" aria-hidden />
                  </a>
                )}
                <p className="mt-2 text-center text-xs text-slate-500">Ouvre le site source dans un nouvel onglet.</p>
                {otherSources.length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-3 text-sm">
                    <p className="font-semibold text-navy">Également publiée sur</p>
                    <ul className="mt-1 space-y-1">
                      {otherSources.map((s) => (
                        <li key={s.source_id}>
                          <a href={`/go/${o.id}?source=${s.source_id}`} target="_blank" rel="noopener noreferrer nofollow" className="text-teal-700 underline">
                            {s.external_source?.name}
                            {s.external_id ? ` — réf. ${s.external_id}` : ""}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {source?.verification_status === "UNVERIFIABLE" && (
                  <Notice tone="warning" className="mt-4">
                    <span className="flex items-center gap-1">
                      <ShieldAlert className="size-4" aria-hidden /> Cette annonce n&apos;a pas pu être vérifiée récemment sur la source.
                    </span>
                  </Notice>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="mb-4 font-heading text-lg font-bold text-navy">Besoin publié sur LinkProB2B</p>
                <InterestPanel
                  opportunityId={o.id}
                  open={isOpen}
                  closedReason={closedReason}
                  signedIn={Boolean(session)}
                  hasCompany={Boolean(session?.activeCompany)}
                  isOwner={isOwner}
                  interest={interest?.data ?? null}
                  proposal={proposal?.data ?? null}
                  inPipeline={Boolean(pipeline?.data)}
                  openMessage={sp.message === "1"}
                />
              </div>
            )}
            <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <FavoriteButton target="opportunity" id={o.id} initial={Boolean(fav?.data)} signedIn={Boolean(session)} />
              {external && session?.activeCompany && <PipelineButton opportunityId={o.id} initial={Boolean(pipeline?.data)} />}
              {isOpen && o.response_deadline && (
                <a href={`/api/opportunites/${o.id}/agenda`} download className={buttonClasses({ variant: "outline", full: true })} data-testid="deadline-calendar">
                  <CalendarClock className="size-4" aria-hidden /> Ajouter l&apos;échéance à mon agenda
                </a>
              )}
            </div>
            {showLeadForm && (
              <AlertLeadForm
                compact
                label={leadLabel}
                sector={o.sector_slug}
                department={o.department_code}
                region={o.region}
                opportunityId={o.id}
                path={`/opportunites/${o.id}`}
              />
            )}
            {isOpen && o.visibility === "PUBLIC" && !o.is_demo && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <ShareLinks url={`${siteUrl()}/opportunites/${o.id}`} title={o.title} needId={external ? undefined : o.id} label={external ? undefined : "Faire connaître ce besoin"} />
              </div>
            )}
          </aside>
        </div>
        <SimilarOpportunities
          id={o.id}
          sector={o.sector_slug}
          department={o.department_code}
          region={o.region}
          signedIn={Boolean(session)}
          morePath={crumbs.at(-1)?.path ?? "/opportunites"}
          moreLabel={leadLabel}
        />
        <PartnersBlock sector={o.sector_slug} department={o.department_code} external={external} />
      </div>
    </div>
  );
}

/**
 * Entreprises du même secteur (annuaire public) : prestataires et partenaires
 * potentiels pour cette opportunité — de préférence dans le même département.
 */
async function PartnersBlock({ sector, department, external }: { sector: string | null; department: string | null; external: boolean }) {
  if (!sector) return null;
  const labels = await getSectorLabels();
  const local = department ? await searchCompanies(parseCompanyFilters({ secteur: sector, departement: department }), 4) : { rows: [] };
  const rows = local.rows.length >= 2 ? local.rows : (await searchCompanies(parseCompanyFilters({ secteur: sector }), 4)).rows;
  return (
    <section className="mt-12" aria-labelledby="partenaires">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="partenaires" className="text-xl font-bold">
            Trouver des partenaires
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {external
              ? "Entreprises du même secteur inscrites sur LinkProB2B : sous-traitants, co-traitants ou partenaires pour répondre à plusieurs."
              : "Entreprises inscrites sur LinkProB2B dont l'activité correspond à ce besoin."}
          </p>
        </div>
        <Link href={`/entreprises/${sector}`} className={buttonClasses({ variant: "outline", size: "sm", className: "min-h-9 h-auto! max-w-full py-1.5 text-left whitespace-normal!" })}>
          Voir les entreprises — {sectorLabel(sector, labels)}
        </Link>
      </div>
      {rows.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.slice(0, 4).map((c) => (
            <CompanyCard key={c.id} c={c} />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
          Aucune entreprise de ce secteur n&apos;est encore inscrite dans l&apos;annuaire. Vous proposez ce type de prestation ?{" "}
          <Link href="/inscription" className="font-semibold text-teal-700 underline">
            Créez votre profil
          </Link>{" "}
          pour être visible des acheteurs et des partenaires.
        </p>
      )}
    </section>
  );
}

/** Opportunités ouvertes du même secteur : d'abord le même département, puis la région, puis la France. */
async function SimilarOpportunities({
  id,
  sector,
  department,
  region,
  signedIn,
  morePath,
  moreLabel,
}: {
  id: string;
  sector: string | null;
  department: string | null;
  region: string | null;
  signedIn: boolean;
  morePath: string;
  moreLabel: string;
}) {
  if (!sector) return null;
  const base = { p_sector: sector, p_status: "OPEN", p_sort: "recent", p_limit: 7, p_include_demo: await showDemoData() };
  const seen = new Set([id]);
  const rows: NonNullable<Awaited<ReturnType<typeof visitorRpc<"search_opportunities">>>["data"]> = [];
  for (const scope of [department ? { p_department: department } : null, region ? { p_region: region } : null, {}]) {
    if (!scope || rows.length >= 6) continue;
    // Résultat public en cache (visiteurs anonymes, robots) : pas de nouvelle recherche à chaque fiche vue
    const { data } = await visitorRpc("search_opportunities", { ...base, ...scope });
    for (const r of data ?? []) {
      if (seen.has(r.id) || rows.length >= 6) continue;
      seen.add(r.id);
      rows.push(r);
    }
  }
  if (rows.length === 0) return null;
  return (
    <section className="mt-12" aria-labelledby="similaires">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 id="similaires" className="text-xl font-bold">
          Opportunités similaires
        </h2>
        <Link href={morePath} className="text-sm font-semibold text-teal-700 underline">
          Tous les marchés {moreLabel}
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {rows.map((r) => (
          <OpportunityCard key={r.id} o={r} headingLevel={3} />
        ))}
      </div>
      {!signedIn && (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl bg-sky p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-navy">Vous recherchez des opportunités similaires ? Créez votre compte LinkProB2B.</p>
          <Link href="/inscription" className={buttonClasses()}>
            Créer mon compte gratuitement
          </Link>
        </div>
      )}
    </section>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 bg-white px-4 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="mt-0.5 font-medium text-navy">{value}</dd>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-navy">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      <div className="text-[15px] leading-7 text-slate-700">{children}</div>
    </section>
  );
}
