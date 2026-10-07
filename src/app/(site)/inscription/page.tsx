import Link from "next/link";
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

export default async function SignUpPage(props: PageProps<"/inscription">) {
  if (await getSession()) redirect("/dashboard");
  const ref = (await props.searchParams).ref;
  // Provenance (sélection LinkProB2B Outreach) : jeton signé, vérifié côté serveur à l'inscription.
  const referral = typeof ref === "string" && /^o\.[A-Za-z0-9_.-]{20,60}$/.test(ref) ? ref : undefined;
  return (
    <AuthShell
      title="Créer un compte"
      subtitle={
        <>
          Déjà inscrit ?{" "}
          <Link href="/connexion" className="font-semibold text-teal-700 hover:underline">
            Se connecter
          </Link>
          <span className="mt-2 block text-sm">Étape suivante : la création du profil de votre entreprise.</span>
        </>
      }
    >
      <SignUpForm referral={referral} />
    </AuthShell>
  );
}
