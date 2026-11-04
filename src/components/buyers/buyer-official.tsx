import Link from "next/link";
import { ArrowRight, Landmark } from "lucide-react";

/** Recherche de l'acheteur dans l'Annuaire des entreprises de l'État (SIREN, adresse, dirigeants, site internet). */
export function buyerRegistryUrl(name: string) {
  return `https://annuaire-entreprises.data.gouv.fr/rechercher?terme=${encodeURIComponent(name)}`;
}

/**
 * Fiche officielle d'un acheteur public : lien vers l'annuaire de l'État (source publique, rien
 * n'est déduit) pour les membres ; invitation à s'inscrire pour les visiteurs sans compte.
 */
export function BuyerOfficial({ name, signedIn, signupHref, buyerPath, compact = false }: { name: string; signedIn: boolean; signupHref: string; buyerPath?: string | null; compact?: boolean }) {
  return (
    <div className={compact ? "" : "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"} data-testid="buyer-official">
      <p className="flex items-center gap-2 text-sm font-semibold text-navy">
        <Landmark className="size-4 text-teal-700" aria-hidden /> Fiche officielle de l&apos;acheteur
      </p>
      {signedIn ? (
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <a href={buyerRegistryUrl(name)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline">
              Annuaire des entreprises (État) <ArrowRight className="size-3.5" aria-hidden />
            </a>
            <p className="text-xs text-slate-500">SIREN, adresse, dirigeants, site internet</p>
          </li>
          {buyerPath && (
            <li>
              <Link href={buyerPath} className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline">
                Tous ses appels d&apos;offres sur LinkProB2B <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </li>
          )}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          <Link href={signupHref} className="font-semibold text-teal-700 underline">
            Créez votre compte
          </Link>{" "}
          pour accéder à sa fiche officielle (SIREN, adresse, site internet).
        </p>
      )}
    </div>
  );
}
