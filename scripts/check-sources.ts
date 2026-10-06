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

/** Diagnostic TED : format brut des champs et filtrage géographique côté serveur. */
async function exploreTed(since: string) {
  const fields = ["publication-number", "notice-title", "buyer-name", "publication-date", "deadline-receipt-tender-date-lot", "deadline-receipt-request-date-lot", "deadline", "place-of-performance", "classification-cpv", "contract-nature", "buyer-city", "notice-type"];
  const queries = [
    `buyer-country=FRA AND PD>=${since}`,
    `place-of-performance IN (FRH01 FRH02 FRH03 FRH04) AND PD>=${since}`,
    `place-of-performance=FRH0* AND PD>=${since}`,
    `buyer-country=FRA AND place-of-performance IN (FRH01 FRH02 FRH03 FRH04) AND PD>=${since}`,
  ];
  for (const query of queries) {
    const res = await fetch("https://api.ted.europa.eu/v3/notices/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, fields, limit: 3, page: 1, scope: "ACTIVE", paginationMode: "PAGE_NUMBER" }),
    });
    const body = (await res.json().catch(() => ({}))) as { totalNoticeCount?: number; notices?: unknown[]; message?: string };
    console.log(`\n[TED diagnostic] HTTP ${res.status} total=${body.totalNoticeCount ?? "?"} — ${query}${body.message ? ` — ${body.message}` : ""}`);
    if (query === queries[1] || query === queries[3]) console.log(JSON.stringify(body.notices?.slice(0, 2), null, 1)?.slice(0, 4000));
  }
}

async function main() {
  const now = new Date();
  if (process.argv.includes("--explore")) await exploreTed(new Date(now.getTime() - 21 * 86_400_000).toISOString().slice(0, 10).replace(/-/g, "")).catch((e) => console.error("diagnostic", e));
  let failures = 0;
  for (const s of SOURCES) {
    const started = Date.now();
    try {
      const batch = await s.run({ config: s.config, since: new Date(now.getTime() - 21 * 86_400_000), fetchImpl: fetch, now });
      const ok = batch.mapped.filter((m) => m.ok);
      const reasons = new Map<string, number>();
      for (const m of batch.mapped) if (!m.ok) {
        const key = m.reason.replace(/\s*\(.*\)\s*$/, "").split(" :")[0];
        reasons.set(key, (reasons.get(key) ?? 0) + 1);
      }
      const sectors = new Map<string, number>();
      for (const m of ok) if (m.ok) sectors.set(m.item.sectorSlug ?? "(non classé)", (sectors.get(m.item.sectorSlug ?? "(non classé)") ?? 0) + 1);
      const withDeadline = ok.filter((m) => m.ok && m.item.deadline).length;
      console.log(`\n## ${s.name} — ${batch.records.length} enregistrement(s) lus, ${ok.length} exploitable(s) (${withDeadline} avec date limite) en ${Date.now() - started} ms`);
      if (reasons.size) console.log("Écartés :", Object.fromEntries(reasons));
      console.log("Secteurs :", Object.fromEntries(sectors));
      if (process.argv.includes("--explore")) {
        const unclassified = ok.filter((m) => m.ok && !m.item.sectorSlug).slice(0, 25);
        if (unclassified.length) console.log("Exemples non classés :\n" + unclassified.map((m) => (m.ok ? `  - ${m.item.title.slice(0, 110)} [cpv: ${m.item.cpv.join(",") || "—"}] [mots-clés: ${m.item.keywords.join(", ").slice(0, 80)}]` : "")).join("\n"));
      }
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
