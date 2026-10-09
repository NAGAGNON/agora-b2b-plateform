import Link from "next/link";
import { safeInternalPath } from "@/lib/safe-path";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/forms";
import { getSession } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";
import { Notice } from "@/components/ui/notice";

export const metadata = pageMetadata({ title: "Connexion", description: "Connectez-vous à votre espace LinkProB2B : opportunités, alertes, recommandations, messagerie et pipeline commercial.", path: "/connexion", noindex: true });

export default async function LoginPage(props: PageProps<"/connexion">) {
  const sp = await props.searchParams;
  const next = typeof sp.suite === "string" ? sp.suite : undefined;
  // Provenance (page d'accès d'une offre, e-mail de prospection) : jeton signé vérifié côté serveur
  const referral = typeof sp.ref === "string" && /^o\.[A-Za-z0-9_.-]{20,60}$/.test(sp.ref) ? sp.ref : undefined;
  if (await getSession()) redirect(safeInternalPath(next));
  return (
    <AuthShell
      title="Connexion"
      subtitle={
        <>
          Pas encore de compte ?{" "}
          <Link
            href={`/inscription${next ? `?${new URLSearchParams({ suite: next, ...(referral ? { ref: referral } : {}) })}` : ""}`}
            className="font-semibold text-teal-700 hover:underline"
          >
            Créer un compte gratuit
          </Link>
        </>
      }
    >
      {sp.erreur === "lien" && (
        <Notice tone="error" className="mb-4">
          Ce lien n&apos;est plus valide (déjà utilisé ou expiré). Connectez-vous, ou demandez un nouveau lien via{" "}
          <Link href="/mot-de-passe-oublie" className="font-semibold underline">
            mot de passe oublié
          </Link>
          .
        </Notice>
      )}
      <SignInForm next={next} referral={referral} />
    </AuthShell>
  );
}
