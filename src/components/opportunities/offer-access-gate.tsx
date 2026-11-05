import Link from "next/link";
import { BellRing, CalendarClock, CalendarDays, CheckCircle2, FileText, Landmark, LayoutList, Lock, MapPin, MessageSquare, Tag, Wallet } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { GoogleButton } from "@/components/auth/google-button";

/**
 * Page d'accès d'une offre pour un visiteur non connecté : il voit l'essentiel (titre, lieu, date
 * limite), mais le détail complet, les documents et la source ne sont servis qu'après inscription
 * ou connexion (contrôle côté serveur). Venu d'un e-mail de prospection (`token`), son parcours est
 * suivi ; sinon il revient sur la fiche après l'inscription.
 */
export function OfferAccessGate({
  token,
  offer,
  crumbs,
  gains,
  children,
  contact,
}: {
  token?: string | null;
  offer: {
    id: string;
    title: string;
    buyer: string | null;
    buyerPath?: string | null;
    location: string | null;
    sector: string | null;
    deadline: string | null;
    publishedAt?: string | null;
    budget: string | null;
    excerpt?: string | null;
  };
  /** Fil d'Ariane (région, département, métier) : liens vers les pages de la zone et du métier */
  crumbs?: { name: string; path: string }[];
  /** Ce que l'inscription apporte, chiffres réels : offres ouvertes du même métier près de l'offre et en France */
  gains?: { nearby: number; nearbyLabel: string | null; sectorTotal: number; sector: string | null; alertLabel: string | null } | null;
  /** Contenu public sous la carte (offres similaires) */
  children?: React.ReactNode;
  /**
   * Besoin publié par une entreprise inscrite (ouvert) : le visiteur peut lui écrire tout de suite,
   * sans compte (formulaire fourni ici) ; l'inscription reste proposée ensuite.
   */
  contact?: React.ReactNode;
}) {
  const path = `/opportunites/${offer.id}`;
  const suite = encodeURIComponent(path);
  const go = (a: "inscription" | "connexion") => (token ? `/api/outreach/acces/${token}?o=${offer.id}&a=${a}` : `/${a}?suite=${suite}`);
  return (
    <div className="bg-sky/40">
      <div className="container-page py-10 sm:py-16">
        {crumbs?.length ? (
          <nav aria-label="Fil d'Ariane" className="mx-auto mb-4 max-w-2xl text-sm text-slate-500">
            {crumbs.map((c, i) => (
              <span key={c.path}>
                {i > 0 && " / "}
                <Link href={c.path} className="hover:underline">
                  {c.name}
                </Link>
              </span>
            ))}
          </nav>
        ) : null}
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm [overflow-wrap:anywhere] sm:p-10">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
            {contact ? <MessageSquare className="size-6" aria-hidden /> : <Lock className="size-6" aria-hidden />}
          </span>
          <p className="mt-4 text-2xl leading-tight font-bold sm:text-3xl">
            {contact ? "Une entreprise recherche un prestataire" : "Créez votre compte pour accéder à cette offre"}
          </p>
          <p className="mt-3 text-slate-700">
            {contact
              ? "Vous pouvez répondre à ce besoin ? Écrivez directement à l'entreprise qui l'a publié, sans créer de compte : elle reçoit votre message par e-mail et vous répond."
              : token
              ? "Cette offre vous a été recommandée personnellement. Créez votre compte gratuitement pour voir les détails et accéder à l'offre."
              : "Inscription gratuite en moins d'une minute : vous accédez à l'offre complète et recevez les nouvelles offres de votre métier."}
          </p>

          <section aria-label="Offre recommandée" className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
            {offer.sector && (
              <Badge tone="teal" icon={<Tag className="size-3" aria-hidden />}>
                {offer.sector}
              </Badge>
            )}
            <h1 className="mt-2 text-lg leading-snug font-bold text-navy">{offer.title}</h1>
            {offer.buyer && (
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                <Landmark className="size-4 shrink-0 text-teal-700" aria-hidden />
                {offer.buyerPath ? (
                  <Link href={offer.buyerPath} className="underline-offset-2 hover:underline">
                    {offer.buyer}
                  </Link>
                ) : (
                  offer.buyer
                )}
              </p>
            )}
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
              {offer.publishedAt && (
                <li className="flex items-center gap-2">
                  <CalendarDays className="size-4 shrink-0 text-teal-700" aria-hidden /> Publiée le {formatDate(offer.publishedAt)}
                </li>
              )}
              {offer.budget && (
                <li className="flex items-center gap-2">
                  <Wallet className="size-4 shrink-0 text-teal-700" aria-hidden /> {offer.budget}
                </li>
              )}
            </ul>
            {offer.excerpt && (
              <div className="relative mt-4 border-t border-slate-200 pt-4">
                <p className="text-sm leading-relaxed text-slate-700">{offer.excerpt}</p>
                <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-50 to-transparent" />
              </div>
            )}
            {!contact && (
              <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
                <Lock className="size-3.5 text-teal-700" aria-hidden /> Descriptif complet, documents, lien officiel et fiche de l&apos;acheteur réservés aux membres
              </p>
            )}
          </section>

          {contact && (
            <section aria-labelledby="need-contact" className="mt-6" data-testid="need-contact">
              <h2 id="need-contact" className="mb-3 text-lg font-bold text-navy">
                Répondre à ce besoin
              </h2>
              {contact}
              <p className="mt-8 border-t border-slate-200 pt-6 text-sm font-semibold text-navy">
                Vous voulez aussi recevoir les besoins et appels d&apos;offres de votre métier ? Créez votre compte gratuit :
              </p>
            </section>
          )}

          <section aria-labelledby="gains" className="mt-6">
            <h2 id="gains" className="text-base font-bold text-navy">
              Ce que vous débloquez gratuitement
            </h2>
            <ul className="mt-3 space-y-2.5 text-sm text-slate-700">
              <li className="flex gap-2.5">
                <FileText className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden />
                <span>
                  <strong>Le lien officiel, le dossier de consultation et la fiche de l&apos;acheteur</strong> pour répondre, avec le descriptif complet et les conditions de participation
                </span>
              </li>
              {gains?.alertLabel && (
                <li className="flex gap-2.5">
                  <BellRing className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden />
                  <span>
                    <strong>Une alerte e-mail « {gains.alertLabel} »</strong> créée pour vous : les nouvelles offres dès leur publication (modifiable ou arrêtable en un clic)
                  </span>
                </li>
              )}
              {gains && gains.sector && (gains.nearby > 1 || gains.sectorTotal > 1) && (
                <li className="flex gap-2.5">
                  <LayoutList className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden />
                  <span>
                    {gains.nearby > 1 && gains.nearbyLabel ? (
                      <>
                        <strong>
                          {gains.nearby.toLocaleString("fr-FR")} offres « {gains.sector} » ouvertes {gains.nearbyLabel}
                        </strong>
                        {gains.sectorTotal > gains.nearby ? `, ${gains.sectorTotal.toLocaleString("fr-FR")} dans toute la France` : ""}
                      </>
                    ) : (
                      <strong>
                        {gains.sectorTotal.toLocaleString("fr-FR")} offres « {gains.sector} » ouvertes en France
                      </strong>
                    )}
                    , réunies au même endroit
                  </span>
                </li>
              )}
            </ul>
          </section>

          <a href={go("inscription")} className={buttonClasses({ size: "lg", className: "mt-6 w-full" })}>
            Créer mon compte gratuitement
          </a>
          <GoogleButton next={path} referral={token} />
          <p className="mt-6 text-center text-sm text-slate-600">
            Déjà inscrit ?{" "}
            <a href={go("connexion")} className="font-semibold text-teal-700 hover:underline">
              Se connecter
            </a>
          </p>
          <ul className="mt-6 space-y-2 border-t border-slate-200 pt-6 text-sm text-slate-600">
            {["Gratuit, sans carte bancaire, en moins d'une minute", "Vous arrivez directement sur cette offre après l'inscription", "Les nouvelles offres de votre métier par e-mail, si vous le souhaitez"].map((t) => (
              <li key={t} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden /> {t}
              </li>
            ))}
          </ul>
          {token && (
            <p className="mt-6 text-xs text-slate-500">
              <Link href={`/opportunites/selection/${token}`} className="underline">
                Revenir à ma sélection
              </Link>{" "}
              ·{" "}
              <Link href={`/desinscription/${token}`} className="underline">
                Ne plus recevoir ces sélections
              </Link>
            </p>
          )}
        </div>
        {children ? <div className="mx-auto max-w-5xl">{children}</div> : null}
      </div>
    </div>
  );
}
