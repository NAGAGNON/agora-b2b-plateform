"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { logServerError } from "@/lib/errors";
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
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${env.siteUrl}/auth/confirmation?suite=/onboarding/entreprise`,
      data: {
        full_name: parsed.data.fullName,
        terms_accepted: "true",
        marketing_consent: parsed.data.marketing ? "true" : "false",
      },
    },
  });
  if (error) {
    logServerError("signUp", error);
    if (/already|registered|exists/i.test(error.message)) {
      return { ok: false, error: "Un compte existe déjà avec cette adresse. Connectez-vous ou réinitialisez votre mot de passe." };
    }
    if (/password/i.test(error.message)) {
      return { ok: false, error: "Mot de passe trop faible.", fieldErrors: { password: "Mot de passe trop faible ou trop courant." } };
    }
    return { ok: false, error: "L'inscription n'a pas pu aboutir. Veuillez réessayer." };
  }
  await supabase.rpc("track_event", { p_event_name: "create_account" });
  if (!data.session) {
    return { ok: true, message: "Compte créé. Un e-mail de confirmation vient de vous être envoyé : cliquez sur le lien pour activer votre compte." };
  }
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
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.siteUrl}/auth/confirmation?suite=/reinitialiser-mot-de-passe`,
  });
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
