import "server-only";
import { env } from "@/lib/env";

export type EmailMessage = { to: string; subject: string; html: string; text: string; idempotencyKey?: string };
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
 * Envoi d'e-mail transactionnel : SMTP du domaine si configuré (SMTP_HOST…), sinon Resend
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
  if (!key && env.mailpitUrl) return sendToMailpit(env.mailpitUrl, msg);
  if (!key) return { status: "SKIPPED", error: "Aucun fournisseur e-mail configuré" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(msg.idempotencyKey ? { "Idempotency-Key": msg.idempotencyKey } : {}),
      },
      body: JSON.stringify({ from: env.emailFrom, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
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
