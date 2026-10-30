import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bootstrapInitialAdmin, sendWelcome } from "@/lib/email/auth-emails";
import { safeInternalPath } from "@/lib/safe-path";

/** Retour des liens envoyés par e-mail (confirmation d'inscription, réinitialisation). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeInternalPath(searchParams.get("suite"));
  const supabase = await createClient();

  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;

  if (!ok) return NextResponse.redirect(new URL("/connexion?erreur=lien", origin));
  const { data } = await supabase.auth.getUser();
  if (data.user?.email) {
    await bootstrapInitialAdmin(data.user.email);
    // Premier passage par Google : compte créé à l'instant, e-mail de bienvenue comme pour une inscription classique
    const firstGoogleLogin = searchParams.get("fournisseur") === "google" && Date.now() - new Date(data.user.created_at).getTime() < 5 * 60_000;
    // Bouton Google : l'acceptation des CGU est affichée sous le bouton, elle est enregistrée à la création du compte
    if (firstGoogleLogin) await createAdminClient().from("users").update({ terms_accepted_at: new Date().toISOString() }).eq("id", data.user.id).is("terms_accepted_at", null);
    if (type === "signup" || type === "email" || firstGoogleLogin) await sendWelcome(data.user.email, data.user.id);
  }
  await supabase.rpc("accept_pending_invitations");
  return NextResponse.redirect(new URL(next, origin));
}
