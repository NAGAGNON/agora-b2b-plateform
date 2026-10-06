import { AuthShell } from "@/components/auth/auth-shell";
import { NewPasswordForm } from "@/components/auth/forms";
import { requireSession } from "@/lib/auth";
import { PRIVATE_METADATA } from "@/lib/seo";

export const metadata = { ...PRIVATE_METADATA, title: "Nouveau mot de passe" };

export default async function ResetPasswordPage() {
  await requireSession("/reinitialiser-mot-de-passe");
  return (
    <AuthShell title="Choisir un nouveau mot de passe" aside={false}>
      <NewPasswordForm />
    </AuthShell>
  );
}
