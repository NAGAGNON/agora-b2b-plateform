import { CheckCircle2 } from "lucide-react";
import { getPlatformStats } from "@/lib/queries/platform";

const nf = new Intl.NumberFormat("fr-FR");

/** Ce que l'inscription apporte, avec les chiffres réels du jour (visible aussi sur mobile). */
export async function SignupValue() {
  const stats = await getPlatformStats();
  const items = [
    stats?.active ? `${nf.format(stats.active)} opportunités ouvertes en ce moment, partout en France` : "Les appels d'offres et besoins d'entreprises ouverts, partout en France",
    stats?.new_24h ? `${nf.format(stats.new_24h)} nouvelles ces dernières 24 h` : null,
    "Le détail complet, les documents et le lien vers l'avis officiel",
    "Des alertes par e-mail selon votre métier et votre zone",
    "Gratuit, sans carte bancaire, en moins d'une minute",
  ].filter((x): x is string => Boolean(x));
  return (
    <ul className="mb-6 space-y-2 rounded-xl border border-teal-100 bg-teal-50/60 p-4 text-sm text-slate-700" data-testid="signup-value">
      {items.map((t) => (
        <li key={t} className="flex gap-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden /> {t}
        </li>
      ))}
    </ul>
  );
}
