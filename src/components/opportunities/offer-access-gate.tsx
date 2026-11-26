import Link from "next/link";
import { ArrowRight, BellRing, CalendarClock, CalendarDays, CheckCircle2, ClipboardList, ExternalLink, FileText, Gauge, Landmark, LayoutList, Lock, MapPin, MessageSquare, Tag, Wallet } from "lucide-react";
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
const flat = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
/** Le résumé ne fait que répéter l'intitulé (« X cherche une entreprise pour : <titre> ») : inutile de l'afficher. */
export const summaryRepeatsTitle = (summary: string, title: string) => flat(summary).includes(flat(title).slice(0, 60));

const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

export function OfferAccessGate({
  token,
  offer,
  crumbs,
  gains,
  children,
  contact,
  closed = false,
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
    /** Ce que veut l'acheteur, en une phrase (fiche synthèse déjà préparée) */
    summary?: string | null;
    /** Numéro officiel de l'avis (BOAMP, TED) */
    reference?: string | null;
    /** Codes CPV de l'avis */
    cpv?: string[];
  };
  /** Fil d'Ariane (région, département, métier) : liens vers les pages de la zone et du métier */
  crumbs?: { name: string; path: string }[];
  /** Ce que l'inscription apporte, chiffres réels : offres ouvertes du même métier près de l'offre et en France */
  gains?: { nearby: number; nearbyLabel: string | null; sectorTotal: number; sector: string | null; alertLabel: string | null; nearbyPath?: string | null; sectorPath?: string | null } | null;
  /** Contenu public sous la carte (offres similaires) */
  children?: React.ReactNode;
  /**
   * Besoin publié par une entreprise inscrite (ouvert) : le visiteur peut lui écrire tout de suite,
   * sans compte (formulaire fourni ici) ; l'inscription reste proposée ensuite.
   */
  contact?: React.ReactNode;
  /** Offre clôturée (date limite dépassée ou consultation fermée) : elle ne doit jamais paraître ouverte */
  closed?: boolean;
}) {
  const path = `/opportunites/${offer.id}`;
  const suite = encodeURIComponent(path);
  const go = (a: "inscription" | "connexion") => (token ? `/api/outreach/acces/${token}?o=${offer.id}&a=${a}` : `/${a}?suite=${suite}`);
  return (
    <div className="bg-sky/40">
      <div className="container-page pt-10 pb-28 sm:py-16">
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
        {closed && (
          <div role="status" data-testid="gate-closed" className="mx-auto mb-4 max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            <p className="font-bold">Offre clôturée : la date limite de réponse est dépassée.</p>
            <p className="mt-1">
              Il n&apos;est plus possible d&apos;y répondre. Elle reste consultable pour information.{" "}
              {offer.buyerPath && offer.buyer && (
                <>
                  <Link href={offer.buyerPath} className="font-semibold underline">
                    Les appels d&apos;offres en cours de {offer.buyer}
                  </Link>
                  {gains?.sectorPath ? " · " : ""}
                </>
              )}
              {gains?.sectorPath && (
                <Link href={gains.sectorPath} className="font-semibold underline">
                  Les offres ouvertes{gains.sector ? ` en ${gains.sector}` : ""}
                </Link>
              )}
            </p>
          </div>
        )}
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm [overflow-wrap:anywhere] sm:p-10">
          {contact && (
            <>
              <span className="inline-flex size-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                <MessageSquare className="size-6" aria-hidden />
              </span>
              <p className="mt-4 text-2xl leading-tight font-bold sm:text-3xl">Une entreprise recherche un prestataire</p>
              <p className="mt-3 text-slate-700">
                Vous pouvez répondre à ce besoin ? Écrivez directement à l&apos;entreprise qui l&apos;a publié, sans créer de compte : elle reçoit votre message par e-mail et vous répond.
              </p>
            </>
          )}

          {/* L'offre d'abord : le visiteur venu de Google voit ce qu'il cherchait (titre, acheteur, lieu, date limite, besoin) */}
          <section aria-label="L'offre" className={contact ? "mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5" : ""} data-testid="gate-offer">
            {offer.sector && (
              <Badge tone="teal" icon={<Tag className="size-3" aria-hidden />}>
                {offer.sector}
              </Badge>
            )}
            <h1 className={contact ? "mt-2 text-lg leading-snug font-bold text-navy" : "mt-3 font-heading text-2xl leading-tight font-extrabold text-balance text-navy sm:text-3xl"}>{offer.title}</h1>
            {offer.buyer && (
              <p className="mt-2 flex items-center gap-2 text-slate-600">
                <Landmark className="size-4 shrink-0 text-teal-700" aria-hidden />
                {offer.buyerPath ? (
                  <Link href={offer.buyerPath} className="font-semibold text-navy underline-offset-2 hover:underline">
                    {offer.buyer}
                  </Link>
                ) : (
                  <strong className="text-navy">{offer.buyer}</strong>
                )}
              </p>
            )}
            <ul className="mt-4 flex flex-wrap gap-2 text-sm">
              {offer.deadline && (
                <li
                  className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-1.5 font-semibold ring-1 ${
                    !closed && daysLeft(offer.deadline) <= 5 ? "bg-rose-50 text-rose-800 ring-rose-200" : "bg-white text-navy ring-slate-200"
                  }`}
                >
                  <CalendarClock className="size-4 shrink-0" aria-hidden /> {closed ? "Clôturée le" : "Date limite :"} {formatDate(offer.deadline)}
                  {!closed && daysLeft(offer.deadline) >= 0 && <span className="font-normal opacity-80">· encore {daysLeft(offer.deadline)} jour{daysLeft(offer.deadline) > 1 ? "s" : ""}</span>}
                </li>
              )}
              {offer.location && (
                <li className="inline-flex items-center gap-1.5 rounded-2xl bg-white px-3 py-1.5 text-slate-700 ring-1 ring-slate-200">
                  <MapPin className="size-4 shrink-0 text-teal-700" aria-hidden /> {offer.location}
                </li>
              )}
              {offer.budget && (
                <li className="inline-flex items-center gap-1.5 rounded-2xl bg-white px-3 py-1.5 text-slate-700 ring-1 ring-slate-200">
                  <Wallet className="size-4 shrink-0 text-teal-700" aria-hidden /> {offer.budget}
                </li>
              )}
              {offer.publishedAt && (
                <li className="inline-flex items-center gap-1.5 rounded-2xl bg-white px-3 py-1.5 text-slate-500 ring-1 ring-slate-200">
                  <CalendarDays className="size-4 shrink-0" aria-hidden /> Publiée le {formatDate(offer.publishedAt)}
                </li>
              )}
            </ul>
            {offer.summary && !summaryRepeatsTitle(offer.summary, offer.title) && (
              <div className="mt-5 rounded-2xl bg-gradient-to-br from-sky to-white p-4 ring-1 ring-slate-200" data-testid="gate-summary">
                <p className="text-xs font-bold tracking-wide text-teal-700 uppercase">En bref : ce que cherche l&apos;acheteur</p>
                <p className="mt-1.5 leading-relaxed text-navy">{offer.summary}</p>
              </div>
            )}
            {offer.excerpt && (
              <div className="relative mt-4 border-t border-slate-200 pt-4">
                <p className="text-sm leading-relaxed text-slate-700">{offer.excerpt}</p>
                <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
              </div>
            )}
            {(offer.reference || (offer.cpv?.length ?? 0) > 0) && (
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                {offer.reference && (
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="size-3.5 text-teal-700" aria-hidden /> Avis officiel {offer.reference}
                  </span>
                )}
                {offer.cpv && offer.cpv.length > 0 && <span>Codes CPV : {offer.cpv.join(", ")}</span>}
              </p>
            )}
          </section>

          {!contact && (
            <section aria-labelledby="gate-unlock" className="mt-7 rounded-2xl bg-navy p-5 text-white sm:p-6" data-testid="gate-unlock">
              <p id="gate-unlock" className="flex items-center gap-2 text-lg font-bold sm:text-xl">
                <Lock className="size-5 text-teal-300" aria-hidden />
                {closed ? "Recevez les prochaines offres de ce type" : "Créez votre compte pour accéder à cette offre"}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                {closed
                  ? "Cette offre est terminée. Inscription gratuite en moins d'une minute : vous recevez les nouvelles offres de votre métier dès leur publication."
                  : token
                    ? "Cette offre vous a été recommandée personnellement. Créez votre compte gratuitement pour voir les détails et accéder à l'offre."
                    : "Gratuit, sans carte bancaire, en moins d'une minute. Vous revenez directement sur cette offre."}
              </p>
              {!closed && (
                <ul className="mt-4 space-y-2.5 text-sm">
                  {[
                    { icon: <ExternalLink className="size-4" aria-hidden />, t: "L'annonce officielle et le dossier de consultation", d: "le lien vers le site de l'acheteur pour répondre" },
                    { icon: <ClipboardList className="size-4" aria-hidden />, t: "La fiche complète, en français simple", d: "pièces à fournir, critères de notation, où et quand déposer" },
                    { icon: <Gauge className="size-4" aria-hidden />, t: "Votre note de correspondance avec cette offre", d: "votre métier, votre zone et les conditions demandées, point par point" },
                  ].map((x) => (
                    <li key={x.t} className="flex gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal/20 text-teal-200">{x.icon}</span>
                      <span>
                        <span className="block font-semibold">{x.t}</span>
                        <span className="block text-slate-300">{x.d}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <a href={go("inscription")} className={buttonClasses({ size: "lg", className: "mt-5 hidden w-full whitespace-normal text-center sm:inline-flex" })} data-testid="gate-unlock-signup">
                {closed ? "Recevoir les prochaines offres, inscription gratuite" : "Voir l'offre complète, inscription gratuite"} <ArrowRight className="size-4" aria-hidden />
              </a>
            </section>
          )}

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
              {contact ? "Ce que vous débloquez gratuitement" : "Et aussi, avec votre compte gratuit"}
            </h2>
            <ul className="mt-3 space-y-2.5 text-sm text-slate-700">
              {contact && (
                <li className="flex gap-2.5">
                  <FileText className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden />
                  <span>
                    <strong>Le lien officiel, le dossier de consultation et la fiche de l&apos;acheteur</strong> pour répondre, avec le descriptif complet et les conditions de participation
                  </span>
                </li>
              )}
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
                          {gains.nearbyPath ? (
                            <Link href={gains.nearbyPath} className="text-teal-800 underline underline-offset-2 hover:text-navy" data-testid="gate-nearby-link">
                              {gains.nearby.toLocaleString("fr-FR")} offres « {gains.sector} » ouvertes {gains.nearbyLabel}
                            </Link>
                          ) : (
                            <>
                              {gains.nearby.toLocaleString("fr-FR")} offres « {gains.sector} » ouvertes {gains.nearbyLabel}
                            </>
                          )}
                        </strong>
                        {gains.sectorTotal > gains.nearby && (
                          <>
                            ,{" "}
                            {gains.sectorPath ? (
                              <Link href={gains.sectorPath} className="underline underline-offset-2 hover:text-navy">
                                {gains.sectorTotal.toLocaleString("fr-FR")} dans toute la France
                              </Link>
                            ) : (
                              `${gains.sectorTotal.toLocaleString("fr-FR")} dans toute la France`
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <strong>
                        {gains.sectorPath ? (
                          <Link href={gains.sectorPath} className="text-teal-800 underline underline-offset-2 hover:text-navy">
                            {gains.sectorTotal.toLocaleString("fr-FR")} offres « {gains.sector} » ouvertes en France
                          </Link>
                        ) : (
                          <>
                            {gains.sectorTotal.toLocaleString("fr-FR")} offres « {gains.sector} » ouvertes en France
                          </>
                        )}
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
      {!contact && (
        // Téléphone : le bouton d'inscription reste en bas de l'écran pendant la lecture de l'offre
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
          <a href={go("inscription")} data-testid="gate-top-signup" className={buttonClasses({ size: "lg", className: "w-full whitespace-normal text-center" })}>
            {closed ? "Recevoir les prochaines offres, inscription gratuite" : "Voir l'offre complète, inscription gratuite"}
          </a>
        </div>
      )}
    </div>
  );
}
