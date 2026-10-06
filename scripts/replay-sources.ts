/**
 * Rejoue, à travers le pipeline complet (normalisation, classification,
 * déduplication, publication, journal), un échantillon d'annonces RÉELLES
 * exporté par `npm run sources:check -- --dump` (lignes « DUMP:BOAMP:{…} »).
 * Utile lorsque la machine locale n'a pas accès aux API des sources.
 *
 *   npx tsx --conditions=react-server scripts/replay-sources.ts chemin/du/journal.txt
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";

config({ path: ".env.local" });

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage : replay-sources.ts <fichier contenant les lignes DUMP:…>");
  if ((process.env.APP_ENV ?? "") === "production") throw new Error("Refusé en production : utiliser la collecte normale.");
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const { runSource } = await import("../src/lib/collect/run");
  const lines = readFileSync(file, "utf8").split("\n");
  const pick = (name: string) =>
    lines.flatMap((l) => {
      const i = l.indexOf(`DUMP:${name}:`);
      if (i < 0) return [];
      try {
        return [JSON.parse(l.slice(i + name.length + 6))];
      } catch {
        return [];
      }
    });
  const db = createAdminClient();
  for (const [code, name] of [["boamp", "BOAMP"], ["ted", "TED"]] as const) {
    const records = pick(name);
    const { data: source } = await db.from("external_sources").select("*").eq("code", code).single();
    if (!source || !records.length) {
      console.log(`${name} : aucune donnée.`);
      continue;
    }
    // Réponse identique à celle de l'API réelle, servie localement (une seule page).
    const fetchImpl = async () =>
      new Response(JSON.stringify(code === "boamp" ? { total_count: records.length, results: records } : { totalNoticeCount: records.length, notices: records }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    const r = await runSource(source, { trigger: "manual", fetchImpl });
    console.log(`${name} : ${r.status} — lus ${r.fetched}, créés ${r.created}, mis à jour ${r.updated}, doublons ${r.duplicates}, ignorés ${r.skipped}, expirés ${r.expired}${r.errors.length ? ` — ${r.errors.slice(0, 3).join(" | ")}` : ""}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
