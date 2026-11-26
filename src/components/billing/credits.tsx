import Link from "next/link";
import { ArrowRight, CalendarClock, Check, Coins, Crown, Gift, History, Infinity as InfinityIcon, Lock, PartyPopper, Rocket, Search, Sparkles, X } from "lucide-react";
import { FOUNDER_DEADLINE_DAYS, FOUNDER_MONTHS, founderDeadline, FOUNDER_PRO_HT, FREE_CREDITS, OFFER_PLANS, PRO_CREDITS, TRIAL_DAYS, YEAR_FREE_MONTHS, euros, yearlyHT, frDate, ttc, type OfferCode } from "@/lib/billing/offer";
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
export function PlanCard({ code, founder, trialEligible, compact = false }: { code: OfferCode; founder?: boolean; trialEligible: boolean; compact?: boolean }) {
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
        <>
          <p className={cn("mt-1 text-xs", dark ? "text-slate-400" : "text-slate-500")}>soit {euros(ttc(price))} TTC</p>
          <p className={cn("mt-2 w-fit rounded-lg px-2 py-1 text-xs font-semibold ring-1", dark ? "bg-white/10 text-teal-100 ring-white/15" : "bg-teal-50 text-teal-800 ring-teal/30")}>
            Ou {euros(yearlyHT(p.priceHT))} HT / an : {YEAR_FREE_MONTHS} mois offerts
          </p>
        </>
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
      <h1 className="mt-5 font-heading text-3xl font-extrabold text-navy sm:text-4xl">Félicitations, vous avez {FREE_CREDITS} crédits !</h1>
      <p className="mx-auto mt-3 max-w-xl text-slate-600">De quoi préparer {FREE_CREDITS} candidatures ce mois-ci, avec le parcours en 7 étapes.</p>
      <div className="mx-auto mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
        {[
          { icon: Coins, t: "1 crédit = 1 candidature", d: "Quand vous cliquez « Oui, je prépare ma candidature »." },
          { icon: Search, t: "Le reste est gratuit", d: "Chercher, lire les offres, la veille du matin." },
          { icon: CalendarClock, t: `Rechargés le ${frDate(renewsAt)}`, d: `Chaque mois, ${FREE_CREDITS} nouveaux crédits (sans report).` },
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
      <p className="mt-4 text-sm text-slate-500">Besoin de plus ? Pro : {PRO_CREDITS} candidatures par mois pour 29 € HT, depuis « Mon abonnement ».</p>
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
        {plan === "FREE" ? "Vous avez déjà repéré vos premières opportunités !" : `Vous avez utilisé vos ${PRO_CREDITS} candidatures du mois`}
      </h2>
      <p className="mt-2 text-slate-600">
        {plan === "FREE"
          ? `Vos ${FREE_CREDITS} crédits gratuits de ce mois sont utilisés. Passez à Pro pour préparer ${PRO_CREDITS} candidatures par mois.`
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
export function LegacyLaunchBanner({ until, launchedAt }: { until: string; launchedAt?: string }) {
  const founderEnd = founderDeadline(launchedAt ?? until);
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
              <span className="font-bold">{PRO_CREDITS} crédits de Pro offerts</span>
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
              <span className="block text-xs text-violet-100">Offre valable jusqu&apos;au {frDate(founderEnd)}</span>
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="btn-shine inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-teal to-electric px-5 text-sm font-bold text-navy">
              <Crown className="size-4" aria-hidden /> Voir les formules
            </span>
            <span className="inline-flex h-11 items-center rounded-xl px-4 text-sm font-semibold text-slate-200 ring-1 ring-white/20">Continuer</span>
          </div>
          <p className="mt-3 text-xs text-slate-400">Sans choix de votre part après le {frDate(until)}, vous passez en Gratuit ({FREE_CREDITS} crédits par mois). Aucun paiement automatique.</p>
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

/** Repère violet « Pro » avec la petite couronne. */
export function ProHint({ children = "Pro" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700 ring-1 ring-violet-200">
      <Crown className="size-3" aria-hidden /> {children}
    </span>
  );
}

/**
 * Avantage Pro vu depuis l'offre Gratuit : quelques lignes floutées, un titre court, le repère Pro et un
 * bouton vers la page « Pourquoi Pro » (c'est là, et seulement là, que tout est expliqué).
 */
export function ProLock({ title, href = "/dashboard/abonnement/pro", children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl ring-1 ring-slate-200" data-testid="pro-lock">
      <div aria-hidden className="pointer-events-none max-h-32 overflow-hidden blur-[5px] select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/50 p-3">
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-white/95 px-4 py-3 shadow-lg ring-1 ring-slate-200">
          <Lock className="size-4 text-violet-600" aria-hidden />
          <span className="text-sm font-bold text-navy">{title}</span>
          <ProHint />
          <Link href={href} className="inline-flex h-8 items-center gap-1 rounded-lg bg-navy px-3 text-xs font-bold text-white transition hover:-translate-y-px">
            Voir <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}

const Row = ({ a, b }: { a: string; b: string }) => (
  <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-0">
    <span className="text-slate-700">{a}</span>
    <span className="shrink-0 font-semibold text-navy">{b}</span>
  </div>
);

/** Exemples d'avantages Pro floutés en Gratuit, même avec des crédits (aperçu pour l'équipe). */
export function FreeTeasers() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ProLock title="7 pièces à fournir · 3 critères">
        <div className="bg-white">
          <Row a="Attestation d'assurance décennale" b="Obligatoire" />
          <Row a="Valeur technique (mémoire)" b="60 %" />
          <Row a="Dépôt sur PLACE" b="12/12 à 12 h" />
        </div>
      </ProLock>
      <ProLock title="Qui a gagné ce marché">
        <div className="bg-white">
          <Row a="Titulaire du marché" b="Atlantique Espaces Verts" />
          <Row a="Montant" b="148 500 € HT" />
          <Row a="Offres reçues" b="6" />
        </div>
      </ProLock>
      <ProLock title="3 besoins en avant-première">
        <div className="bg-white">
          <Row a="Entretien de 4 sites logistiques" b="Nantes" />
          <Row a="Remplacement d'une toiture" b="Vannes" />
          <Row a="Maintenance compresseurs" b="Brest" />
        </div>
      </ProLock>
      <ProLock title="12 autres marchés de cet acheteur">
        <div className="bg-white">
          <Row a="Nettoyage des bâtiments communaux" b="96 000 €" />
          <Row a="Entretien des espaces verts" b="120 000 €" />
          <Row a="Maintenance des ascenseurs" b="54 000 €" />
        </div>
      </ProLock>
    </div>
  );
}

/** Fiche de candidature en Gratuit : tout s'utilise, les limites sont signalées par le repère Pro, sans explication. */
export function CandidatureFreeLimits() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-navy">Notes de cette étape</p>
          <span className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            2 notes
          </span>
        </div>
        <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">Attestation demandée à l&apos;assureur</p>
        <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">Visite du site jeudi 10 h</p>
      </div>
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <p className="text-sm font-bold text-navy">Équipe sur ce dossier</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-teal-50 py-1 pr-3 pl-1 text-sm font-semibold text-teal-900 ring-1 ring-teal/30">
            <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-teal to-violet text-xs font-bold text-white">M</span> Morgan (vous)
          </span>
          <Link href="/dashboard/abonnement/pro" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-slate-500 ring-1 ring-slate-300 hover:ring-violet-300">
            <Lock className="size-3.5" aria-hidden /> Ajouter un collègue
          </Link>
          <ProHint />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-bold text-navy">Journal de suivi</p>
        <div className="rounded-2xl bg-white ring-1 ring-slate-200">
          <Row a="Aujourd'hui · Question posée sur les quantités" b="Vous" />
          <Row a="Lundi · Candidature commencée" b="Vous" />
          <Row a="12 nov. · Échange avec l'acheteur" b="Vous" />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-bold text-navy">Mémoire technique</p>
        <div className="rounded-2xl bg-white p-3 text-sm text-slate-500 ring-1 ring-slate-200">Votre mémoire, enregistré automatiquement…</div>
        <ProLock title="Trame déjà rédigée">
          <div className="space-y-1 bg-white p-4 text-sm text-slate-700">
            <p className="font-bold">1. Présentation de l&apos;entreprise</p>
            <p>Durand Maintenance intervient depuis 2012…</p>
            <p className="font-bold">2. Compréhension du besoin</p>
          </div>
        </ProLock>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-white p-4 text-sm text-slate-700 ring-1 ring-slate-200 lg:col-span-2">
        <span className="flex items-center gap-2">Modèles de courriers <ProHint /></span>
        <span className="flex items-center gap-2">Télécharger en PDF / Word <ProHint /></span>
        <span className="flex items-center gap-2">Assistant · 2 questions restantes <ProHint>Illimité avec Pro</ProHint></span>
      </div>
    </div>
  );
}

/** « Pourquoi Pro » : la seule page qui explique tout ce que Pro apporte, avec les boutons pour souscrire. */
export function ProUpgradePage({ founder, founderUntil }: { founder: boolean; founderUntil?: string }) {
  const pro = OFFER_PLANS.find((p) => p.code === "PRO")!;
  const gains: [string, string][] = [
    [`${PRO_CREDITS} candidatures par mois`, `au lieu de ${FREE_CREDITS} en Gratuit`],
    ["La fiche complète de chaque appel d'offres", "conditions, pièces à fournir, critères de notation, où et quand déposer"],
    ["La trame du mémoire déjà rédigée", "adaptée aux critères de l'acheteur, à compléter, en Word"],
    ["1 collègue sur vos dossiers", "pour préparer la candidature à deux"],
    ["Qui a gagné, dès la publication", "Pro surveille le résultat et vous prévient"],
    ["Les besoins des entreprises en avant-première", "48 h avant les autres, proposé en premier"],
    ["Les nouvelles offres chaque matin", "3 alertes, l'assistant sans limite, les modèles de courriers"],
  ];
  return (
    <section className="overflow-hidden rounded-[2rem] bg-white shadow-xl ring-1 ring-slate-200" data-testid="pro-upgrade">
      <div className="relative isolate bg-gradient-to-br from-navy to-navy-900 p-6 text-white sm:p-10">
        <div aria-hidden className="pointer-events-none absolute -top-20 -right-16 -z-10 size-72 animate-aurora rounded-full bg-teal/30 blur-3xl" />
        <ProHint>Pro</ProHint>
        <h1 className="mt-3 font-heading text-3xl font-extrabold text-white sm:text-4xl">Préparez vos candidatures comme un pro</h1>
        <p className="mt-2 max-w-xl text-slate-300">Tout ce qui est flouté sur vos fiches, débloqué.</p>
        <p className="mt-4 inline-flex max-w-xl items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-teal-100 ring-1 ring-white/15">
          Un seul marché remporté peut rapporter bien plus qu&apos;une année d&apos;abonnement.
        </p>
      </div>
      <div className="grid gap-6 p-6 sm:p-10 lg:grid-cols-[1fr_20rem]">
        <ul className="space-y-3">
          {gains.map(([a, b]) => (
            <li key={a} className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal/30">
                <Check className="size-4" aria-hidden />
              </span>
              <span>
                <span className="block font-semibold text-navy">{a}</span>
                <span className="block text-sm text-slate-600">{b}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="h-fit rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200">
          <p className="font-heading text-xl font-bold text-navy">Pro</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="font-heading text-4xl font-extrabold text-navy">{euros(founder ? FOUNDER_PRO_HT : pro.priceHT)}</span>
            <span className="text-sm text-slate-500">HT / mois</span>
          </p>
          <p className="text-xs text-slate-500">{founder ? `les ${FOUNDER_MONTHS} premiers mois, puis ${euros(pro.priceHT)} HT` : `soit ${euros(ttc(pro.priceHT))} TTC`}</p>
          {!founder && (
            <p className="mt-2 rounded-lg bg-teal-50 px-2 py-1 text-center text-xs font-semibold text-teal-800 ring-1 ring-teal/30">
              Ou {euros(yearlyHT(pro.priceHT))} HT / an : {YEAR_FREE_MONTHS} mois offerts
            </p>
          )}
          {founder && (
            <p className="mt-2 rounded-lg bg-violet-50 px-2 py-1 text-center text-xs font-semibold text-violet-800 ring-1 ring-violet-200">
              {founderUntil ? `Tarif fondateur jusqu'au ${frDate(founderUntil)}` : `Tarif fondateur pendant ${FOUNDER_DEADLINE_DAYS} jours après le lancement`}
            </p>
          )}
          <span className="btn-shine mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal to-electric font-bold text-navy shadow-lg">
            Essayer Pro {TRIAL_DAYS} jours <ArrowRight className="size-4" aria-hidden />
          </span>
          <p className="mt-2 text-center text-xs text-slate-500">0 € aujourd&apos;hui · résiliable en un clic</p>
          <span className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-navy ring-1 ring-slate-300">
            Voir Business · candidatures illimitées
          </span>
        </div>
      </div>
    </section>
  );
}

/** Page Tarifs de l'offre par crédits (affichée au lancement ; l'équipe peut la voir avant avec ?offre=credits). */
export function CreditsPricing() {
  const Y = <Check className="mx-auto size-5 text-teal-700" aria-label="Inclus" />;
  const N = <span className="text-slate-300">—</span>;
  const rows: [string, React.ReactNode, React.ReactNode, React.ReactNode][] = [
    ["Candidatures par mois", `${FREE_CREDITS}`, `${PRO_CREDITS}`, "Illimitées"],
    ["Recherche et lecture des offres", "Illimitées", "Illimitées", "Illimitées"],
    ["Alertes (les nouvelles offres chaque matin)", "1", "3", "Illimitées"],
    ["Fiche complète de l'appel d'offres", "Résumé", Y, Y],
    ["Trame du mémoire, modèles de courriers, PDF/Word", N, Y, Y],
    ["Notes et journal de suivi", "Illimités", "Illimités", "Illimités"],
    ["Assistant de candidature", "3 questions / mois", "Illimité", "Illimité"],
    ["Qui a gagné, besoins en avant-première", N, Y, Y],
    ["Collègues sur les dossiers", N, "1", "Toute l'équipe"],
    ["Présenté à des entreprises ciblées", N, "100 / mois", "400 / mois + suivi"],
  ];
  return (
    <div className="bg-slate-50/60" data-testid="credits-pricing">
      <section className="relative isolate overflow-hidden bg-navy-900 pt-16 pb-40 text-white sm:pt-20">
        <div aria-hidden className="bg-tech-grid absolute inset-0 -z-10 opacity-40" />
        <div aria-hidden className="absolute -top-40 left-1/4 -z-10 size-[34rem] animate-aurora rounded-full bg-teal/25 blur-3xl" />
        <div className="container-page text-center">
          <h1 className="font-heading text-4xl font-extrabold text-white sm:text-5xl">Des tarifs simples</h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">
            1 crédit = 1 candidature commencée. Chercher et lire les offres reste toujours gratuit. Essai {TRIAL_DAYS} jours sur Pro et Business. À l&apos;année : {YEAR_FREE_MONTHS} mois offerts.
          </p>
          <p className="mx-auto mt-5 inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-teal-100 ring-1 ring-white/15">
            Un seul marché remporté peut rapporter bien plus qu&apos;une année d&apos;abonnement.
          </p>
        </div>
      </section>
      <div className="container-page -mt-28 pb-16">
        <div className="grid gap-5 lg:grid-cols-3">
          <PlanCard code="FREE" trialEligible />
          <PlanCard code="PRO" trialEligible />
          <PlanCard code="BUSINESS" trialEligible />
        </div>
        <div className="mt-12 overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-navy text-white">
                <th className="p-4 text-left">Ce que vous avez</th>
                <th className="p-4">Gratuit</th>
                <th className="p-4">Pro · 29 € HT / mois<span className="block text-xs font-normal text-teal-100">ou 290 € HT / an</span></th>
                <th className="p-4">Business · 59 € HT / mois<span className="block text-xs font-normal text-teal-100">ou 590 € HT / an</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([a, ...v]) => (
                <tr key={a} className="border-t border-slate-100">
                  <td className="p-4 text-slate-700">{a}</td>
                  {v.map((x, i) => (
                    <td key={i} className="p-4 text-center font-semibold text-navy">
                      {x}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">Prix hors taxes, TVA 20 % en sus. Sans engagement, résiliable en un clic. Les crédits se rechargent chaque mois, sans report.</p>
      </div>
    </div>
  );
}
