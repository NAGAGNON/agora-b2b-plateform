import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Traduit une erreur base de données en message affichable.
 * Les messages des fonctions métier (RAISE EXCEPTION ... errcode 42501/22023/P0002/P0429)
 * sont rédigés pour l'utilisateur ; tout le reste est remplacé par un message générique
 * afin de ne divulguer aucun détail technique.
 */
const SAFE_CODES = new Set(["42501", "22023", "P0002", "P0429", "23505"]);

export function userMessage(error: Pick<PostgrestError, "code" | "message"> | null | undefined, fallback = "Une erreur est survenue. Veuillez réessayer."): string {
  if (!error) return fallback;
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
