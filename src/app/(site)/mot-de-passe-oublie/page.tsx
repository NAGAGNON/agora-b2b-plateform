import { AuthShell } from "@/components/auth/auth-shell";
import { ResetRequestForm } from "@/components/auth/forms";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Mot de passe oublié", description: "Réinitialiser votre mot de passe.", path: "/mot-de-passe-oublie", noindex: true });

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Mot de passe oublié" subtitle="Indiquez votre adresse e-mail : vous recevrez un lien pour choisir un nouveau mot de passe." aside={false}>
      <ResetRequestForm />
    </AuthShell>
  );
}
