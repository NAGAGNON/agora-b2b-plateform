import Link from "next/link";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { stripeConfigured, stripeMode } from "@/lib/billing/stripe";
import { confirmCheckoutSession, ENTITLED_STATUSES } from "@/lib/billing/sync";
import { PLANS, PLAN_LABEL, formatEuros, planInfo, priceTTC, type PlanCode } from "@/lib/billing/plans";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Badge } from "@/components/ui/badge";
import { CheckoutForm, PortalButton } from "@/components/dashboard/billing-forms";
import { ComparisonTable } from "@/components/billing/comparison-table";

export const metadata = { title: "Mon abonnement" };

const STATUS_LABEL: Record<string, string> = {
  active: "Actif",
  trialing: "Période d'essai",
  past_due: "Paiement en attente",
  unpaid: "Impayé",
  canceled: "Résilié",
  incomplete: "Paiement non finalisé",
  incomplete_expired: "Paiement expiré",
  paused: "En pause",
};

const INVOICE_STATUS: Record<string, string> = { paid: "Payée", open: "À payer", void: "Annulée", uncollectible: "Irrécouvrable", draft: "Brouillon" };

type Usage = { plan: PlanCode; features: Record<string, number | boolean | null>; active_needs: number; contact_requests_month: number; favorites: number; alerts: number; members: number };

export default async function SubscriptionPage(props: PageProps<"/dashboard/abonnement">) {
  const sp = await props.searchParams;
  const session = await requireCompany("/dashboard/abonnement");
  const company = session.activeCompany!.company;
  const isAdmin = session.activeCompany!.role === "COMPANY_ADMIN";

  // Retour de Stripe Checkout : application immédiate (le webhook confirme ensuite)
  let confirmation: "ok" | "pending" | "invalid" | null = null;
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : null;
  if (sp.paiement === "succes" && sessionId && stripeConfigured()) confirmation = await confirmCheckoutSession(sessionId, company.id);

  const supabase = await createClient();
  const [{ data: usageRaw }, { data: subs }, { data: invoices }] = await Promise.all([
    supabase.rpc("company_usage", { p_company_id: company.id }),
    supabase.from("subscriptions").select("*").eq("company_id", company.id).order("created_at", { ascending: false }).limit(5),
    isAdmin ? supabase.from("invoices").select("*").eq("company_id", company.id).order("created_at", { ascending: false }).limit(24) : Promise.resolve({ data: [] }),
  ]);
  const usage = usageRaw as unknown as Usage | null;
  const plan = (usage?.plan ?? "FREE") as PlanCode;
  const info = planInfo(plan);
  const sub = (subs ?? []).find((s) => (ENTITLED_STATUSES as readonly string[]).includes(s.status)) ?? null;
  const pastDue = sub?.status === "past_due";
  const configured = stripeConfigured();
  const mode = stripeMode();
  const amount = sub?.unit_amount_cents != null ? sub.unit_amount_cents / 100 : info.priceHT;

  const limits: { key: keyof Usage; label: string }[] = [
    { key: "active_needs", label: "Besoins actifs" },
    { key: "contact_requests_month", label: "Demandes de contact ce mois-ci" },
    { key: "favorites", label: "Favoris (personnels)" },
    { key: "alerts", label: "Alertes (personnelles)" },
    { key: "members", label: "Utilisateurs" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mon abonnement</h1>
        <p className="mt-1 text-sm text-slate-500">Offre de l&apos;entreprise {company.name}.</p>
      </div>

      {mode === "test" && configured && (
        <Notice tone="info" title="Paiement en mode test">
          Les paiements passent par l&apos;environnement de test de Stripe : aucune somme réelle n&apos;est débitée. Carte de test : 4242 4242 4242 4242, date future, CVC au choix.
        </Notice>
      )}
      {confirmation === "ok" && plan !== "FREE" && (
        <Notice tone="success" title={`🎉 Bienvenue sur LinkProB2B ${PLAN_LABEL[plan]}.`}>
          Votre abonnement est actif : toutes les fonctionnalités de l&apos;offre {PLAN_LABEL[plan]} sont disponibles dès maintenant.
        </Notice>
      )}
      {(confirmation === "pending" || (confirmation === "ok" && plan === "FREE")) && (
        <Notice tone="info" title="Paiement en cours de confirmation">
          Stripe confirme votre paiement : votre offre sera mise à jour dans quelques instants. Actualisez la page si besoin.
        </Notice>
      )}
      {sp.paiement === "annule" && (
        <Notice tone="warning" title="Paiement annulé">
          Aucun montant n&apos;a été débité. Vous pouvez reprendre la souscription quand vous le souhaitez.
        </Notice>
      )}
      {pastDue && (
        <Notice tone="error" title="Votre paiement n'a pas pu être traité">
          Stripe va retenter le prélèvement automatiquement et votre accès est conservé pendant ces relances. Pour éviter une interruption, mettez à jour votre
          moyen de paiement.
          {isAdmin && (
            <div className="mt-3">
              <PortalButton label="Mettre à jour mon moyen de paiement" variant="secondary" />
            </div>
          )}
        </Notice>
      )}

      <Card>
        <CardHeader
          title={
            <span className="flex flex-wrap items-center gap-2">
              Offre actuelle : LinkProB2B {info.name}
              {sub && <Badge tone={pastDue ? "red" : "green"}>{STATUS_LABEL[sub.status] ?? sub.status}</Badge>}
              {sub?.cancel_at_period_end && <Badge tone="amber">Résiliation programmée</Badge>}
            </span>
          }
          description={info.tagline}
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <p className="text-sm text-slate-500">Prix</p>
            <p className="font-heading text-2xl font-bold text-navy">
              {plan === "FREE" ? "0 €" : `${formatEuros(amount)} HT / mois`}
            </p>
            {plan !== "FREE" && <p className="text-xs text-slate-500">soit {formatEuros(priceTTC(amount))} TTC (TVA 20 %)</p>}
          </div>
          {sub?.current_period_end && (
            <div>
              <p className="text-sm text-slate-500">{sub.cancel_at_period_end ? "Accès jusqu'au" : "Prochain renouvellement"}</p>
              <p className="font-semibold text-navy">{formatDate(sub.current_period_end)}</p>
              {sub.cancel_at_period_end && <p className="text-xs text-slate-500">Votre entreprise repassera ensuite à l&apos;offre Gratuite. Toutes vos données sont conservées.</p>}
            </div>
          )}
        </div>
        {isAdmin && sub && (
          <div className="flex flex-wrap gap-3 border-t border-slate-100 p-5">
            <PortalButton label="Gérer mon abonnement" />
            <p className="w-full text-xs text-slate-500">
              Le portail sécurisé Stripe permet de changer de formule (Pro ↔ Business), mettre à jour le moyen de paiement, télécharger les factures et résilier.
            </p>
          </div>
        )}
        {!isAdmin && <p className="border-t border-slate-100 p-5 text-sm text-slate-500">Seul un administrateur de l&apos;entreprise peut modifier l&apos;abonnement.</p>}
      </Card>

      {usage && (
        <Card>
          <CardHeader title="Utilisation" description="Les limites de l'offre s'appliquent aux nouveaux ajouts ; rien n'est jamais supprimé." />
          <ul className="divide-y divide-slate-100">
            {limits.map((l) => {
              const max = usage.features?.[l.key as string];
              const used = usage[l.key] as number;
              const unlimited = max === null || max === undefined;
              const full = !unlimited && typeof max === "number" && used >= max;
              return (
                <li key={l.key} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="text-slate-700">{l.label}</span>
                  <span className={full ? "font-semibold text-amber-700" : "font-semibold text-navy"}>
                    {used} {unlimited ? "· illimité" : `/ ${max}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {plan !== "BUSINESS" && !sub && (
        <section aria-labelledby="upgrade-title">
          <h2 id="upgrade-title" className="text-lg font-bold">
            Passer à une offre supérieure
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Commencez gratuitement. Passez à Pro lorsque vous avez besoin de davantage d&apos;opportunités, d&apos;alertes et d&apos;outils commerciaux.
          </p>
          {!configured ? (
            <Notice tone="info" className="mt-4">
              Le paiement en ligne n&apos;est pas encore activé. Revenez prochainement.
            </Notice>
          ) : !isAdmin ? (
            <Notice tone="info" className="mt-4">
              Demandez à un administrateur de votre entreprise de souscrire.
            </Notice>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {PLANS.filter((p) => p.code !== "FREE" && p.code !== plan).map((p) => (
                <Card key={p.code} className={p.popular ? "border-teal ring-1 ring-teal" : undefined}>
                  <div className="space-y-3 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-bold">LinkProB2B {p.name}</h3>
                      {p.popular && <Badge tone="teal">Le plus populaire</Badge>}
                    </div>
                    <p className="font-heading text-2xl font-bold text-navy">
                      {formatEuros(p.priceHT)} <span className="text-sm font-medium text-slate-500">HT / mois</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      soit {formatEuros(priceTTC(p.priceHT))} TTC · sans engagement, résiliable à tout moment
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {p.highlights.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                    <CheckoutForm plan={p.code as "PRO" | "BUSINESS"} label={p.cta} variant={p.popular ? "primary" : "secondary"} />
                  </div>
                </Card>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Paiement sécurisé par Stripe : vos coordonnées bancaires sont saisies sur la page de Stripe et ne transitent jamais par LinkProB2B.{" "}
            <Link href="/tarifs" className="underline">
              Comparer les offres
            </Link>{" "}
            ·{" "}
            <Link href="/conditions-abonnement" className="underline">
              Conditions d&apos;abonnement
            </Link>
          </p>
        </section>
      )}

      {isAdmin && (invoices ?? []).length > 0 && (
        <Card>
          <CardHeader title="Factures" />
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-2">Date</th>
                  <th className="px-5 py-2">Numéro</th>
                  <th className="px-5 py-2">Montant TTC</th>
                  <th className="px-5 py-2">Statut</th>
                  <th className="px-5 py-2">
                    <span className="sr-only">Lien</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(invoices ?? []).map((i) => (
                  <tr key={i.id}>
                    <td className="px-5 py-2 whitespace-nowrap">{formatDate(i.period_start ?? i.created_at)}</td>
                    <td className="px-5 py-2">{i.number ?? "—"}</td>
                    <td className="px-5 py-2 whitespace-nowrap">{formatEuros((i.status === "paid" ? i.amount_paid_cents : i.amount_due_cents) / 100)}</td>
                    <td className="px-5 py-2">{INVOICE_STATUS[i.status] ?? i.status}</td>
                    <td className="px-5 py-2 text-right">
                      {(i.hosted_invoice_url || i.invoice_pdf) && (
                        <a href={i.invoice_pdf ?? i.hosted_invoice_url!} target="_blank" rel="noopener noreferrer" className="font-semibold text-teal-700 underline">
                          Télécharger
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <details className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
        <summary className="cursor-pointer font-semibold text-navy">Comparer les offres en détail</summary>
        <ComparisonTable />
      </details>
    </div>
  );
}
