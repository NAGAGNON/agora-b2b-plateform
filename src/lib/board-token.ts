import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Lien de décision envoyé au fondateur par e-mail (valider / refuser / demander plus d'infos une
 * décision du comité sans se connecter). Jeton signé HMAC, lié à la décision, au choix et à une date
 * d'expiration (14 jours). Le lien ouvre une page de confirmation : rien n'est enregistré sur simple
 * ouverture (les messageries qui pré-ouvrent les liens ne peuvent rien valider).
 */
export const BOARD_VERDICTS = ["VALIDEE", "REFUSEE", "PLUS_INFO"] as const;
export type BoardVerdict = (typeof BOARD_VERDICTS)[number];
const TTL_MS = 14 * 86_400_000;

function secret(): string {
  const explicit = process.env.BOARD_TOKEN_SECRET?.trim() || process.env.OUTREACH_TOKEN_SECRET?.trim();
  const base = explicit || (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!base && process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production") {
    throw new Error("BOARD_TOKEN_SECRET ou SUPABASE_SECRET_KEY requis");
  }
  return createHash("sha256").update(`linkprob2b-board:${base || "dev"}`).digest("hex");
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url").slice(0, 32);

/** Jeton : <id décision>.<choix>.<expiration en secondes>.<signature>. */
export function boardDecisionToken(decisionId: string, verdict: BoardVerdict, now = Date.now()): string {
  const exp = Math.floor((now + TTL_MS) / 1000).toString(36);
  const payload = `${decisionId}.${verdict}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** Décision et choix si le jeton est authentique et non expiré, sinon null. */
export function verifyBoardDecisionToken(token: string | null | undefined, now = Date.now()): { decisionId: string; verdict: BoardVerdict } | null {
  if (!token || token.length > 200) return null;
  const m = /^([0-9a-f-]{36})\.(VALIDEE|REFUSEE|PLUS_INFO)\.([0-9a-z]{1,10})\.([A-Za-z0-9_-]{32})$/.exec(token);
  if (!m) return null;
  const payload = `${m[1]}.${m[2]}.${m[3]}`;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(m[4]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (parseInt(m[3], 36) * 1000 < now) return null;
  return { decisionId: m[1], verdict: m[2] as BoardVerdict };
}
