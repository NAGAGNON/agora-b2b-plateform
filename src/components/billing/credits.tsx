import Link from "next/link";
import { ArrowRight, CalendarClock, Check, Coins, Crown, Gift, History, Infinity as InfinityIcon, PartyPopper, Rocket, Search, Sparkles, X } from "lucide-react";
import { FOUNDER_MONTHS, FOUNDER_PRO_HT, OFFER_PLANS, TRIAL_DAYS, euros, frDate, ttc, type OfferCode } from "@/lib/billing/offer";
import { cn } from "@/lib/cn";

/**
 * Écrans de l'offre par crédits. Ils ne s'affichent nulle part tant que les crédits sont éteints
 * (« billing.credits_enabled ») ; seule la page d'aperçu réservée à l'équipe les montre.
 */

/** Solde dans l'en-tête, à côté du nom : toujours visible, un clic ouvre « Mon abonnement ». */
export function CreditBadge({ balance, unlimited }: { balance: number | null; unlimited: boolean }) {
  const empty = !unlimited && (balance ?? 0) === 0;
  return (
    <Link
      href="/dashboard/abonnement#credits"
      data-testid="credit-badge"
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-bold ring-1 transition hover:-translate-y-px",
        empty ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-teal-50 text-teal-800 ring-teal/30",
      )}
      aria-label={unlimited ? "Candidatures illimitées" : `${balance} crédit${(balance ?? 0) > 1 ? "s" : ""} restant${(balance ?? 0) > 1 ? "s" : ""}`}
    >
      {unlimited ? <InfinityIcon className="size-4" aria-hidden /> : <Coins className="size-4" aria-hidden />}
      {unlimited ? "Illimité" : `${balance} crédit${(balance ?? 0) > 1 ? "s" : ""}`}
    </Link>
  );
}

/** Carte du tableau de bord : le solde du mois et la date de recharge. */
export function CreditSummaryCard({ plan, balance, perPeriod, renewsAt }: { plan: OfferCode; balance: number | null; perPeriod: number | null; renewsAt: string }) {
  const unlimited = perPeriod === null;
  const pct = unlimited || !perPeriod ? 100 : Math.round(((balance ?? 0) / perPeriod) * 100);
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6" data-testid="credit-summary">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">Vos candidatures ce mois-ci · {OFFER_PLANS.find((p) => p.code === plan)?.name}</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-navy">
            {unlimited ? "Illimitées" : (
              <>
                {balance} <span className="text-lg font-bold text-slate-400">sur {perPeriod}</span>
              </>
            )}
          </p>
        </div>
        <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal to-violet text-white">
          {unlimited ? <InfinityIcon className="size-5" aria-hidden /> : <Coins className="size-5" aria-hidden />}
        </span>
      </div>
      {!unlimited && (
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-teal to-violet transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-600">
        <CalendarClock className="size-4 text-teal-700" aria-hidden /> {unlimited ? "Aucune limite avec Business" : `Rechargées le ${frDate(renewsAt)}`}
        <Link href="/dashboard/abonnement#credits" className="ml-auto font-semibold text-teal-700 hover:underline">
          Détail
        </Link>
      </p>
    </section>
  );
}

/** Une carte de formule (choix après l'inscription, fenêtre « crédits épuisés »). */
function PlanCard({ code, founder, trialEligible, compact = false }: { code: OfferCode; founder?: boolean; trialEligible: boolean; compact?: boolean }) {
  const p = OFFER_PLANS.find((x) => x.code === code)!;
  const dark = code === "BUSINESS";
  const pro = code === "PRO";
  const price = founder && pro ? FOUNDER_PRO_HT : p.priceHT;
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-3xl p-5 ring-1 transition hover:-translate-y-1 hover:shadow-xl sm:p-6",
        dark ? "bg-navy text-white ring-navy" : pro ? "bg-white text-navy shadow-lg ring-2 ring-teal" : "bg-white text-navy ring-slate-200",
      )}
    >
      {pro && <span className="absolute -top-3 left-5 rounded-full bg-gradient-to-r from-teal to-electric px-3 py-1 text-xs font-bold text-navy shadow">Recommandé</span>}
      <p className="font-heading text-xl font-bold">{p.name}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="font-heading text-4xl font-extrabold">{euros(price)}</span>
        <span className={cn("text-sm", dark ? "text-slate-300" : "text-slate-500")}>{p.priceHT ? "HT / mois" : "pour toujours"}</span>
      </p>
      {founder && pro ? (
        <p className="mt-1 text-xs font-semibold text-violet-700">
          Tarif fondateur les {FOUNDER_MONTHS} premiers mois, puis {euros(p.priceHT)} HT
        </p>
      ) : p.priceHT ? (
        <p className={cn("mt-1 text-xs", dark ? "text-slate-400" : "text-slate-500")}>soit {euros(ttc(price))} TTC</p>
      ) : (
        <p className="mt-1 text-xs text-slate-500">sans carte bancaire</p>
      )}
      <p className={cn("mt-4 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold", dark ? "bg-white/10 text-teal" : "bg-teal-50 text-teal-800")}>
        {p.credits === null ? <InfinityIcon className="size-4" aria-hidden /> : <Coins className="size-4" aria-hidden />}
        {p.credits === null ? "Candidatures illimitées" : `${p.credits} candidatures par mois`}
      </p>
      {!compact && <p className={cn("mt-3 text-sm", dark ? "text-slate-300" : "text-slate-600")}>{p.pitch}</p>}
      <ul className="mt-4 flex-1 space-y-2 text-sm">
        {(compact ? p.includes.slice(0, 4) : p.includes).map((f) => (
          <li key={f} className="flex gap-2">
            <Check className={cn("mt-0.5 size-4 shrink-0", dark ? "text-teal" : "text-teal-700")} aria-hidden />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <span
        className={cn(
          "btn-shine mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition",
          code === "FREE" ? "bg-slate-100 text-navy" : dark ? "bg-white text-navy" : "bg-gradient-to-r from-teal to-electric text-navy shadow-lg shadow-teal/20",
        )}
      >
        {code === "FREE" ? "Commencer gratuitement" : trialEligible ? `Essayer ${p.name} ${TRIAL_DAYS} jours` : `Passer à ${p.name}`}
        <ArrowRight className="size-4" aria-hidden />
      </span>
      {code !== "FREE" && trialEligible && (
        <p className={cn("mt-2 text-center text-xs", dark ? "text-slate-400" : "text-slate-500")}>0 € aujourd&apos;hui · carte demandée · résiliable en un clic</p>
      )}
    </div>
  );
}

/** Après l'inscription (avec ou sans entreprise) : choisir sa formule, une seule fois. */
export function PlanChoice({ companyName }: { companyName: string | null }) {
  return (
    <section className="rounded-[2rem] bg-gradient-to-br from-sky via-white to-teal-50 p-5 ring-1 ring-slate-200 sm:p-10" data-testid="plan-choice">
      <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold tracking-wide text-teal-700 uppercase shadow-sm ring-1 ring-teal/20">
        <Sparkles className="size-3.5" aria-hidden /> Dernière étape
      </p>
      <h1 className="mt-3 font-heading text-2xl font-extrabold text-navy sm:text-4xl">{companyName ? `${companyName} est prête.` : "Votre compte est prêt."} Choisissez votre formule</h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        1 crédit = 1 candidature commencée. Chercher, lire les offres et recevoir la veille du matin restent gratuits, quelle que soit la formule.
      </p>
      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <PlanCard code="FREE" trialEligible />
        <PlanCard code="PRO" trialEligible />
        <PlanCard code="BUSINESS" trialEligible />
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">Vous pourrez changer de formule à tout moment depuis « Mon abonnement ».</p>
    </section>
  );
}

/** Choix de Gratuit : bienvenue, ce que valent les crédits, date de recharge. */
export function FreeWelcome({ renewsAt }: { renewsAt: string }) {
  return (
    <section className="relative isolate overflow-hidden rounded-[2rem] bg-white p-6 text-center shadow-xl ring-1 ring-slate-200 sm:p-12" data-testid="free-welcome">
      <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 -z-10 size-80 -translate-x-1/2 animate-aurora rounded-full bg-teal/20 blur-3xl" />
      <span className="mx-auto flex size-16 animate-pop items-center justify-center rounded-3xl bg-gradient-to-br from-teal to-violet text-white shadow-lg">
        <PartyPopper className="size-8" aria-hidden />
      </span>
      <h1 className="mt-5 font-heading text-3xl font-extrabold text-navy sm:text-4xl">Félicitations, vous avez 5 crédits !</h1>
      <p className="mx-auto mt-3 max-w-xl text-slate-600">De quoi préparer 5 candidatures ce mois-ci, avec le parcours en 7 étapes.</p>
      <div className="mx-auto mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
        {[
          { icon: Coins, t: "1 crédit = 1 candidature", d: "Quand vous cliquez « Oui, je prépare ma candidature »." },
          { icon: Search, t: "Le reste est gratuit", d: "Chercher, lire les offres, la veille du matin." },
          { icon: CalendarClock, t: `Rechargés le ${frDate(renewsAt)}`, d: "Chaque mois, 5 nouveaux crédits (sans report)." },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <Icon className="size-5 text-teal-700" aria-hidden />
            <p className="mt-2 font-semibold text-navy">{t}</p>
            <p className="mt-1 text-sm text-slate-600">{d}</p>
          </div>
        ))}
      </div>
      <span className="btn-shine mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-teal to-electric px-6 font-bold text-navy shadow-lg">
        Voir les offres pour mon entreprise <ArrowRight className="size-4" aria-hidden />
      </span>
      <p className="mt-4 text-sm text-slate-500">Besoin de plus ? Pro : 20 candidatures par mois pour 29 € HT, depuis « Mon abonnement ».</p>
    </section>
  );
}

/** La seule fenêtre : il veut commencer une candidature et n'a plus de crédit. */
export function OutOfCredits({ plan, renewsAt, trialEligible, founder }: { plan: "FREE" | "PRO"; renewsAt: string; trialEligible: boolean; founder: boolean }) {
  return (
    <div className="relative mx-auto max-w-3xl rounded-[2rem] bg-white p-5 shadow-2xl ring-1 ring-slate-200 sm:p-8" role="dialog" aria-label="Crédits épuisés" data-testid="out-of-credits">
      <span className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400" aria-hidden>
        <X className="size-5" />
      </span>
      <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal to-violet text-white">
        <Rocket className="size-6" aria-hidden />
      </span>
      <h2 className="mt-4 font-heading text-2xl font-extrabold text-navy">
        {plan === "FREE" ? "Vous avez déjà repéré vos premières opportunités !" : "Vous avez utilisé vos 20 candidatures du mois"}
      </h2>
      <p className="mt-2 text-slate-600">
        {plan === "FREE"
          ? "Vos 5 crédits gratuits de ce mois sont utilisés. Passez à Pro pour préparer 20 candidatures par mois."
          : "Passez à Business pour des candidatures illimitées, pour vous et toute votre équipe."}
      </p>
      <div className={cn("mt-6 grid gap-4", plan === "FREE" ? "sm:grid-cols-2" : "")}>
        {plan === "FREE" && <PlanCard code="PRO" compact trialEligible={trialEligible} founder={founder} />}
        <PlanCard code="BUSINESS" compact trialEligible={trialEligible} />
      </div>
      <p className="mt-5 flex items-center justify-center gap-1.5 text-sm text-slate-600">
        <CalendarClock className="size-4 text-teal-700" aria-hidden /> Ou attendez le {frDate(renewsAt)} : vos crédits seront rechargés gratuitement.
      </p>
      <p className="mt-1 text-center text-xs text-slate-500">Vos candidatures déjà commencées restent ouvertes, et vous pouvez continuer à chercher.</p>
    </div>
  );
}

/** Anciens inscrits, le jour du lancement : bandeau du tableau de bord (et fenêtre une seule fois). */
export function LegacyLaunchBanner({ until }: { until: string }) {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-navy-900 p-5 text-white shadow-xl sm:p-7" data-testid="legacy-launch">
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 -z-10 size-64 animate-aurora rounded-full bg-teal/30 blur-3xl" />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal to-electric text-navy">
          <Gift className="size-6" aria-hidden />
        </span>
        <div className="flex-1">
          <p className="font-heading text-xl font-bold sm:text-2xl">LinkProB2B évolue : 3 jours de Pro vous sont offerts</p>
          <p className="mt-2 text-sm text-slate-300">
            Votre compte, votre entreprise, vos alertes et vos candidatures sont conservés. LinkProB2B fonctionne maintenant avec des crédits : 1 crédit =
            1 candidature commencée ; chercher et lire les offres reste gratuit.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <p className="rounded-xl bg-white/10 px-3 py-2 text-sm ring-1 ring-white/15">
              <span className="block text-xs text-slate-300">Jusqu&apos;au {frDate(until)}</span>
              <span className="font-bold">20 crédits de Pro offerts</span>
            </p>
            <p className="rounded-xl bg-white/10 px-3 py-2 text-sm ring-1 ring-white/15">
              <span className="block text-xs text-slate-300">Ensuite</span>
              <span className="font-bold">Gratuit, Pro ou Business</span>
            </p>
            <p className="rounded-xl bg-violet/30 px-3 py-2 text-sm ring-1 ring-violet-300/40">
              <span className="block text-xs text-violet-100">Membre de la première heure</span>
              <span className="font-bold">
                Pro à {euros(FOUNDER_PRO_HT)} HT les {FOUNDER_MONTHS} premiers mois
              </span>
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="btn-shine inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-teal to-electric px-5 text-sm font-bold text-navy">
              <Crown className="size-4" aria-hidden /> Voir les formules
            </span>
            <span className="inline-flex h-11 items-center rounded-xl px-4 text-sm font-semibold text-slate-200 ring-1 ring-white/20">Continuer</span>
          </div>
          <p className="mt-3 text-xs text-slate-400">Sans choix de votre part après le {frDate(until)}, vous passez en Gratuit (5 crédits par mois). Aucun paiement automatique.</p>
        </div>
      </div>
    </section>
  );
}

export type LedgerLine = { at: string; label: string; amount: number; balance: number };

/** « Mon abonnement » : formule, crédits, recharge et historique de chaque crédit. */
export function SubscriptionCredits({ plan, balance, perPeriod, renewsAt, lines }: { plan: OfferCode; balance: number | null; perPeriod: number | null; renewsAt: string; lines: LedgerLine[] }) {
  const p = OFFER_PLANS.find((x) => x.code === plan)!;
  return (
    <section id="credits" className="scroll-mt-24 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200" data-testid="subscription-credits">
      <div className="grid gap-4 border-b border-slate-100 p-5 sm:grid-cols-3 sm:p-6">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase">Formule</p>
          <p className="mt-1 font-heading text-2xl font-bold text-navy">{p.name}</p>
          <p className="text-sm text-slate-500">{p.priceHT ? `${euros(p.priceHT)} HT / mois · ${euros(ttc(p.priceHT))} TTC` : "0 €"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase">Crédits restants</p>
          <p className="mt-1 font-heading text-2xl font-bold text-navy">{perPeriod === null ? "Illimités" : `${balance} sur ${perPeriod}`}</p>
          <p className="text-sm text-slate-500">1 crédit = 1 candidature commencée</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase">Prochaine recharge</p>
          <p className="mt-1 font-heading text-2xl font-bold text-navy">{frDate(renewsAt)}</p>
          <p className="text-sm text-slate-500">Sans report des crédits non utilisés</p>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <p className="flex items-center gap-2 font-semibold text-navy">
          <History className="size-4 text-teal-700" aria-hidden /> Historique des crédits
        </p>
        <ul className="mt-3 divide-y divide-slate-100">
          {lines.map((l, i) => (
            <li key={i} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="w-20 shrink-0 text-slate-500">{frDate(l.at)}</span>
              <span className="min-w-0 flex-1 text-slate-700 line-clamp-2">{l.label}</span>
              <span className={cn("shrink-0 font-bold", l.amount < 0 ? "text-rose-700" : "text-teal-700")}>{l.amount > 0 ? `+${l.amount}` : l.amount}</span>
              <span className="w-16 shrink-0 text-right text-slate-500">reste {l.balance}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="inline-flex h-11 items-center rounded-xl bg-navy px-5 text-sm font-semibold text-white">Changer de formule</span>
          <span className="inline-flex h-11 items-center rounded-xl px-4 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">Factures</span>
        </div>
      </div>
    </section>
  );
}

/** Essai par carte : tout ce qui doit être affiché avant de valider (prix HT/TTC, dates, montant, annulation). */
export function TrialSummary({ plan, start }: { plan: "PRO" | "BUSINESS"; start: string }) {
  const p = OFFER_PLANS.find((x) => x.code === plan)!;
  const end = new Date(new Date(start).getTime() + TRIAL_DAYS * 86_400_000);
  const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7" data-testid="trial-summary">
      <p className="font-heading text-xl font-bold text-navy">Essai {p.name} : {TRIAL_DAYS} jours, 0 € aujourd&apos;hui</p>
      <dl className="mt-4 space-y-2.5 text-sm">
        {[
          ["Pendant l'essai", p.credits === null ? "Candidatures illimitées" : `${p.credits} candidatures`],
          ["Fin de l'essai", fmt(end)],
          ["1er paiement", `${fmt(end)} : ${euros(ttc(p.priceHT))} TTC (${euros(p.priceHT)} HT)`],
          ["Ensuite", `${euros(ttc(p.priceHT))} TTC chaque mois, sans engagement`],
          ["Annuler", "En un clic dans « Mon abonnement » avant la fin : rien n'est prélevé"],
          ["Rappel", "Un e-mail 24 h avant la fin de l'essai"],
        ].map(([a, b]) => (
          <div key={a} className="flex gap-3">
            <dt className="w-32 shrink-0 font-semibold text-slate-500">{a}</dt>
            <dd className="text-navy">{b}</dd>
          </div>
        ))}
      </dl>
      <span className="btn-shine mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal to-electric font-bold text-navy">
        Ajouter ma carte et commencer l&apos;essai
      </span>
    </section>
  );
}
