import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";

/**
 * Client « service » : contourne la RLS. À n'utiliser que dans du code serveur
 * de confiance (tâches planifiées, suppression de compte, limitation de débit,
 * formulaire de contact), JAMAIS avec des paramètres non validés.
 */
export function createAdminClient() {
  return createClient<Database>(env.supabaseServerUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Base indisponible : requête abandonnée au bout de 25 s (au lieu d'attendre indéfiniment)
    global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(25_000) }) },
  });
}
