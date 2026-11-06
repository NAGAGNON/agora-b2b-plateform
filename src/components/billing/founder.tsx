import { Bell, Check, ChevronDown, Minus, ShieldCheck, Sparkles, Star, Zap } from "lucide-react";
import { formatEuros, priceTTC } from "@/lib/billing/plans";
import { FOUNDER_PRICE_HT, REFUND_DAYS, REGULAR_PRICE_HT } from "@/lib/billing/founder";
import { formatDate } from "@/lib/format";

/** Trois avantages qui font gagner des clients (pas des fonctions). */
const GAINS = [
  { icon: Zap, title: "48 h d'avance", text: "Les besoins des entreprises arrivent chez vous avant les autres." },
  { icon: Star, title: "Proposé en premier", text: "Votre entreprise en tête quand un client cherche un prestataire." },
  { icon: Bell, title: "Rien ne vous échappe", text: "Alertes et recherches illimitées, tous vos métiers, partout en France." },
];

/** Gratuit ou Pro, en une ligne chacun. */
const COMPARE: [string, string | boolean, string | boolean][] = [
  ["Besoins des entreprises", "48 h après", "En avant-première"],
  ["Alertes par e-mail", "1 alerte, 3 offres", "Illimitées"],
  ["Recherches", "15 par semaine", "Illimitées"],
  ["Historique des acheteurs", "5 annonces", "Complet"],
  ["Proposé en premier aux clients", false, true],
];

const FAQ: [string, string][] = [
  ["« À vie », c'est-à-dire ?", `Tant que votre abonnement reste actif, vous payez ${formatEuros(FOUNDER_PRICE_HT)} HT par mois, même si le prix de Pro augmente.`],
  ["Et si Pro ne me convient pas ?", `Remboursé intégralement sur simple demande dans les ${REFUND_DAYS} jours, sans justification. Et résiliable en un clic.`],
  ["Que se passe-t-il si je ne m'abonne pas ?", "Vous restez sur l'offre Gratuite, sans rien payer, avec ses limites (tableau ci-dessus)."],
];

const Cell = ({ v }: { v: string | boolean }) =>
  v === true ? <Check className="mx-auto size-5 text-teal-700" aria-label="Inclus" /> : v === false ? <Minus className="mx-auto size-5 text-slate-300" aria-label="Non inclus" /> : <span>{v}</span>;

/** Page de l'offre de lancement : prix, bouton, trois avantages, comparatif, trois questions. */
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
    <div className="bg-white">
      {/* En-tête : le prix et le bouton, rien d'autre */}
      <section className="bg-gradient-to-b from-navy to-[#173d63] text-white">
        <div className="container-page py-14 text-center sm:py-20">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-amber-300 ring-1 ring-white/20">
            <Sparkles className="size-4" aria-hidden /> {founder ? `Merci${firstName ? ` ${firstName}` : ""} d'être parmi les premiers` : "Offre de lancement"}
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl leading-tight font-extrabold sm:text-6xl">
            Pro à {formatEuros(FOUNDER_PRICE_HT)}
            <span className="text-teal-300"> à vie.</span>
          </h1>
          <p className="mt-4 text-lg text-white/80">
            Moitié prix, au lieu de {formatEuros(REGULAR_PRICE_HT)} HT/mois. Soit {formatEuros(priceTTC(FOUNDER_PRICE_HT))} TTC.
          </p>
          {urgency && <p className="mt-2 text-sm font-semibold text-amber-300">{urgency}</p>}
          <div className="mx-auto mt-8 max-w-sm rounded-2xl bg-white p-5 text-left text-navy shadow-xl">{action}</div>
          {note && <p className="mx-auto mt-4 max-w-sm text-sm text-white/80">{note}</p>}
          <ul className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/80">
            {["Sans engagement", `Satisfait ou remboursé ${REFUND_DAYS} jours`, "Carte, Apple Pay, Google Pay ou prélèvement"].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-teal-300" aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Trois avantages */}
      <section aria-label="Ce que Pro vous apporte" className="container-page py-14">
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
          {GAINS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-slate-200 p-6">
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <Icon className="size-6" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-bold text-navy">{title}</h2>
              <p className="mt-1 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparatif */}
      <section aria-labelledby="compare" className="container-page pb-14">
        <h2 id="compare" className="text-center text-2xl font-bold text-navy">
          Gratuit ou Pro
        </h2>
        <div className="mx-auto mt-6 max-w-3xl overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-sm sm:text-base">
            <thead>
              <tr className="bg-slate-50 text-navy">
                <th className="p-3 text-left font-semibold"></th>
                <th className="p-3 text-center font-semibold">Gratuit</th>
                <th className="bg-teal-50 p-3 text-center font-bold text-teal-800">Pro</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map(([label, free, pro]) => (
                <tr key={label} className="border-t border-slate-100">
                  <td className="p-3 text-slate-700">{label}</td>
                  <td className="p-3 text-center text-slate-500">
                    <Cell v={free} />
                  </td>
                  <td className="bg-teal-50/50 p-3 text-center font-semibold text-navy">
                    <Cell v={pro} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Trois questions, repliées */}
      <section aria-labelledby="faq" className="container-page pb-16">
        <h2 id="faq" className="text-center text-2xl font-bold text-navy">
          Questions fréquentes
        </h2>
        <div className="mx-auto mt-6 max-w-3xl divide-y divide-slate-200 rounded-2xl border border-slate-200">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group p-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between gap-3 font-semibold text-navy">
                {q}
                <ChevronDown className="size-5 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden />
              </summary>
              <p className="mt-2 text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
