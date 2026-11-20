import "server-only";
import { env } from "@/lib/env";

/** `bulk` : e-mail envoyé en nombre (veille, relances, alertes) : par le SMTP d'abord, pour garder le quota
 * quotidien de Resend aux e-mails importants (mot de passe, bienvenue, entreprise créée, alertes admin). */
export type EmailMessage = { to: string; subject: string; html: string; text: string; idempotencyKey?: string; fromName?: string; headers?: Record<string, string>; bulk?: boolean };
/** `retryable` : erreur temporaire (réseau, 429, 5xx) — la file réessaiera. */
export type SendResult = { status: "SENT" | "SKIPPED" | "FAILED"; error?: string; retryable?: boolean; id?: string };

/** Boîte de test Mailpit (API HTTP d'envoi), hors production. */
async function sendToMailpit(base: string, msg: EmailMessage): Promise<SendResult> {
  const from = env.emailFrom.match(/^(.*?)\s*<(.+)>$/);
  try {
    const res = await fetch(`${base}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: from ? { Name: from[1].replace(/"/g, ""), Email: from[2] } : { Email: env.emailFrom },
        To: [{ Email: msg.to }],
        Subject: msg.subject,
        HTML: msg.html,
        Text: msg.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { status: "FAILED", error: `Mailpit HTTP ${res.status}`, retryable: res.status >= 500 };
    return { status: "SENT" };
  } catch (e) {
    return { status: "FAILED", error: e instanceof Error ? e.message : "Erreur réseau", retryable: true };
  }
}

/**
 * Envoi d'e-mail transactionnel : SMTP si configuré (SMTP_HOST…), sauf EMAIL_TRANSPORT=resend
 * (Resend en priorité, SMTP en secours) ; sinon Resend
 * (API HTTP) si RESEND_API_KEY est défini ; sinon l'e-mail est marqué « SKIPPED » (aucun envoi
 * réel) — utile en développement et en prévisualisation.
 */
export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  // SMTP du domaine en priorité (aucun coût par e-mail)
  if (env.emailTransport === "smtp") {
    const { sendSmtp } = await import("@/lib/email/smtp");
    const r = await sendSmtp({ from: env.emailFrom, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text });
    return { status: r.status, error: r.error, retryable: r.retryable, id: r.id };
  }
  const key = env.resendApiKey;
  // Envoi en nombre : SMTP d'abord (quota Resend gratuit limité à 100 par jour), Resend en secours
  if (msg.bulk && key && env.smtpConfigured) {
    const { sendSmtp } = await import("@/lib/email/smtp");
    const address = (env.emailFrom.match(/<(.+)>/)?.[1] ?? env.emailFrom).trim();
    const from = msg.fromName ? `"${msg.fromName.replace(/["<>]/g, "")}" <${address}>` : env.emailFrom;
    const s = await sendSmtp({ from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text, headers: msg.headers });
    if (s.status === "SENT") return { status: "SENT", id: s.id };
    const r = await sendResend(key, msg);
    return r.status === "SENT" ? r : { status: r.status, error: `SMTP : ${s.error} · Resend : ${r.error}`, retryable: s.retryable || r.retryable };
  }
  if (!key && env.mailpitUrl) return sendToMailpit(env.mailpitUrl, msg);
  if (!key) return { status: "SKIPPED", error: "Aucun fournisseur e-mail configuré" };
  const r = await sendResend(key, msg);
  // Resend refuse (quota du jour atteint, panne…) : secours par le SMTP s'il est configuré
  if (r.status === "FAILED" && env.smtpConfigured) {
    const { sendSmtp } = await import("@/lib/email/smtp");
    const s = await sendSmtp({ from: env.emailFrom, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text, headers: msg.headers });
    return s.status === "SENT" ? { status: "SENT", id: s.id } : { status: s.status, error: `Resend : ${r.error} · SMTP : ${s.error}`, retryable: s.retryable || r.retryable };
  }
  return r;
}

async function sendResend(key: string, msg: EmailMessage): Promise<SendResult> {
  const replyTo = env.emailReplyTo;
  const address = env.resendFrom.match(/<(.+)>/)?.[1] ?? env.resendFrom;
  const from = msg.fromName ? `"${msg.fromName.replace(/["<>]/g, "")}" <${address}>` : env.resendFrom;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(msg.idempotencyKey ? { "Idempotency-Key": msg.idempotencyKey } : {}),
      },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text, ...(replyTo ? { reply_to: replyTo } : {}), ...(msg.headers ? { headers: msg.headers } : {}) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { status: "FAILED", error: `HTTP ${res.status} ${detail.slice(0, 200)}`.trim(), retryable: res.status === 429 || res.status >= 500 };
    }
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { status: "SENT", id: body.id };
  } catch (e) {
    return { status: "FAILED", error: e instanceof Error ? e.message : "Erreur réseau", retryable: true };
  }
}
