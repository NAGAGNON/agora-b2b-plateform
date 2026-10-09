import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { logServerError } from "@/lib/errors";

/**
 * IP du client. Priorité aux en-têtes posés par l'infrastructure, que le client ne
 * peut pas falsifier : Vercel (x-vercel-forwarded-for), Cloudflare (cf-connecting-ip).
 * X-Forwarded-For n'est qu'un repli (réécrit par Vercel, mais falsifiable ailleurs).
 */
export function clientIp(h: Headers): string {
  return (
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("cf-connecting-ip")?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/** Identifiant client pseudonymisé (hash salé de l'IP) — l'IP n'est jamais stockée. */
export async function clientFingerprint(): Promise<string> {
  const ip = clientIp(await headers());
  return createHash("sha256").update(env.rateLimitSalt + ip).digest("hex").slice(0, 32);
}

/**
 * Limitation de débit pour les actions sensibles non authentifiées
 * (connexion, inscription, contact, mot de passe oublié).
 * Retourne true si l'action est autorisée.
 */
const FAIL_CLOSED = new Set(["login", "signup", "reset"]);

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
    // En cas d'indisponibilité : connexion, inscription et mot de passe oublié sont refusés
    // (pas d'essais illimités) ; les autres actions restent possibles.
    logServerError("rateLimit", e);
    return !FAIL_CLOSED.has(scope);
  }
}
