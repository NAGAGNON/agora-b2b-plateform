import "server-only";
import { env } from "@/lib/env";

export type EmailMessage = { to: string; subject: string; html: string; text: string };
export type SendResult = { status: "SENT" | "SKIPPED" | "FAILED"; error?: string };

/**
 * Envoi d'e-mail transactionnel. Fournisseur : Resend (API HTTP) si RESEND_API_KEY
 * est défini ; sinon l'e-mail est marqué « SKIPPED » (aucun envoi réel) — utile en
 * développement et en prévisualisation.
 */
export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const key = env.resendApiKey;
  if (!key) return { status: "SKIPPED", error: "Aucun fournisseur e-mail configuré" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.emailFrom, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (!res.ok) return { status: "FAILED", error: `HTTP ${res.status}` };
    return { status: "SENT" };
  } catch (e) {
    return { status: "FAILED", error: e instanceof Error ? e.message : "Erreur réseau" };
  }
}
