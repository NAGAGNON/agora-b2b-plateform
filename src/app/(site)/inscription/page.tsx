import Link from "next/link";
import { safeInternalPath } from "@/lib/safe-path";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/forms";
import { getSession } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";

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
      <SignUpForm referral={referral} next={next} />
    </AuthShell>
  );
}
