/**
 * Synchronisation des sources externes dues (BOAMP, TED), exécutée au build de
 * PRODUCTION juste après les migrations : la plateforme affiche les opportunités
 * réelles dès le premier déploiement, sans attendre la tâche planifiée.
 * Ne bloque jamais le déploiement : les erreurs sont journalisées par source.
 *
 *   npx tsx --conditions=react-server scripts/sync-sources.ts   (SYNC_ON_BUILD=1 hors Vercel)
 */
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  if (process.env.VERCEL_ENV !== "production" && process.env.SYNC_ON_BUILD !== "1") {
    console.log("[sources] Synchronisation au build : production uniquement, étape ignorée.");
    return;
  }
  if (!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    console.log("[sources] Supabase non configuré : étape ignorée.");
    return;
  }
  const { runDueSources } = await import("../src/lib/collect/run");
  const results = await runDueSources();
  if (!results.length) console.log("[sources] Aucune source à synchroniser (déjà à jour).");
  for (const r of results) console.log(`[sources] ${r.source} : ${r.status} — créées ${r.created}, mises à jour ${r.updated}, doublons ${r.duplicates}, erreurs ${r.errors}`);
}

main().catch((e) => console.error("[sources] Synchronisation au build impossible (non bloquant) :", e instanceof Error ? e.message : e));
