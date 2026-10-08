import Link from "next/link";
import { CalendarClock, CheckCircle2, Lock, MapPin, Tag, Wallet } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

/**
 * Page d'accès d'une offre pour un visiteur venu d'un e-mail de prospection et non connecté :
 * il retrouve les informations déjà présentes dans l'e-mail, mais le détail complet et la
 * source ne sont servis qu'après inscription ou connexion (contrôle côté serveur).
 */
export function OfferAccessGate({
  token,
  offer,
}: {
  token: string;
  offer: { id: string; title: string; buyer: string | null; location: string | null; sector: string | null; deadline: string | null; budget: string | null };
}) {
  const go = (a: "inscription" | "connexion") => `/api/outreach/acces/${token}?o=${offer.id}&a=${a}`;
  return (
    <div className="bg-sky/40">
      <div className="container-page py-10 sm:py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm [overflow-wrap:anywhere] sm:p-10">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
            <Lock className="size-6" aria-hidden />
          </span>
          <h1 className="mt-4 text-2xl leading-tight font-bold sm:text-3xl">Créez votre compte pour accéder à cette offre</h1>
          <p className="mt-3 text-slate-700">
            Cette offre vous a été recommandée personnellement. Créez votre compte gratuitement pour voir les détails et accéder à l&apos;offre.
          </p>

          <section aria-label="Offre recommandée" className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
            {offer.sector && (
              <Badge tone="teal" icon={<Tag className="size-3" aria-hidden />}>
                {offer.sector}
              </Badge>
            )}
            <p className="mt-2 text-lg leading-snug font-bold text-navy">{offer.title}</p>
            {offer.buyer && <p className="mt-1 text-sm text-slate-600">{offer.buyer}</p>}
            <ul className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              {offer.location && (
                <li className="flex items-center gap-2">
                  <MapPin className="size-4 shrink-0 text-teal-700" aria-hidden /> {offer.location}
                </li>
              )}
              {offer.deadline && (
                <li className="flex items-center gap-2">
                  <CalendarClock className="size-4 shrink-0 text-teal-700" aria-hidden /> Date limite : {formatDate(offer.deadline)}
                </li>
              )}
              {offer.budget && (
                <li className="flex items-center gap-2">
                  <Wallet className="size-4 shrink-0 text-teal-700" aria-hidden /> {offer.budget}
                </li>
              )}
            </ul>
          </section>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a href={go("inscription")} className={buttonClasses({ size: "lg", className: "sm:flex-1" })}>
              Créer mon compte
            </a>
            <a href={go("connexion")} className={buttonClasses({ size: "lg", variant: "outline", className: "sm:flex-1" })}>
              Se connecter
            </a>
          </div>
          <ul className="mt-6 space-y-2 text-sm text-slate-600">
            {["Gratuit, en moins d'une minute", "Vous arrivez directement sur cette offre après l'inscription", "Détail complet, documents et lien vers l'avis officiel"].map((t) => (
              <li key={t} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden /> {t}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-slate-500">
            <Link href={`/opportunites/selection/${token}`} className="underline">
              Revenir à ma sélection
            </Link>{" "}
            ·{" "}
            <Link href={`/desinscription/${token}`} className="underline">
              Ne plus recevoir ces sélections
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
