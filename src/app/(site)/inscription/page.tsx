import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/forms";
import { getSession } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Créer un compte",
  description: "Créez gratuitement votre compte LinkProB2B pendant le pilote.",
  path: "/inscription",
});

export default async function SignUpPage() {
  if (await getSession()) redirect("/dashboard");
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
      <SignUpForm />
    </AuthShell>
  );
}
