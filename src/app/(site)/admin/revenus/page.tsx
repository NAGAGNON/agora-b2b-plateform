import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/format";
import { formatEuros } from "@/lib/billing/plans";
import { stripeMode } from "@/lib/billing/stripe";

export const metadata = { title: "Revenus" };
export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const nowMs = () => Date.now();
const PLAN: Record<string, string> = { PRO: "Pro", BUSINESS: "Business", FREE: "Gratuit" };
const STATUS: Record<string, string> = {
  trialing: "Essai en cours",
  active: "Actif",
  past_due: "Paiement en retard",
  canceled: "Terminé",
  unpaid: "Impayé",
  incomplete: "Paiement non finalisé",
  incomplete_expired: "Paiement expiré",
  paused: "En pause",
};
const EVENT: Record<string, string> = {
  "checkout.session.completed": "Paiement / essai validé sur Stripe",
  "customer.subscription.created": "Abonnement créé",
  "customer.subscription.updated": "Abonnement modifié",
  "customer.subscription.deleted": "Abonnement terminé",
  "customer.subscription.trial_will_end": "Fin d'essai dans 3 jours",
  "invoice.paid": "Facture payée",
  "invoice.payment_failed": "Paiement échoué",
};
const REASON: Record<string, string> = {
  cancellation_requested: "Résiliation demandée",
  payment_failed: "Paiement échoué",
  payment_disputed: "Paiement contesté",
};

/** Mensualité HT d'un abonnement (annuel ramené au mois). */
const monthly = (cents: number | null, interval: string | null) => (cents ? (interval === "year" ? cents / 12 : cents) / 100 : 0);

/**
 * Revenus et parcours d'achat (administration) : revenu mensuel récurrent, abonnés, essais, conversions,
 * résiliations (churn), entonnoir des 30 derniers jours, paiements abandonnés et journal Stripe.
 * Chiffres lus en base (synchronisés depuis Stripe) : rien n'est estimé.
 */
export default async function RevenuePage() {
  await requireAdmin();
  const db = createAdminClient();
  const now = nowMs();
  const since30 = new Date(now - 30 * DAY).toISOString();
  const today = new Date(now);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  const [{ data: subs }, { data: invoices }, { data: events }, { data: checkouts }, { count: signups }, { count: companiesNew }, { data: views }, { data: essaiViews }] = await Promise.all([
    db.from("subscriptions").select("*").order("created_at", { ascending: false }).limit(1000),
    db.from("invoices").select("company_id, stripe_subscription_id, status, amount_paid_cents, created_at").order("created_at", { ascending: false }).limit(2000),
    db.from("billing_events").select("stripe_event_id, type, company_id, processed_at").order("processed_at", { ascending: false }).limit(40),
    db
      .from("audit_logs")
      .select("entity_id, action, metadata, created_at, actor_user_id")
      .in("action", ["billing.checkout_started", "billing.card_trial_started", "billing.founder_checkout_started"])
      .gte("created_at", since30)
      .order("created_at", { ascending: false })
      .limit(500),
    db.from("users").select("id", { count: "exact", head: true }).gte("created_at", since30).eq("is_internal", false),
    db.from("companies").select("id", { count: "exact", head: true }).gte("created_at", since30).eq("is_demo", false),
    db.from("page_views").select("session_id").gte("created_at", since30).limit(100_000),
    db.from("page_views").select("session_id").eq("path", "/essai").gte("created_at", since30).limit(10_000),
  ]);
  const S = subs ?? [];
  const I = invoices ?? [];
  const companyIds = [...new Set([...S.map((s) => s.company_id), ...(checkouts ?? []).map((c) => c.entity_id).filter(Boolean), ...(events ?? []).map((e) => e.company_id).filter(Boolean)])] as string[];
  const { data: companies } = companyIds.length ? await db.from("companies").select("id, name, slug").in("id", companyIds) : { data: [] };
  const name = new Map((companies ?? []).map((c) => [c.id, c]));

  // Indicateurs
  const paying = S.filter((s) => ["active", "past_due"].includes(s.status));
  const trials = S.filter((s) => s.status === "trialing");
  const mrr = paying.reduce((t, s) => t + monthly(s.unit_amount_cents, s.billing_interval), 0);
  const trialMrr = trials.reduce((t, s) => t + monthly(s.unit_amount_cents, s.billing_interval), 0);
  const paidInvoices = I.filter((i) => i.amount_paid_cents > 0);
  const cashMonth = paidInvoices.filter((i) => i.created_at >= monthStart).reduce((t, i) => t + i.amount_paid_cents, 0) / 100;
  const cashTotal = paidInvoices.reduce((t, i) => t + i.amount_paid_cents, 0) / 100;
  const paidSubs = new Set(paidInvoices.map((i) => i.stripe_subscription_id));
  const endedTrials = S.filter((s) => s.trial_end && new Date(s.trial_end).getTime() < now);
  const converted = endedTrials.filter((s) => paidSubs.has(s.stripe_subscription_id));
  const churned30 = S.filter((s) => (s.ended_at ?? s.canceled_at) && new Date((s.ended_at ?? s.canceled_at)!).getTime() >= now - 30 * DAY && s.status === "canceled");
  const churnBase = paying.length + churned30.length;
  const scheduled = S.filter((s) => s.cancel_at_period_end && ["active", "trialing", "past_due"].includes(s.status));
  const failed = S.filter((s) => ["past_due", "unpaid", "incomplete"].includes(s.status));
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10} %` : "—");

  // Entonnoir des 30 derniers jours
  const visitors = new Set((views ?? []).map((v) => v.session_id)).size;
  const essaiVisitors = new Set((essaiViews ?? []).map((v) => v.session_id)).size;
  const checkoutCompanies = new Set((checkouts ?? []).map((c) => c.entity_id));
  const started30 = S.filter((s) => s.created_at >= since30);
  const startedCompanies = new Set(S.map((s) => s.company_id));
  const paid30 = new Set(paidInvoices.filter((i) => i.created_at >= since30).map((i) => i.company_id)).size;
  const funnel = [
    { label: "Visiteurs du site", n: visitors },
    { label: "Comptes créés", n: signups ?? 0 },
    { label: "Entreprises créées", n: companiesNew ?? 0 },
    { label: "Visites de la page d'essai", n: essaiVisitors },
    { label: "Ouverture du paiement Stripe", n: checkoutCompanies.size },
    { label: "Essais ou abonnements démarrés", n: started30.length },
    { label: "Premiers paiements reçus", n: paid30 },
  ];
  // Paiements ouverts mais jamais finalisés (abandon sur la page Stripe)
  const abandoned = [...new Map((checkouts ?? []).filter((c) => c.entity_id && !startedCompanies.has(c.entity_id)).map((c) => [c.entity_id, c])).values()];

  const mode = stripeMode();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">Revenus</h1>
        <p className="mt-1 text-sm text-slate-600">
          Abonnements, essais, paiements et résiliations, synchronisés depuis Stripe{mode ? ` (mode ${mode === "live" ? "LIVE" : "test"})` : " (Stripe non configuré)"}. Vous êtes prévenu
          par notification et par e-mail à chaque essai, paiement, résiliation ou paiement échoué.
        </p>
      </div>

      <section aria-label="Indicateurs" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { l: "Revenu mensuel récurrent (HT)", v: formatEuros(Math.round(mrr * 100) / 100), h: `${formatEuros(Math.round(mrr * 12 * 100) / 100)} HT sur un an` },
          { l: "Abonnés payants", v: String(paying.length), h: `Pro ${paying.filter((s) => s.plan_code === "PRO").length} · Business ${paying.filter((s) => s.plan_code === "BUSINESS").length}` },
          { l: "Essais en cours", v: String(trials.length), h: trialMrr ? `${formatEuros(Math.round(trialMrr * 100) / 100)} HT/mois s'ils continuent` : "—" },
          { l: "Encaissé ce mois (TTC)", v: formatEuros(cashMonth), h: `${formatEuros(cashTotal)} TTC depuis le début` },
          { l: "Essais convertis", v: pct(converted.length, endedTrials.length), h: `${converted.length} sur ${endedTrials.length} essai(s) terminé(s)` },
          { l: "Churn (30 jours)", v: pct(churned30.length, churnBase), h: `${churned30.length} abonnement(s) terminé(s)` },
          { l: "Résiliations programmées", v: String(scheduled.length), h: "actifs jusqu'à la fin de la période" },
          { l: "Paiements en difficulté", v: String(failed.length), h: "en retard, impayés ou non finalisés" },
        ].map((k) => (
          <div key={k.l} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{k.l}</p>
            <p className="mt-1 font-heading text-2xl font-extrabold text-navy">{k.v}</p>
            <p className="mt-0.5 text-xs text-slate-500">{k.h}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="entonnoir" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 id="entonnoir" className="font-bold text-navy">
          Parcours d&apos;achat — 30 derniers jours
        </h2>
        <p className="mt-1 text-sm text-slate-600">Chaque étape et la part de l&apos;étape précédente : là où la barre chute, c&apos;est là que les gens quittent.</p>
        <ol className="mt-4 space-y-2">
          {funnel.map((f, i) => {
            const top = funnel[0].n || 1;
            const prev = i ? funnel[i - 1].n : 0;
            return (
              <li key={f.label} className="grid grid-cols-[14rem_1fr_6rem] items-center gap-3 text-sm">
                <span className="text-slate-700">{f.label}</span>
                <span className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-teal" style={{ width: `${Math.max(f.n ? 2 : 0, Math.round((f.n / top) * 100))}%` }} />
                </span>
                <span className="text-right font-semibold text-navy">
                  {f.n.toLocaleString("fr-FR")}
                  {i > 0 && <span className="ml-1 text-xs font-normal text-slate-500">{pct(f.n, prev)}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="abandons" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 id="abandons" className="font-bold text-navy">
          Paiements abandonnés (30 jours)
        </h2>
        <p className="mt-1 text-sm text-slate-600">Entreprises qui ont ouvert la page de paiement Stripe sans aller au bout.</p>
        {abandoned.length ? (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {abandoned.map((c) => {
              const co = name.get(c.entity_id!);
              const m = (c.metadata ?? {}) as { plan?: string; interval?: string };
              return (
                <li key={c.entity_id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="font-semibold text-navy">{co ? <Link href={`/entreprises/${co.slug}`}>{co.name}</Link> : "Entreprise"}</span>
                  <span className="text-slate-600">
                    {PLAN[m.plan ?? ""] ?? m.plan ?? "—"} {m.interval === "year" ? "annuel" : "mensuel"} · {formatDateTime(c.created_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Aucun pour l&apos;instant.</p>
        )}
      </section>

      <section aria-labelledby="abonnements" className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <h2 id="abonnements" className="p-5 pb-0 font-bold text-navy">
          Abonnements
        </h2>
        <div className="overflow-x-auto p-5">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-3">Entreprise</th>
                <th className="py-2 pr-3">Offre</th>
                <th className="py-2 pr-3">Statut</th>
                <th className="py-2 pr-3">Début</th>
                <th className="py-2 pr-3">Fin d&apos;essai / période</th>
                <th className="py-2 pr-3">Résiliation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {S.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 pr-3 font-semibold text-navy">{name.get(s.company_id)?.name ?? "—"}</td>
                  <td className="py-2 pr-3">
                    {PLAN[s.plan_code] ?? s.plan_code} {s.billing_interval === "year" ? "annuel" : "mensuel"}
                    {s.unit_amount_cents ? ` · ${formatEuros(s.unit_amount_cents / 100)} HT` : ""}
                  </td>
                  <td className="py-2 pr-3">{STATUS[s.status] ?? s.status}</td>
                  <td className="py-2 pr-3 text-slate-600">{s.started_at ? formatDateTime(s.started_at) : "—"}</td>
                  <td className="py-2 pr-3 text-slate-600">{s.status === "trialing" && s.trial_end ? `essai → ${formatDateTime(s.trial_end)}` : s.current_period_end ? formatDateTime(s.current_period_end) : "—"}</td>
                  <td className="py-2 pr-3 text-slate-600">
                    {s.cancel_at_period_end || s.status === "canceled" ? (
                      <>
                        {s.status === "canceled" ? "Terminé" : "Programmée"}
                        {s.cancel_reason && ` · ${REASON[s.cancel_reason] ?? s.cancel_reason}`}
                        {s.cancel_feedback && ` · « ${s.cancel_feedback} »`}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {!S.length && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    Aucun abonnement pour l&apos;instant : les offres payantes ne sont pas encore lancées.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="journal" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 id="journal" className="font-bold text-navy">
          Journal Stripe (40 derniers événements)
        </h2>
        {events?.length ? (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {events.map((e) => (
              <li key={e.stripe_event_id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="text-navy">
                  {EVENT[e.type] ?? e.type}
                  {e.company_id && <span className="text-slate-600"> · {name.get(e.company_id)?.name ?? "entreprise"}</span>}
                </span>
                <span className="text-slate-500">{formatDateTime(e.processed_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Aucun événement pour l&apos;instant.</p>
        )}
      </section>
    </div>
  );
}
