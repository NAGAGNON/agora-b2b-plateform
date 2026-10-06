import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { bootstrapInitialAdmin, sendWelcome } from "@/lib/email/auth-emails";

/** Retour des liens envoyés par e-mail (confirmation d'inscription, réinitialisation). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const suite = searchParams.get("suite") ?? "/dashboard";
  const next = suite.startsWith("/") && !suite.startsWith("//") ? suite : "/dashboard";
  const supabase = await createClient();

  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;

  if (!ok) return NextResponse.redirect(new URL("/connexion?erreur=lien", origin));
  const { data } = await supabase.auth.getUser();
  if (data.user?.email) {
    await bootstrapInitialAdmin(data.user.email);
    if (type === "signup" || type === "email") await sendWelcome(data.user.email, data.user.id);
  }
  await supabase.rpc("accept_pending_invitations");
  return NextResponse.redirect(new URL(next, origin));
}
