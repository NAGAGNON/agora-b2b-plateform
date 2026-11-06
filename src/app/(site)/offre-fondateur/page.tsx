import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { PRIVATE_METADATA } from "@/lib/seo";
import { companyOfferState, founderOffer, founderOpen, founderSeatsTaken, isFounder, seatsLeft } from "@/lib/billing/founder";
import { FounderOfferView } from "@/components/billing/founder";
import { LaunchCard } from "@/components/billing/launch-card";
import { FounderCheckoutForm } from "@/components/dashboard/billing-forms";
import { Notice } from "@/components/ui/notice";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { ...PRIVATE_METADATA, title: "Offre de lancement" };

const DAY = 86_400_000;
/** Repère temporel de l'aperçu (dates fictives). */
const nowMs = () => Date.now();

/**
 * Offre de lancement (tarif fondateur). Introuvable tant qu'elle n'est pas lancée, sauf en aperçu
 * (?apercu=1) pour l'équipe ou hors production : rien n'y est payable.
 */
export default async function FounderOfferPage(props: PageProps<"/offre-fondateur">) {
  const sp = await props.searchParams;
  const [session, offer] = await Promise.all([getSession(), founderOffer()]);
  const preview = sp.apercu === "1" && (!env.isProduction || Boolean(session?.isStaff));
  if (preview) {
    const now = nowMs();
    const endsAt = new Date(now + 37 * DAY).toISOString();
    const pulse = { sectors: ["travaux-btp"], france: 312, department: 18, departmentCode: "30" };
    const free = { plan: "FREE" as const, paid: false, trialEndsAt: null, trialActive: false, trialUsed: false };
    return (
      <>
        <div className="container-page space-y-4 pt-6">
          <Notice tone="info" title="Aperçu (exemples fictifs)">
            L&apos;offre telle que la verront les membres une fois lancée. Rien n&apos;est payable ici. Ci-dessous, l&apos;encart affiché dans l&apos;espace membre selon la
            situation : essai en cours, essai à démarrer, essai terminé, compte sans entreprise.
          </Notice>
          <LaunchCard state={{ ...free, plan: "PRO", trialActive: true, trialUsed: true, trialEndsAt: new Date(now + 12 * DAY).toISOString() }} pulse={pulse} seatsLeft={23} endsAt={endsAt} now={now} />
          <LaunchCard state={free} pulse={pulse} seatsLeft={23} endsAt={endsAt} now={now} />
          <LaunchCard state={{ ...free, trialUsed: true }} pulse={pulse} seatsLeft={9} endsAt={endsAt} now={now} />
          <LaunchCard state={null} pulse={null} seatsLeft={23} endsAt={endsAt} now={now} />
        </div>
        <FounderOfferView firstName="Camille" endsAt={endsAt} seatsLeft={23} action={<FounderCheckoutForm label="Devenir membre fondateur" disabled />} />
      </>
    );
  }
  if (!founderOpen(offer)) notFound();
  const left = seatsLeft(offer, await founderSeatsTaken());
  if (!session) {
    return (
      <FounderOfferView
        firstName={null}
        founder={false}
        endsAt={offer.endsAt}
        seatsLeft={left}
        action={
          <Link href="/connexion?suite=%2Foffre-fondateur" className={buttonClasses({ full: true, size: "lg" })}>
            Me connecter pour en profiter
          </Link>
        }
      />
    );
  }
  const firstName = session.profile.full_name?.trim().split(/\s+/)[0] ?? null;
  const company = session.activeCompany;
  const state = company ? await companyOfferState(company.company.id) : null;
  let action: React.ReactNode;
  if (left <= 0) action = <Notice tone="info">Toutes les places au tarif fondateur ont été prises. Les offres actuelles sont sur la page Tarifs.</Notice>;
  else if (!company)
    action = (
      <Link href="/onboarding/entreprise?suite=%2Foffre-fondateur" className={buttonClasses({ full: true, size: "lg" })}>
        Créer mon profil (30 secondes) pour en profiter
      </Link>
    );
  else if (state?.paid) action = <Notice tone="success">Votre entreprise est déjà abonnée. Merci pour votre confiance !</Notice>;
  else if (company.role !== "COMPANY_ADMIN") action = <Notice tone="info">Seul l&apos;administrateur de votre entreprise peut souscrire.</Notice>;
  else action = <FounderCheckoutForm label={state?.trialActive ? "Garder Pro au tarif fondateur" : "Devenir membre fondateur"} />;
  return (
    <FounderOfferView
      firstName={firstName}
      founder={isFounder(offer, session.profile.created_at)}
      endsAt={offer.endsAt}
      seatsLeft={left}
      action={action}
      note={sp.paiement === "annule" ? "Paiement annulé : rien n'a été prélevé. Vous pouvez réessayer quand vous voulez." : undefined}
    />
  );
}
