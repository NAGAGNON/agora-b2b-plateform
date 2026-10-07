import "server-only";
import { env } from "@/lib/env";
import type { SendResult } from "@/lib/email/send";

/**
 * Envoi d'un e-mail de prospection (Resend). Distinct des e-mails
 * transactionnels : expéditeur dédié (OUTREACH_EMAIL_FROM), en-têtes de
 * désinscription en un clic (RFC 8058) exigés par Gmail et Yahoo.
 * Ne doit être appelé qu'après vérification des garde-fous (realSendBlockers).
 */
export async function sendOutreachEmail(msg: {
  to: string;
  subject: string;
  html: string;
  text: string;
  senderName: string;
  replyTo: string | null;
  unsubscribeUrl: string;
  idempotencyKey: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key || process.env.OUTREACH_SEND_ENABLED === "false") return { status: "SKIPPED", error: "Envoi réel non autorisé" };
  // Même adresse que les e-mails transactionnels (inscriptions) : notifications@<domaine>, déjà vérifiée.
  const fromAddress = process.env.OUTREACH_EMAIL_FROM?.trim() || (env.emailFrom.match(/<(.+)>/)?.[1] ?? env.emailFrom);
  const from = /</.test(fromAddress) ? fromAddress : `${msg.senderName.replace(/[<>"]/g, "")} <${fromAddress}>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": msg.idempotencyKey },
      body: JSON.stringify({
        from,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
        headers: { "List-Unsubscribe": `<${msg.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        tags: [{ name: "category", value: "outreach" }],
      }),
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
