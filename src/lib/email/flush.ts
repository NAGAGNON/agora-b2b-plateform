import "server-only";
import { after } from "next/server";
import { env } from "@/lib/env";
import { processEmailOutbox } from "@/lib/email/outbox";
import { logServerError } from "@/lib/errors";

/**
 * Envoie la file d'e-mails après la réponse HTTP (sans ralentir l'utilisateur).
 * Sans fournisseur configuré, la file reste en attente pour la tâche quotidienne.
 */
export function flushEmailsAfterResponse() {
  if (!env.emailTransport) return;
  after(async () => {
    try {
      await processEmailOutbox(20);
    } catch (e) {
      logServerError("flushEmails", e);
    }
  });
}
