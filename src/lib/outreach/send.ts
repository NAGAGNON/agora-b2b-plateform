import "server-only";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import type { SendResult } from "@/lib/email/send";
import { sendSmtp } from "@/lib/email/smtp";

export type OutreachSendResult = SendResult & { response?: string; permanent?: boolean; transport?: "smtp" | "resend" };

/**
 * Envoi d'un e-mail de prospection. Transport : SMTP du domaine en priorité (aucun coût par
 * e-mail) ; Resend seulement s'il est encore configuré et que le SMTP ne l'est pas.
 * Expéditeur dédié (OUTREACH_EMAIL_FROM, sinon l'adresse des e-mails d'inscription), réponse
 * possible (Reply-To), en-têtes de désinscription en un clic (RFC 8058) exigés par Gmail et Yahoo.
 * Ne doit être appelé qu'après vérification des garde-fous (realSendBlockers + contrôles avant envoi).
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
}): Promise<OutreachSendResult> {
  if (process.env.OUTREACH_SEND_ENABLED === "false") return { status: "SKIPPED", error: "Envoi réel non autorisé" };
  const fromAddress = process.env.OUTREACH_EMAIL_FROM?.trim() || (env.emailFrom.match(/<(.+)>/)?.[1] ?? env.emailFrom);
  const from = /</.test(fromAddress) ? fromAddress : `${msg.senderName.replace(/[<>"]/g, "")} <${fromAddress}>`;
  const unsubscribe = { "List-Unsubscribe": `<${msg.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };

  if (env.emailTransport === "smtp") {
    const domain = fromAddress.split("@")[1]?.replace(/[>\s]/g, "") || "linkprob2b.com";
    const r = await sendSmtp({
      from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      replyTo: msg.replyTo,
      messageId: `<${randomUUID()}@${domain}>`,
      headers: { ...unsubscribe, "X-Entity-Ref-ID": msg.idempotencyKey },
    });
    return { ...r, transport: "smtp" };
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return { status: "SKIPPED", error: "Aucun envoi configuré (SMTP_HOST, SMTP_USER, SMTP_PASSWORD)" };
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
        headers: unsubscribe,
        tags: [{ name: "category", value: "outreach" }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { status: "FAILED", error: `HTTP ${res.status} ${detail.slice(0, 200)}`.trim(), retryable: res.status === 429 || res.status >= 500, transport: "resend" };
    }
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { status: "SENT", id: body.id, response: `HTTP ${res.status}`, transport: "resend" };
  } catch (e) {
    return { status: "FAILED", error: e instanceof Error ? e.message : "Erreur réseau", retryable: true, transport: "resend" };
  }
}
