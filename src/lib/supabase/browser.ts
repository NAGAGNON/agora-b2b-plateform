"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { sessionCookieOptions } from "@/lib/supabase/cookie";

let client: SupabaseClient<Database> | null = null;

/**
 * Client navigateur, utilisé UNIQUEMENT pour le temps réel (Supabase Realtime).
 * Il utilise la clé publique et la session de l'utilisateur : les événements
 * reçus sont filtrés par la sécurité au niveau des lignes (RLS), comme les
 * lectures côté serveur. Les données affichées sont rechargées par le serveur.
 */
export function getBrowserClient(url: string, publishableKey: string): SupabaseClient<Database> {
  client ??= createBrowserClient<Database>(url, publishableKey, { cookieOptions: sessionCookieOptions(window.location.protocol === "https:") });
  return client;
}
