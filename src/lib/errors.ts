import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Traduit une erreur base de données en message affichable.
 * Les messages des fonctions métier (RAISE EXCEPTION ... errcode 42501/22023/P0002/P0429)
 * sont rédigés pour l'utilisateur ; tout le reste est remplacé par un message générique
 * afin de ne divulguer aucun détail technique.
 */
const SAFE_CODES = new Set(["42501", "22023", "P0002", "P0429", "23505"]);

/** Clé de limite d'offre (« PLAN_LIMIT:favorites » → « favorites ») levée par la base, sinon null. */
export function planLimitOf(error: { hint?: string | null } | null | undefined): string | null {
  const h = error?.hint ?? "";
  return h.startsWith("PLAN_LIMIT:") ? h.slice("PLAN_LIMIT:".length) : null;
}

/** Résultat d'action en échec, avec la clé de limite d'offre lorsqu'elle est en cause. */
export function actionError(error: (Pick<PostgrestError, "code" | "message"> & { hint?: string | null }) | null | undefined, fallback?: string) {
  const upgrade = planLimitOf(error);
  return { ok: false as const, error: upgrade ? error!.message : userMessage(error, fallback), ...(upgrade ? { upgrade } : {}) };
}

export function userMessage(error: (Pick<PostgrestError, "code" | "message"> & { hint?: string | null }) | null | undefined, fallback = "Une erreur est survenue. Veuillez réessayer."): string {
  if (!error) return fallback;
  if (planLimitOf(error)) return error.message;
  if (error.code && SAFE_CODES.has(error.code)) {
    if (error.code === "23505" && !/existe déjà/.test(error.message)) return "Cet élément existe déjà.";
    if (error.code === "42501" && /row-level security|permission denied/i.test(error.message)) {
      return "Vous n'avez pas les droits nécessaires pour cette action.";
    }
    return error.message;
  }
  if (error.code === "23514") return "Certaines valeurs ne respectent pas les règles de saisie.";
  return fallback;
}

export function logServerError(context: string, error: unknown) {
  // Journal serveur uniquement (jamais renvoyé au client).
  const detail = error && typeof error === "object" && "message" in error ? (error as { message: string }).message : String(error);
  console.error(`[linkprob2b] ${context}: ${detail}`);
}
