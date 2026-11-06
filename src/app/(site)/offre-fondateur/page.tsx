import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { PRIVATE_METADATA } from "@/lib/seo";
import { founderOffer, founderOpen, isFounder } from "@/lib/billing/founder";
import { FounderBanner, FounderOfferView } from "@/components/billing/founder";
import { FounderCheckoutForm } from "@/components/dashboard/billing-forms";
import { Notice } from "@/components/ui/notice";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { ...PRIVATE_METADATA, title: "Offre membre fondateur" };

/**
 * Offre « membre fondateur ». Invisible tant qu'elle n'est pas lancée (page introuvable), sauf en
 * aperçu (?apercu=1) pour l'équipe ou hors production : rien n'est alors payable.
 */
/** Date de fin fictive de l'aperçu : dans trois semaines. */
function previewEnd() {
  const d = new Date();
  d.setDate(d.getDate() + 21);
  return d.toISOString();
}

export default async function FounderOfferPage(props: PageProps<"/offre-fondateur">) {
  const sp = await props.searchParams;
  const [session, offer] = await Promise.all([getSession(), founderOffer()]);
  const preview = sp.apercu === "1" && (!env.isProduction || Boolean(session?.isStaff));
  if (preview) {
    const endsAt = previewEnd();
    return (
      <>
        <div className="container-page pt-6">
          <Notice tone="info" title="Aperçu">
            Aperçu de l&apos;offre fondateur telle que la verront les inscrits une fois lancée. Rien n&apos;est payable ici. Ci-dessous, le bandeau affiché dans leur espace.
          </Notice>
          <div className="mt-4">
            <FounderBanner endsAt={endsAt} />
          </div>
        </div>
        <FounderOfferView firstName="Camille" endsAt={endsAt} action={<FounderCheckoutForm label="Devenir membre fondateur" disabled />} />
      </>
    );
  }
  if (!founderOpen(offer)) notFound();
  if (!session) {
    return (
      <FounderOfferView
        firstName={null}
        endsAt={offer.endsAt}
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
  const eligible = isFounder(offer, session.profile.created_at);
  const { data: plan } = company ? await createAdminClient().from("companies").select("plan_code").eq("id", company.company.id).maybeSingle() : { data: null };
  const paid = Boolean(plan && plan.plan_code !== "FREE");
  let action: React.ReactNode;
  if (!eligible) action = <Notice tone="info">Cette offre est réservée aux personnes inscrites avant son lancement. Les offres actuelles sont sur la page Tarifs.</Notice>;
  else if (!company)
    action = (
      <Link href="/onboarding/entreprise?suite=%2Foffre-fondateur" className={buttonClasses({ full: true, size: "lg" })}>
        Créer mon profil (30 secondes) pour en profiter
      </Link>
    );
  else if (paid) action = <Notice tone="success">Votre entreprise est déjà abonnée. Merci pour votre confiance !</Notice>;
  else if (company.role !== "COMPANY_ADMIN") action = <Notice tone="info">Seul l&apos;administrateur de votre entreprise peut souscrire.</Notice>;
  else action = <FounderCheckoutForm label="Devenir membre fondateur" />;
  return (
    <FounderOfferView
      firstName={firstName}
      endsAt={offer.endsAt}
      action={action}
      note={sp.paiement === "annule" ? "Paiement annulé : rien n'a été prélevé. Vous pouvez réessayer quand vous voulez." : undefined}
    />
  );
}
