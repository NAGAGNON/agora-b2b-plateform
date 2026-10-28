import Link from "next/link";
import { Sparkles } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

/**
 * Bandeau d'une offre ouverte depuis un e-mail de prospection, sans compte : l'annonce complète
 * reste visible ; le compte sert à recevoir les annonces similaires et à suivre ses réponses.
 */
export function OutreachWelcome({ token, offerId }: { token: string; offerId: string }) {
  const go = (a: "inscription" | "connexion") => `/api/outreach/acces/${token}?o=${offerId}&a=${a}`;
  return (
    <section aria-label="Annonce recommandée" data-testid="outreach-welcome" className="mb-6 rounded-2xl bg-navy p-5 text-white sm:p-6">
      <p className="flex items-center gap-2 text-sm font-semibold text-teal">
        <Sparkles className="size-4" aria-hidden /> Annonce sélectionnée pour votre entreprise
      </p>
      <p className="mt-2 max-w-2xl text-slate-200">
        Consultez le détail et la source officielle ci-dessous. Créez votre compte gratuit pour recevoir chaque jour les annonces similaires et suivre vos réponses.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <a href={go("inscription")} className={buttonClasses({ size: "lg" })}>
          Créer mon compte gratuit
        </a>
        <a href={go("connexion")} className={buttonClasses({ size: "lg", variant: "light" })}>
          Se connecter
        </a>
      </div>
      <p className="mt-4 text-xs text-slate-300">
        <Link href={`/opportunites/selection/${token}`} className="underline">
          Revenir à ma sélection
        </Link>{" "}
        ·{" "}
        <Link href={`/desinscription/${token}`} className="underline">
          Ne plus recevoir ces sélections
        </Link>
      </p>
    </section>
  );
}
