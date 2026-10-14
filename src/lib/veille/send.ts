import "server-only";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { sendEmail, type SendResult } from "@/lib/email/send";

export type VeilleSendResult = SendResult & { permanent?: boolean };
export type VeilleMessage = { to: string; subject: string; html: string; text: string; token: string };

export const VEILLE_SENDER_NAME = "LinkProB2B | Veille commerciale";

/** Adresse d'expédition de la veille : VEILLE_EMAIL_FROM, sinon l'adresse des e-mails du site. */
export function veilleFrom(): { address: string; header: string } {
  const own = process.env.VEILLE_EMAIL_FROM?.trim();
  const raw = own || env.emailFrom;
  const address = (raw.match(/<(.+)>/)?.[1] ?? raw).trim();
  // Nom d'expéditeur stable « LinkProB2B | Veille commerciale », sauf nom choisi dans VEILLE_EMAIL_FROM
  return { address, header: own && /</.test(own) ? own : `"${VEILLE_SENDER_NAME}" <${address}>` };
}

/**
 * Envoi d'un e-mail de veille par le service déjà configuré (SMTP du domaine en priorité, sans
 * coût par e-mail). En-têtes de désinscription en un clic (RFC 8058) exigés par Gmail et Yahoo.
 */
export async function sendVeilleEmail(msg: VeilleMessage): Promise<VeilleSendResult> {
  const unsubscribeUrl = `${env.siteUrl}/api/veille/desabonnement?jeton=${encodeURIComponent(msg.token)}`;
  if (env.emailTransport === "smtp") {
    const { sendSmtp } = await import("@/lib/email/smtp");
    const from = veilleFrom();
    const domain = from.address.split("@")[1] || "linkprob2b.com";
    return sendSmtp({
      from: from.header,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      messageId: `<${randomUUID()}@${domain}>`,
      headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click", "X-Entity-Ref-ID": msg.token },
    });
  }
  return sendEmail({ to: msg.to, subject: msg.subject, html: msg.html, text: msg.text, idempotencyKey: `veille-${msg.token}` });
}
