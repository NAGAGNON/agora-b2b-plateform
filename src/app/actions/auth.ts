"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { logServerError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { appSendsAuthEmails, bootstrapInitialAdmin, sendPasswordReset, signUpWithEmail } from "@/lib/email/auth-emails";
import { newPasswordSchema, parseForm, resetRequestSchema, signInSchema, signUpSchema, type ActionResult } from "@/lib/validation";

function safeNext(next: FormDataEntryValue | null): string {
  const v = typeof next === "string" ? next : "";
  // Uniquement des chemins internes (évite les redirections ouvertes).
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/dashboard";
}

export async function signIn(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(signInSchema, formData);
  if (!parsed.success) return parsed.result;
  if (!(await rateLimit("login", 10, 600))) {
    return { ok: false, error: "Trop de tentatives de connexion. Réessayez dans quelques minutes." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (/confirm/i.test(error.message)) {
      return { ok: false, error: "Votre adresse e-mail n'est pas encore confirmée. Consultez le lien reçu par e-mail." };
    }
    return { ok: false, error: "Adresse e-mail ou mot de passe incorrect." };
  }
  await bootstrapInitialAdmin(parsed.data.email);
  await supabase.rpc("accept_pending_invitations");
  const next = safeNext(formData.get("suite"));
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    redirect(`/connexion/verification?suite=${encodeURIComponent(next)}`);
  }
  redirect(next);
}

export async function signUp(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(signUpSchema, formData);
  if (!parsed.success) return parsed.result;
  if (!(await rateLimit("signup", 5, 3600))) {
    return { ok: false, error: "Trop d'inscriptions depuis cette connexion. Réessayez plus tard." };
  }
  const supabase = await createClient();
  const { data: reg } = await supabase.from("platform_settings").select("value").eq("key", "registrations").maybeSingle();
  if (reg && (reg.value as { open?: boolean }).open === false) {
    return { ok: false, error: "Les inscriptions sont temporairement fermées." };
  }
  const meta = {
    full_name: parsed.data.fullName,
    terms_accepted: "true",
    marketing_consent: parsed.data.marketing ? "true" : "false",
  };
  const exists = { ok: false as const, error: "Un compte existe déjà avec cette adresse. Connectez-vous ou réinitialisez votre mot de passe." };
  const weak = { ok: false as const, error: "Mot de passe trop faible.", fieldErrors: { password: "Mot de passe trop faible ou trop courant." } };
  const failed = { ok: false as const, error: "L'inscription n'a pas pu aboutir. Veuillez réessayer." };

  // 1. Fournisseur e-mail configuré : confirmation par e-mail envoyée par l'application.
  if (appSendsAuthEmails()) {
    const r = await signUpWithEmail({ email: parsed.data.email, password: parsed.data.password, data: meta });
    if (!r.ok) {
      if (r.reason === "exists") return exists;
      if (r.reason === "weak_password") return weak;
      if (r.reason === "send_failed") return { ok: false, error: "L'e-mail de confirmation n'a pas pu être envoyé. Vérifiez l'adresse et réessayez." };
      return failed;
    }
    await supabase.rpc("track_event", { p_event_name: "create_account" });
    return { ok: true, message: "Compte créé. Un e-mail de confirmation vient de vous être envoyé : cliquez sur le lien pour activer votre compte." };
  }

  // 2. Prévisualisation / développement sans fournisseur e-mail : activation immédiate.
  if (!env.isProduction) {
    const { error } = await createAdminClient().auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: meta,
    });
    if (error) {
      if (/already|registered|exists/i.test(error.message)) return exists;
      if (/password/i.test(error.message)) return weak;
      logServerError("signUp (staging)", error);
      return failed;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
    if (signInError) return { ok: true, message: "Compte créé. Vous pouvez vous connecter." };
    await bootstrapInitialAdmin(parsed.data.email);
    await supabase.rpc("track_event", { p_event_name: "create_account" });
    redirect("/onboarding/entreprise");
  }

  // 3. Production sans Resend : service d'envoi configuré dans Supabase (SMTP du projet).
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${env.siteUrl}/auth/confirmation?suite=/onboarding/entreprise`, data: meta },
  });
  if (error) {
    logServerError("signUp", error);
    if (/already|registered|exists/i.test(error.message)) return exists;
    if (/password/i.test(error.message)) return weak;
    return failed;
  }
  await supabase.rpc("track_event", { p_event_name: "create_account" });
  if (!data.session) {
    return { ok: true, message: "Compte créé. Un e-mail de confirmation vient de vous être envoyé : cliquez sur le lien pour activer votre compte." };
  }
  await bootstrapInitialAdmin(parsed.data.email);
  redirect("/onboarding/entreprise");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(resetRequestSchema, formData);
  if (!parsed.success) return parsed.result;
  if (!(await rateLimit("reset", 5, 3600))) {
    return { ok: false, error: "Trop de demandes. Réessayez plus tard." };
  }
  if (appSendsAuthEmails()) {
    await sendPasswordReset(parsed.data.email);
  } else {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${env.siteUrl}/auth/confirmation?suite=/reinitialiser-mot-de-passe`,
    });
  }
  // Réponse identique que le compte existe ou non (pas d'énumération).
  return { ok: true, message: "Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d'être envoyé." };
}

export async function updatePassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(newPasswordSchema, formData);
  if (!parsed.success) return parsed.result;
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: "Le mot de passe n'a pas pu être modifié. Le lien a peut-être expiré." };
  return { ok: true, message: "Votre mot de passe a été modifié." };
}
