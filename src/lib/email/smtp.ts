import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import type { SendResult } from "@/lib/email/send";
import { env } from "@/lib/env";

/**
 * Envoi par SMTP standard (aucune API d'envoi payante) : le serveur SMTP de la messagerie
 * du domaine (ou d'un serveur que nous contrôlons), avec identifiants côté serveur uniquement
 * (variables d'environnement, jamais exposées au navigateur).
 *
 *   SMTP_HOST, SMTP_PORT (587 par défaut ; 465 = TLS direct), SMTP_USER, SMTP_PASSWORD,
 *   SMTP_SECURE (facultatif, « true » pour TLS direct), SMTP_HELO_NAME (facultatif, nom annoncé en
 *   EHLO), SMTP_REQUIRE_TLS (« false » uniquement pour un serveur de test local sans chiffrement).
 *
 * Note : l'hébergement (Vercel, fonctions sans serveur) bloque le port 25 sortant ; il ne peut
 * donc pas jouer lui-même le rôle de serveur d'envoi (remise directe aux serveurs des
 * destinataires). Il soumet les messages à un serveur SMTP authentifié (ports 587 / 465).
 */
export type SmtpMessage = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  headers?: Record<string, string>;
  messageId?: string;
};

export type SmtpResult = SendResult & { response?: string; permanent?: boolean };

export function smtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT ?? 587) || 587;
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;
  // STARTTLS exigé par défaut (SMTP_REQUIRE_TLS=false uniquement pour un serveur de test local)
  const requireTLS = !secure && process.env.SMTP_REQUIRE_TLS !== "false";
  return { host, port, secure, requireTLS, user, pass, name: process.env.SMTP_HELO_NAME?.trim() || undefined };
}

export const smtpConfigured = () => smtpConfig() !== null;

let cached: { key: string; transporter: Transporter } | null = null;

/** Connexion réutilisée pendant toute l'exécution (une seule connexion, pas d'envois simultanés). */
function transporter(): Transporter | null {
  const c = smtpConfig();
  if (!c) return null;
  const key = `${c.host}:${c.port}:${c.user}:${c.secure}:${c.requireTLS}`;
  if (cached?.key === key) return cached.transporter;
  const t = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    requireTLS: c.requireTLS, // STARTTLS obligatoire sur 587 : les identifiants ne circulent jamais en clair
    ignoreTLS: !c.secure && !c.requireTLS,
    auth: { user: c.user, pass: c.pass },
    name: c.name, // HELO/EHLO
    pool: true,
    maxConnections: 1,
    maxMessages: 100,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  cached = { key, transporter: t };
  return t;
}

/**
 * Classe une erreur SMTP : 5xx = refus définitif (adresse inexistante, refus du destinataire),
 * 4xx / réseau = temporaire (nouvelle tentative plus tard).
 */
export function classifySmtpError(e: unknown): { error: string; permanent: boolean; retryable: boolean; response?: string } {
  const err = e as { responseCode?: number; response?: string; code?: string; message?: string };
  const code = err?.responseCode;
  const response = err?.response?.slice(0, 500);
  const message = (err?.message ?? "Erreur SMTP").slice(0, 300);
  if (err?.code === "EAUTH") return { error: `Authentification SMTP refusée : ${message}`, permanent: false, retryable: false, response };
  if (typeof code === "number" && code >= 500 && code < 600) {
    // Refus lié à l'adresse du destinataire (rebond définitif) uniquement si l'erreur porte sur RCPT
    const recipient = err?.code === "EENVELOPE" || /recipient|mailbox|user unknown|does not exist|no such user|address rejected|5\.1\.\d/i.test(`${response ?? ""} ${message}`);
    return { error: message, permanent: recipient, retryable: false, response };
  }
  return { error: message, permanent: false, retryable: true, response };
}

/** Envoi d'un message par SMTP. Ne lève jamais d'erreur : le résultat décrit l'issue. */
export async function sendSmtp(msg: SmtpMessage): Promise<SmtpResult> {
  const t = transporter();
  if (!t) return { status: "SKIPPED", error: "SMTP non configuré" };
  try {
    const info = await t.sendMail({
      from: msg.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      replyTo: msg.replyTo ?? undefined,
      headers: msg.headers,
      messageId: msg.messageId,
    });
    const rejected = (info.rejected ?? []).map(String);
    if (rejected.length) return { status: "FAILED", error: `Adresse refusée par le serveur : ${rejected.join(", ")}`, permanent: true, retryable: false, response: info.response };
    return { status: "SENT", id: info.messageId, response: info.response?.slice(0, 500) };
  } catch (e) {
    const c = classifySmtpError(e);
    return { status: "FAILED", error: c.error, retryable: c.retryable, permanent: c.permanent, response: c.response };
  }
}

/** Vérifie la connexion et l'authentification SMTP (bouton « Tester » des paramètres). */
export async function verifySmtp(): Promise<{ ok: boolean; message: string }> {
  const t = transporter();
  if (!t) return { ok: false, message: "SMTP non configuré (SMTP_HOST, SMTP_USER, SMTP_PASSWORD)." };
  try {
    await t.verify();
    const c = smtpConfig()!;
    const from = env.emailFrom.match(/<(.+)>/)?.[1] ?? env.emailFrom;
    // Gmail / Infomaniak remplacent (ou refusent) un expéditeur qui n'est pas la boîte connectée
    const mismatch = from.toLowerCase() !== c.user.toLowerCase() ? ` Attention : l'expéditeur (${from}) n'est pas la boîte connectée (${c.user}) ; la messagerie peut le remplacer ou refuser l'envoi.` : "";
    return { ok: true, message: `Connexion SMTP réussie (${c.host}:${c.port}, ${c.secure ? "TLS" : "STARTTLS"}). Expéditeur : ${from}.${mismatch}` };
  } catch (e) {
    return { ok: false, message: classifySmtpError(e).error };
  }
}
