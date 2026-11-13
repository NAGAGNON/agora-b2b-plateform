import Link from "next/link";
import { Crown, Eye, Megaphone, Users } from "lucide-react";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { Card, CardHeader, DashboardCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { BoostForm } from "@/components/dashboard/boost-form";
import { CancelBoostButton } from "@/components/dashboard/boost-actions";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { freeLaunch } from "@/lib/billing/entitlements";
import { BOOST_STATUS_LABEL } from "@/lib/visibility";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Visibilité" };

/**
 * Offre « Visibilité » : demande (validée par l'équipe) et suivi réel jour après jour (présentations
 * réalisées, vues de la fiche ou du besoin depuis le démarrage). Gratuite pendant la phase de lancement.
 */
export default async function VisibilityPage(props: PageProps<"/dashboard/visibilite">) {
  const sp = await props.searchParams;
  const session = await requireCompany("/dashboard/visibilite");
  const company = session.activeCompany.company;
  const supabase = await createClient();
  const [{ data: needs }, { data: boosts }, free] = await Promise.all([
    supabase.from("opportunities").select("id, title").eq("company_id", company.id).eq("origin", "INTERNAL").eq("status", "PUBLISHED").order("created_at", { ascending: false }).limit(20),
    supabase.from("visibility_boosts").select("*").eq("company_id", company.id).order("created_at", { ascending: false }).limit(20),
    freeLaunch(),
  ]);
  // Entreprises inscrites qui peuvent découvrir l'entreprise (présentation dans leur espace)
  const { count: members } = await createAdminClient().from("companies").select("id", { count: "exact", head: true }).eq("status", "ACTIVE").eq("is_demo", false).neq("id", company.id);
  const titles = new Map((needs ?? []).map((n) => [n.id, n.title]));
  // Suivi : présentations réalisées et vues depuis le démarrage (chiffres enregistrés uniquement)
  const admin = createAdminClient();
  const stats = new Map(
    await Promise.all(
      (boosts ?? [])
        .filter((b) => b.starts_at)
        .map(async (b) => {
          const path = b.opportunity_id ? `/opportunites/${b.opportunity_id}` : `/entreprises/${company.slug}`;
          const [{ count: presented }, { count: views }] = await Promise.all([
            admin.from("boost_presentations").select("id", { count: "exact", head: true }).eq("boost_id", b.id),
            admin.from("page_views").select("id", { count: "exact", head: true }).eq("path", path).gte("created_at", b.starts_at!),
          ]);
          return [b.id, { presented: presented ?? 0, views: views ?? 0 }] as const;
        }),
    ),
  );
  const isAdmin = session.activeCompany.role === "COMPANY_ADMIN";
  const targets = [{ value: "COMPANY", label: `Mon entreprise : ${company.name}` }, ...(needs ?? []).map((n) => ({ value: n.id, label: `Mon besoin : ${n.title}` }))];

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        icon={<Megaphone />}
        image="/images/illustrations/reunion.webp"
        title="Visibilité"
        description="Faites connaître votre entreprise ou votre besoin : présentation chaque jour à des entreprises ciblées, et affichage « À la une ». Vous suivez les résultats ici, jour après jour."
      />
      {free && (
        <Notice tone="success" title="Gratuit pendant la phase de lancement">
          Profitez-en : les offres de visibilité sont offertes pendant la phase de lancement de LinkProB2B.
        </Notice>
      )}
      <Card>
        <CardHeader title="Nouvelle demande" description="Plus vous choisissez d'entreprises et de jours, plus vous êtes visible. Chaque demande est vérifiée par l'équipe avant de démarrer." />
        <div className="p-5">
          {isAdmin ? (
            <BoostForm targets={targets} freeLaunch={free} memberCapacity={members ?? 0} defaultTarget={typeof sp.cible === "string" ? sp.cible : undefined} />
          ) : (
            <Notice tone="info">Seul un administrateur de l&apos;entreprise peut demander une offre de visibilité.</Notice>
          )}
        </div>
      </Card>
      <Card>
        <CardHeader title="Mes offres de visibilité" description={`${boosts?.length ?? 0} demande(s)`} />
        {!boosts?.length ? (
          <p className="p-5 text-sm text-slate-600">Aucune demande pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {boosts.map((b) => {
              const s = stats.get(b.id);
              return (
                <li key={b.id} className="space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-navy">{b.opportunity_id ? `Besoin : ${titles.get(b.opportunity_id) ?? "besoin"}` : `Entreprise : ${company.name}`}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {b.daily_presentations > 0 && `${b.daily_presentations} entreprises par jour pendant ${b.duration_days} jours`}
                        {b.daily_presentations > 0 && b.featured_days > 0 && " · "}
                        {b.featured_days > 0 && `${b.featured_days} jours « À la une »`}
                        {b.starts_at && b.ends_at && ` · du ${formatDate(b.starts_at)} au ${formatDate(b.ends_at)}`}
                      </p>
                      {b.status === "REJECTED" && b.note && <p className="mt-1 text-sm text-slate-500">Motif : {b.note}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={b.status === "ACTIVE" ? "green" : b.status === "PENDING" ? "sky" : "slate"}>{BOOST_STATUS_LABEL[b.status] ?? b.status}</Badge>
                      {b.status === "PENDING" && isAdmin && <CancelBoostButton id={b.id} />}
                    </div>
                  </div>
                  {s && (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      <DashboardCard label={b.opportunity_id ? "Entreprises présentées (espace membre)" : "Entreprises à qui vous avez été présenté"} value={s.presented} icon={<Users className="size-5" aria-hidden />} />
                      <DashboardCard label={b.opportunity_id ? "Vues du besoin" : "Vues de votre fiche"} value={s.views} icon={<Eye className="size-5" aria-hidden />} />
                      {b.featured_until && (
                        <DashboardCard
                          label="« À la une » jusqu'au"
                          value={formatDate(b.featured_until)}
                          icon={<Crown className="size-5" aria-hidden />}
                        />
                      )}
                    </div>
                  )}
                  {b.opportunity_id && b.status === "ACTIVE" && (
                    <p className="text-sm text-slate-600">
                      Les entreprises du métier contactées par e-mail pour ce besoin apparaissent dans le{" "}
                      <Link href={`/dashboard/opportunites/${b.opportunity_id}`} className="font-semibold text-teal-700 hover:underline">
                        suivi du besoin
                      </Link>
                      .
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
