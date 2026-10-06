import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { MfaChallengeForm } from "@/components/dashboard/security-forms";
import { createClient } from "@/lib/supabase/server";
import { PRIVATE_METADATA } from "@/lib/seo";

export const metadata = { ...PRIVATE_METADATA, title: "Vérification en deux étapes" };

export default async function MfaChallengePage(props: PageProps<"/connexion/verification">) {
  const sp = await props.searchParams;
  const next = typeof sp.suite === "string" && sp.suite.startsWith("/") && !sp.suite.startsWith("//") ? sp.suite : "/dashboard";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const { data } = await supabase.auth.mfa.listFactors();
  const factor = data?.totp?.find((f) => f.status === "verified");
  if (!factor) redirect(next);
  return (
    <AuthShell title="Vérification en deux étapes" subtitle="Saisissez le code généré par votre application d'authentification." aside={false}>
      <MfaChallengeForm factorId={factor.id} next={next} />
    </AuthShell>
  );
}
