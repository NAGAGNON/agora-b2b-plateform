import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Jeton unique et signé par destinataire de campagne (landing page, suivi,
 * désinscription). Format : <identifiant (base64url)>.<signature HMAC-SHA256 tronquée>.
 * Impossible à deviner ou à falsifier sans le secret serveur ; rien n'est exposé
 * côté navigateur.
 */
function secret(): string {
  const explicit = process.env.OUTREACH_TOKEN_SECRET?.trim();
  if (explicit) return explicit;
  const base = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!base && process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production") {
    throw new Error("OUTREACH_TOKEN_SECRET ou SUPABASE_SECRET_KEY requis");
  }
  return createHash("sha256").update(`linkprob2b-outreach:${base || "dev"}`).digest("hex");
}

function sign(id: string): string {
  return createHmac("sha256", secret()).update(id).digest("base64url").slice(0, 24);
}

export function recipientToken(recipientId: string): string {
  const id = Buffer.from(recipientId.replace(/-/g, ""), "hex").toString("base64url");
  return `${id}.${sign(recipientId)}`;
}

/** Identifiant du destinataire si le jeton est authentique, sinon null. */
export function verifyRecipientToken(token: string | null | undefined): string | null {
  if (!token || token.length > 80) return null;
  const m = /^([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{24})$/.exec(token);
  if (!m) return null;
  const hex = Buffer.from(m[1], "base64url").toString("hex");
  if (hex.length !== 32) return null;
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const expected = Buffer.from(sign(id));
  const given = Buffer.from(m[2]);
  return expected.length === given.length && timingSafeEqual(expected, given) ? id : null;
}
