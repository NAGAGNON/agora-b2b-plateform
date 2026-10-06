import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { logServerError } from "@/lib/errors";

/** Identifiant client pseudonymisé (hash salé de l'IP) — l'IP n'est jamais stockée. */
export async function clientFingerprint(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(env.rateLimitSalt + ip).digest("hex").slice(0, 32);
}

/**
 * Limitation de débit pour les actions sensibles non authentifiées
 * (connexion, inscription, contact, mot de passe oublié).
 * Retourne true si l'action est autorisée.
 */
export async function rateLimit(scope: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const key = `${scope}:${await clientFingerprint()}`;
    const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return data === true;
  } catch (e) {
    // En cas d'indisponibilité, on n'empêche pas l'utilisateur d'agir.
    logServerError("rateLimit", e);
    return true;
  }
}
