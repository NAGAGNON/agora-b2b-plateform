import Link from "next/link";
import { safeInternalPath } from "@/lib/safe-path";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/forms";
import { GoogleButton } from "@/components/auth/google-button";
import { SignupValue } from "@/components/auth/signup-value";
import { Notice } from "@/components/ui/notice";
import { getSession } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";
import { recipientFromReferral, referralStillTrusted } from "@/lib/outreach/tracking";

export const metadata = pageMetadata({
  title: "Créer un compte",
  description: "Créez gratuitement votre compte LinkProB2B pour suivre les opportunités B2B et appels d'offres de votre secteur, partout en France.",
  path: "/inscription",
});

const internalPath = (v: unknown) => safeInternalPath(v, "") || undefined;

export default async function SignUpPage(props: PageProps<"/inscription">) {
  const sp = await props.searchParams;
  // Page à ouvrir après l'inscription (ex. l'offre recommandée dans un e-mail de prospection)
  const next = internalPath(sp.suite);
  if (await getSession()) redirect(next ?? "/dashboard");
  const ref = sp.ref;
  // Provenance (sélection LinkProB2B Outreach) : jeton signé, vérifié côté serveur à l'inscription.
  const referral = typeof ref === "string" && /^o\.[A-Za-z0-9_.-]{20,60}$/.test(ref) ? ref : undefined;
  const forOffer = Boolean(referral && next?.startsWith("/opportunites/"));
  // Lien reçu par e-mail : l'adresse destinataire est pré-remplie (activation immédiate du compte)
  const recipient = referral ? await recipientFromReferral(referral) : null;
  // Sinon : adresse transmise par un lien LinkProB2B (alerte par e-mail confirmée), simple pré-remplissage
  const fromLink = typeof sp.email === "string" && /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i.test(sp.email) ? sp.email : undefined;
  const defaultEmail = recipient?.email && referralStillTrusted(recipient) ? recipient.email : fromLink;
  return (
    <AuthShell
      title={forOffer ? "Créez votre compte pour accéder à cette offre" : "Créer un compte"}
      subtitle={
        <>
          Déjà inscrit ?{" "}
          <Link
            href={`/connexion${next ? `?${new URLSearchParams({ suite: next, ...(referral ? { ref: referral } : {}) })}` : ""}`}
            className="font-semibold text-teal-700 hover:underline"
          >
            Se connecter
          </Link>
          <span className="mt-2 block text-sm">
            {forOffer
              ? "Gratuit. Utilisez l'adresse qui a reçu notre e-mail : votre compte est activé immédiatement et l'offre s'ouvre directement."
              : "Étape suivante : la création du profil de votre entreprise."}
          </span>
        </>
      }
    >
      {sp.erreur === "google" && (
        <Notice tone="warning" title="Connexion Google indisponible" className="mb-6">
          Réessayez, ou créez votre compte avec votre adresse e-mail.
        </Notice>
      )}
      <SignupValue />
      <GoogleButton next={next} />
      <SignUpForm referral={referral} next={next} defaultEmail={defaultEmail} />
    </AuthShell>
  );
}
