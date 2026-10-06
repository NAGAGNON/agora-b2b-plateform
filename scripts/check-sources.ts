/**
 * Test de contrat contre les API RÉELLES des sources (BOAMP, TED).
 * Aucune écriture en base : collecte, normalisation et rapport.
 *
 *   npm run sources:check
 *
 * Exécuté chaque jour par GitHub Actions (.github/workflows/sources.yml) pour
 * détecter au plus tôt un changement de format ou d'accès d'une source.
 * Code de sortie 1 si une source ne répond pas ou si aucune annonce n'est exploitable.
 */
import { collectBoamp, collectTed, type SourceConfig } from "../src/lib/collect/connectors";

const SOURCES: { name: string; run: typeof collectBoamp; config: SourceConfig }[] = [
  { name: "BOAMP", run: collectBoamp, config: { departments: ["22", "29", "35", "56"], lookbackDays: 21, maxRecords: 200 } },
  {
    name: "TED",
    run: collectTed,
    config: {
      country: "FRA",
      nuts: ["FRH01", "FRH02", "FRH03", "FRH04"],
      lookbackDays: 21,
      maxRecords: 200,
      fields: ["publication-number", "notice-title", "buyer-name", "publication-date", "deadline-receipt-tender-date-lot", "place-of-performance", "classification-cpv", "contract-nature"],
    },
  },
];

async function main() {
  const now = new Date();
  let failures = 0;
  for (const s of SOURCES) {
    const started = Date.now();
    try {
      const batch = await s.run({ config: s.config, since: new Date(now.getTime() - 21 * 86_400_000), fetchImpl: fetch, now });
      const ok = batch.mapped.filter((m) => m.ok);
      const reasons = new Map<string, number>();
      for (const m of batch.mapped) if (!m.ok) reasons.set(m.reason.split(" :")[0], (reasons.get(m.reason.split(" :")[0]) ?? 0) + 1);
      const sectors = new Map<string, number>();
      for (const m of ok) if (m.ok) sectors.set(m.item.sectorSlug ?? "(non classé)", (sectors.get(m.item.sectorSlug ?? "(non classé)") ?? 0) + 1);
      console.log(`\n## ${s.name} — ${batch.records.length} enregistrement(s) lus, ${ok.length} exploitable(s) en ${Date.now() - started} ms`);
      if (reasons.size) console.log("Écartés :", Object.fromEntries(reasons));
      console.log("Secteurs :", Object.fromEntries(sectors));
      for (const m of ok.slice(0, 3)) if (m.ok) console.log(`  • [${m.item.externalId}] ${m.item.title.slice(0, 90)} — ${m.item.buyer ?? "?"} — limite ${m.item.deadline ?? "?"} — ${m.item.originalUrl}`);
      if (batch.records.length > 0 && ok.length === 0) {
        console.error(`✗ ${s.name} : aucune annonce exploitable — format modifié ?`);
        failures++;
      }
    } catch (e) {
      console.error(`✗ ${s.name} : ${e instanceof Error ? e.message : e}`);
      failures++;
    }
  }
  process.exit(failures ? 1 : 0);
}

void main();
