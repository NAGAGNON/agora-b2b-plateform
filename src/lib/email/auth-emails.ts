import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { renderEmail } from "@/lib/email/templates";
import { sendEmail, type SendResult } from "@/lib/email/send";
import { logServerError } from "@/lib/errors";

/**
 * E-mails d'authentification envoyés par l'application (Resend) plutôt que par
 * le service d'envoi intégré de Supabase (limité à quelques e-mails par heure) :
 * Supabase génère un jeton à usage unique (admin.generateLink), l'application
 * construit le lien vers /auth/confirmation et envoie l'e-mail.
 * Le jeton n'est jamais stocké : seule la trace d'envoi est journalisée.
 */
type Layout = Parameters<typeof renderEmail>[0];

export const AUTH_SUBJECTS = {
  signup: "Confirmez votre adresse e-mail — LinkProB2B",
  recovery: "Réinitialisation de votre mot de passe — LinkProB2B",
  welcome: "Votre compte LinkProB2B est activé",
};

export const signupLayout = (url: string): Layout => ({
  kicker: "Inscription",
  hero: "equipe",
  title: "Bienvenue sur LinkProB2B",
  paragraphs: [
    "Merci pour votre inscription. Confirmez votre adresse e-mail pour activer votre compte, puis créez la fiche de votre entreprise.",
    "Ce lien est valable 24 heures et ne peut être utilisé qu'une seule fois.",
  ],
  cta: { label: "Confirmer mon adresse e-mail", url },
  footer: "Vous n'êtes pas à l'origine de cette inscription ? Ignorez cet e-mail : aucun compte ne sera activé.",
});

export const recoveryLayout = (url: string): Layout => ({
  kicker: "Sécurité du compte",
  hero: "ordinateurs",
  title: "Réinitialiser votre mot de passe",
  paragraphs: [
    "Une demande de réinitialisation du mot de passe a été faite pour votre compte LinkProB2B.",
    "Ce lien est valable 1 heure et ne peut être utilisé qu'une seule fois.",
  ],
  cta: { label: "Choisir un nouveau mot de passe", url },
  footer: "Vous n'êtes pas à l'origine de cette demande ? Ignorez cet e-mail : votre mot de passe reste inchangé.",
});

export type WelcomeExtras = { offers?: { label: string; url: string }[]; alertName?: string | null };

export const welcomeLayout = ({ offers = [], alertName = null }: WelcomeExtras = {}): Layout => ({
  kicker: "Compte activé",
  hero: "equipe",
  title: "Votre compte est activé",
  paragraphs: [
    offers.length ? "Voici les dernières opportunités ouvertes dans votre domaine : ouvrez-les dès maintenant, le détail complet et les documents sont accessibles avec votre compte." : "Les opportunités B2B et marchés publics de toute la France sont maintenant accessibles avec votre compte.",
    alertName
      ? `Nous avons créé pour vous l'alerte « ${alertName} » : vous recevrez les nouvelles offres de votre domaine chaque matin, uniquement les jours où il y en a. Vous pouvez la modifier ou l'arrêter en un clic depuis votre espace, rubrique Alertes.`
      : "Créez une alerte pour recevoir chaque matin les opportunités qui correspondent à votre activité.",
    "Vous représentez une entreprise ? Complétez sa fiche pour être recommandé aux entreprises qui publient des besoins.",
  ],
  list: offers.length ? offers : undefined,
  cta: offers.length ? { label: "Voir toutes les opportunités", url: `${env.siteUrl}/opportunites` } : alertName ? { label: "Voir les opportunités", url: `${env.siteUrl}/opportunites` } : { label: "Créer mon alerte", url: `${env.siteUrl}/dashboard/alertes` },
  footer: "Vous n'êtes pas à l'origine de cette inscription ? Répondez à cet e-mail : le compte sera supprimé.",
});

export const appSendsAuthEmails = () => env.emailTransport !== null;

function confirmationUrl(tokenHash: string, type: "signup" | "recovery" | "magiclink", suite: string) {
  const u = new URL("/auth/confirmation", env.siteUrl);
  u.searchParams.set("token_hash", tokenHash);
  u.searchParams.set("type", type);
  u.searchParams.set("suite", suite);
  return u.toString();
}

async function deliver(to: string, userId: string | null, template: string, subject: string, layout: Parameters<typeof renderEmail>[0]): Promise<SendResult> {
  const { html, text } = renderEmail(layout);
  const result = await sendEmail({ to, subject, html, text });
  try {
    await createAdminClient()
      .from("email_outbox")
      .insert({
        user_id: userId,
        to_email: to,
        template,
        subject,
        payload: { title: layout.title, note: "lien à usage unique non conservé" },
        status: result.status,
        attempts: 1,
        last_error: result.error ?? null,
        sent_at: result.status === "SENT" ? new Date().toISOString() : null,
      });
  } catch (e) {
    logServerError("auth email log", e);
  }
  return result;
}

export type SignupEmailResult = { ok: true } | { ok: false; reason: "exists" | "weak_password" | "send_failed" | "error" };

/** Crée le compte (non confirmé) et envoie l'e-mail de confirmation. */
export async function signUpWithEmail(input: { email: string; password: string; data: Record<string, string>; next?: string }): Promise<SignupEmailResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email: input.email,
    password: input.password,
    options: { data: input.data, redirectTo: `${env.siteUrl}/auth/confirmation` },
  });
  if (error || !data.properties?.hashed_token) {
    if (error && /already|registered|exists/i.test(error.message)) return { ok: false, reason: "exists" };
    if (error && /password/i.test(error.message)) return { ok: false, reason: "weak_password" };
    logServerError("generateLink signup", error);
    return { ok: false, reason: "error" };
  }
  const url = confirmationUrl(data.properties.hashed_token, "signup", input.next ?? "/onboarding/entreprise");
  const r = await deliver(input.email, data.user?.id ?? null, "auth_confirm_signup", AUTH_SUBJECTS.signup, signupLayout(url));
  if (r.status !== "SENT") {
    // Sans e-mail, le compte serait inutilisable : on le supprime pour permettre une nouvelle tentative.
    if (data.user?.id) await admin.auth.admin.deleteUser(data.user.id).catch(() => undefined);
    return { ok: false, reason: "send_failed" };
  }
  return { ok: true };
}

/** Lien de réinitialisation du mot de passe (silencieux si le compte n'existe pas). */
export async function sendPasswordReset(email: string): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.properties?.hashed_token) return; // compte inexistant : pas d'énumération
  const url = confirmationUrl(data.properties.hashed_token, "recovery", "/reinitialiser-mot-de-passe");
  await deliver(email, data.user?.id ?? null, "auth_recovery", AUTH_SUBJECTS.recovery, recoveryLayout(url));
}

/** E-mail de bienvenue : offres du domaine de la personne et alerte créée pour elle, quand on les connaît. */
export async function sendWelcome(email: string, userId: string, extras: WelcomeExtras = {}): Promise<void> {
  if (!appSendsAuthEmails()) return;
  await deliver(email, userId, "welcome", AUTH_SUBJECTS.welcome, welcomeLayout(extras));
}

/**
 * Promotion automatique du premier super-administrateur (INITIAL_ADMIN_EMAIL),
 * uniquement si aucun super-administrateur réel n'existe encore.
 */
export async function bootstrapInitialAdmin(email: string | undefined | null): Promise<boolean> {
  const target = env.initialAdminEmail;
  if (!target || !email || email.toLowerCase() !== target) return false;
  // Uniquement en production : ailleurs (aperçus, développement), un compte peut être activé sans
  // preuve de l'adresse e-mail et ne doit jamais devenir super-administrateur.
  if (!env.isProduction) return false;
  const { data, error } = await createAdminClient().rpc("bootstrap_super_admin", { p_email: email });
  if (error) logServerError("bootstrapInitialAdmin", error);
  return data === true;
}

/**
 * Nouveau lien d'activation pour un compte créé mais jamais confirmé (lien expiré, e-mail perdu).
 * Silencieux si le compte n'existe pas ou est déjà activé (pas de divulgation des comptes).
 */
export async function resendSignupConfirmation(email: string, next = "/onboarding/entreprise"): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: `${env.siteUrl}/auth/confirmation` } });
  if (error || !data.properties?.hashed_token || !data.user || data.user.email_confirmed_at) return false;
  const url = confirmationUrl(data.properties.hashed_token, "magiclink", next);
  const r = await deliver(email, data.user.id, "auth_confirm_reminder", AUTH_SUBJECTS.signup, signupLayout(url));
  return r.status === "SENT";
}

/**
 * Rappel automatique, une seule fois, aux comptes créés il y a 1 à 7 jours et jamais confirmés
 * (tâche planifiée quotidienne). La date du rappel est notée dans le compte.
 */
export async function remindUnconfirmedSignups(): Promise<{ reminded: number }> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const now = Date.now();
  let reminded = 0;
  for (const u of data?.users ?? []) {
    const age = now - new Date(u.created_at).getTime();
    if (u.email_confirmed_at || !u.email || age < 86_400_000 || age > 7 * 86_400_000) continue;
    if ((u.app_metadata as { confirm_reminded_at?: string } | undefined)?.confirm_reminded_at) continue;
    await admin.auth.admin.updateUserById(u.id, { app_metadata: { ...u.app_metadata, confirm_reminded_at: new Date().toISOString() } });
    if (await resendSignupConfirmation(u.email).catch(() => false)) reminded++;
  }
  return { reminded };
}
