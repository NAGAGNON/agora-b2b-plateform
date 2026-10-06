import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/forms";
import { getSession } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Connexion", description: "Connectez-vous à votre espace LinkProB2B.", path: "/connexion", noindex: true });

export default async function LoginPage(props: PageProps<"/connexion">) {
  const sp = await props.searchParams;
  const next = typeof sp.suite === "string" ? sp.suite : undefined;
  if (await getSession()) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
  return (
    <AuthShell
      title="Connexion"
      subtitle={
        <>
          Pas encore de compte ?{" "}
          <Link href={`/inscription${next ? `?suite=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-teal-700 hover:underline">
            Créer un compte gratuit
          </Link>
        </>
      }
    >
      <SignInForm next={next} />
    </AuthShell>
  );
}
