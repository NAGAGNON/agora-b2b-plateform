import "server-only";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { createClient as createSupabase } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";
import { SESSION_COOKIE } from "@/lib/supabase/cookie";
import { createClient } from "@/lib/supabase/server";

type Rpc = keyof Database["public"]["Functions"];
type Args<F extends Rpc> = Database["public"]["Functions"][F]["Args"];
type Rows<F extends Rpc> = Database["public"]["Functions"][F]["Returns"];

/** Durée pendant laquelle un même résultat public est resservi sans relire la base (production). */
const PUBLIC_TTL_S = env.isProduction ? 900 : 1;
/** Étiquette du cache public : vidée à chaque publication validée (annonce visible tout de suite). */
export const PUBLIC_CACHE_TAG = "public-rpc";

/** Visiteur sans session (la grande majorité, robots d'indexation compris). */
export async function isAnonymousVisitor() {
  return !(await cookies()).getAll().some((c) => c.name.startsWith(SESSION_COOKIE));
}

function anonClient() {
  return createSupabase<Database>(env.supabaseServerUrl, env.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(12_000) }) },
  });
}

/**
 * Lecture publique mise en cache 15 min (mêmes droits qu'un visiteur anonyme, RLS) : les
 * recherches et compteurs des pages publiques, appelés à chaque visite et par chaque robot,
 * ne relisent plus toute la table des annonces. Une erreur n'est jamais mise en cache.
 */
const cachedRpc = unstable_cache(
  async (fn: string, args: Record<string, unknown>) => {
    // Une seconde tentative si la base est momentanément occupée (envois de prospection en cours)
    for (let attempt = 1; ; attempt++) {
      try {
        const { data, error } = await anonClient().rpc(fn as Rpc, args as never);
        if (error) throw new Error(error.message);
        return data as unknown;
      } catch (e) {
        if (attempt >= 2) throw e;
        await new Promise((r) => setTimeout(r, 1_500));
      }
    }
  },
  ["public-rpc-v1"],
  { revalidate: PUBLIC_TTL_S, tags: [PUBLIC_CACHE_TAG] },
);

/**
 * Fonction de la base appelée pour le visiteur courant : résultat public en cache pour un
 * visiteur anonyme, lecture directe (droits de la session) pour un visiteur connecté.
 */
export async function visitorRpc<F extends Rpc>(fn: F, args: Args<F>, { always = false }: { always?: boolean } = {}): Promise<{ data: Rows<F> | null; error: { message: string } | null }> {
  if (always || (await isAnonymousVisitor())) {
    try {
      return { data: (await cachedRpc(fn, (args ?? {}) as Record<string, unknown>)) as Rows<F>, error: null };
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
    }
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args as never);
  return { data: (data as Rows<F> | null) ?? null, error: error ? { message: error.message } : null };
}
