import { Bell, Check, ChevronDown, FileSearch, History, Minus, Sparkles, Star, Zap } from "lucide-react";
import { formatEuros, priceTTC } from "@/lib/billing/plans";
import { FOUNDER_PRICE_HT, REFUND_DAYS, REGULAR_PRICE_HT } from "@/lib/billing/founder";
import { formatDate } from "@/lib/format";

/** Ce que l'abonné gagne (des clients, du temps), pas une liste de fonctions. */
const WINS = [
  { icon: FileSearch, title: "Chaque appel d'offres résumé en 30 secondes", text: "Dates, pièces à fournir, critères et pièges à éviter, sans lire 80 pages." },
  { icon: Zap, title: "48 h d'avance sur les autres", text: "Les besoins des entreprises arrivent chez vous en premier." },
  { icon: Star, title: "Vous passez devant", text: "Votre entreprise est proposée en tête aux clients qui publient un besoin." },
  { icon: Bell, title: "Plus aucune offre ratée", text: "Alertes et recherches illimitées, tous vos métiers, toute la France." },
  { icon: History, title: "Un coup d'avance sur les acheteurs", text: "Leur historique complet : anticipez leurs prochains contrats." },
];

const COMPARE: [string, string | boolean, string | boolean][] = [
  ["Fiche synthèse de chaque appel d'offres", false, true],
  ["Besoins des entreprises", "48 h après", "En avant-première"],
  ["Proposé en premier aux clients", false, true],
  ["Alertes par e-mail", "1 alerte, 3 offres", "Illimitées"],
  ["Recherches", "15 par semaine", "Illimitées"],
  ["Historique des acheteurs", "5 annonces", "Complet"],
];

const FAQ: [string, string][] = [
  ["« À vie », c'est-à-dire ?", `Tant que votre abonnement reste actif, vous payez ${formatEuros(FOUNDER_PRICE_HT)} HT par mois, même si le prix de Pro augmente.`],
  ["Et si Pro ne me convient pas ?", `Vous êtes remboursé sur simple demande dans les ${REFUND_DAYS} jours. Et vous pouvez arrêter en un clic, à tout moment.`],
  ["Que se passe-t-il si je ne m'abonne pas ?", "Vous restez sur l'offre Gratuite, avec ses limites (tableau ci-dessus)."],
];

const Cell = ({ v }: { v: string | boolean }) =>
  v === true ? <Check className="mx-auto size-5 text-teal-400" aria-label="Inclus" /> : v === false ? <Minus className="mx-auto size-5 text-white/25" aria-label="Non inclus" /> : <span>{v}</span>;

/** Page de l'offre de lancement : sombre, animée, centrée sur ce que l'abonné gagne. */
export function FounderOfferView({
  firstName,
  founder = true,
  endsAt,
  seatsLeft,
  action,
  note,
}: {
  firstName: string | null;
  /** Inscrit avant le lancement : petit mot de remerciement */
  founder?: boolean;
  endsAt: string | null;
  seatsLeft: number | null;
  action: React.ReactNode;
  note?: React.ReactNode;
}) {
  const urgency = [seatsLeft != null ? `${seatsLeft} place${seatsLeft > 1 ? "s" : ""} restante${seatsLeft > 1 ? "s" : ""}` : null, endsAt ? `jusqu'au ${formatDate(endsAt)}` : null].filter(Boolean).join(" · ");
  return (
    <div className="relative overflow-hidden bg-navy-900 text-white">
      {/* Fond animé : quadrillage et halos lumineux */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="bg-tech-grid absolute inset-0 animate-grid" />
        <div className="absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 animate-aurora rounded-full bg-teal/25 blur-3xl" />
        <div className="absolute top-80 -left-40 size-96 animate-aurora rounded-full bg-violet/25 blur-3xl [animation-delay:-6s]" />
        <div className="absolute top-[40rem] -right-32 size-96 animate-aurora rounded-full bg-electric/20 blur-3xl [animation-delay:-12s]" />
      </div>

      <div className="relative container-page py-14 sm:py-20">
        {/* Accroche */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex animate-rise items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-teal-300 ring-1 ring-white/15 backdrop-blur">
            <Sparkles className="size-4" aria-hidden /> {founder ? `Merci${firstName ? ` ${firstName}` : ""}, vous faites partie des premiers` : "Offre de lancement"}
          </span>
          <h1 className="mt-6 animate-rise text-4xl leading-[1.05] font-extrabold [animation-delay:80ms] sm:text-6xl">
            Décrochez plus de clients,
            <br />
            <span className="text-gradient">avant les autres.</span>
          </h1>
        </div>

        {/* Carte de prix : bordure lumineuse animée, ce que l'abonné gagne, le bouton */}
        <div className="mx-auto mt-12 max-w-xl animate-pop [animation-delay:160ms]">
          <div className="animate-shimmer rounded-[1.75rem] bg-[linear-gradient(90deg,var(--color-teal),var(--color-glow),var(--color-violet),var(--color-teal))] bg-[length:200%_auto] p-[2px] shadow-[0_30px_80px_-20px_rgb(20_194_173/0.45)]">
            <div className="rounded-[1.65rem] bg-navy/95 p-6 backdrop-blur sm:p-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold tracking-wide text-teal-300 uppercase">Pro · tarif fondateur</p>
                  <p className="mt-1 flex items-baseline gap-2">
                    <span className="text-gradient text-5xl font-extrabold">{formatEuros(FOUNDER_PRICE_HT)}</span>
                    <span className="text-white/70">HT / mois</span>
                  </p>
                  <p className="text-sm text-white/60">
                    <span className="line-through">{formatEuros(REGULAR_PRICE_HT)}</span> · à vie · {formatEuros(priceTTC(FOUNDER_PRICE_HT))} TTC
                  </p>
                </div>
                {urgency && <span className="rounded-full bg-violet/20 px-3 py-1 text-xs font-semibold text-violet-200 ring-1 ring-violet/40">{urgency}</span>}
              </div>

              <p className="mt-6 text-sm font-semibold text-white/90">Ce que vous gagnez</p>
              <ul className="mt-3 space-y-3">
                {WINS.map(({ icon: Icon, title, text }) => (
                  <li key={title} className="flex gap-3">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal/30 to-violet/30 text-teal-300 ring-1 ring-white/10">
                      <Icon className="size-[18px]" aria-hidden />
                    </span>
                    <span>
                      <span className="block font-semibold">{title}</span>
                      <span className="block text-sm text-white/65">{text}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 rounded-2xl bg-white p-4 text-navy">{action}</div>
              {note && <p className="mt-3 text-sm text-white/70">{note}</p>}
              <p className="mt-3 text-center text-xs text-white/50">Sans engagement · arrêt en un clic · carte, Apple Pay, Google Pay ou prélèvement</p>
            </div>
          </div>
        </div>

        {/* Comparatif */}
        <section aria-labelledby="compare" className="reveal mx-auto mt-20 max-w-3xl">
          <h2 id="compare" className="text-center text-2xl font-bold sm:text-3xl">
            Gratuit ou <span className="text-gradient">Pro</span>
          </h2>
          <div className="mt-6 overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur">
            <table className="w-full text-sm sm:text-base">
              <thead>
                <tr className="text-white/70">
                  <th className="p-4 text-left font-medium"></th>
                  <th className="p-4 text-center font-medium">Gratuit</th>
                  <th className="bg-teal/10 p-4 text-center font-bold text-teal-300">Pro</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([label, free, pro]) => (
                  <tr key={label} className="border-t border-white/10">
                    <td className="p-4 text-white/85">{label}</td>
                    <td className="p-4 text-center text-white/50">
                      <Cell v={free} />
                    </td>
                    <td className="bg-teal/10 p-4 text-center font-semibold">
                      <Cell v={pro} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Questions, repliées */}
        <section aria-labelledby="faq" className="reveal mx-auto mt-16 max-w-3xl">
          <h2 id="faq" className="text-center text-2xl font-bold sm:text-3xl">
            Questions fréquentes
          </h2>
          <div className="mt-6 divide-y divide-white/10 rounded-2xl bg-white/5 ring-1 ring-white/10">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-3 font-semibold">
                  {q}
                  <ChevronDown className="size-5 shrink-0 text-teal-300 transition group-open:rotate-180" aria-hidden />
                </summary>
                <p className="mt-2 text-white/70">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
